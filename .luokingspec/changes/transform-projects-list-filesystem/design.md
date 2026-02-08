## Context

当前 `/projects/list` 页面使用扁平的文件夹列表，点击文件夹跳转到独立的 `folder-detail` 页面。Mushroom 的 asset 管理页面已实现文件系统风格（面包屑、双击导航、URL 驱动层级）。本次变更将项目列表页改造为类似的文件系统风格，同时保持与 mushroom 组件完全隔离。

现有系统：

- **前端**：`ProjectPage` → 扁平 `ProjectFolderList` + `MediaJobList`，使用 `ProjectListViewController` 协调 `FilterManager`、`FolderListManager`、`FolderOperateManager`、`MediaJobOperateManager`、`SelectFilesManager`、`SelectFolderManager`
- **后端**：`ProjectFolder` 无 parent 字段，API 不支持层级筛选。List 支持 search/ordering/pagination。
- **导航**：点击文件夹 → `/projects/folder-detail?folderId=xxx`（独立页面）

目标系统：

- **前端**：新增 `ProjectListFileSystemPage`，支持文件夹层级、面包屑、双击导航，复用现有 Manager 体系
- **后端**：`ProjectFolder` 添加 `parent` FK，API 支持按 parent 筛选、获取祖先链、移动文件夹
- **导航**：双击文件夹 → 同页面 URL 更新 `?folderId=xxx&view=filesystem`

## Goals / Non-Goals

### Goals

- 为 `/projects/list` 添加文件系统风格视图，通过 URL 参数 `view=filesystem` 切换
- 后端支持文件夹层级（parent FK）和祖先链查询
- 支持文件夹移动操作（修改 parent），通过 dropdown/bulk bar → dialog
- 完全隔离于 mushroom 组件体系

### Non-Goals

- 修改 legacy 视图或 folder-detail 页面行为
- 使用 mushroom 组件
- 移动端适配
- 文件夹嵌套深度限制
- 拖拽排序或拖拽移动

## Decisions

### 1. 视图切换方式

**决策**：使用 URL 参数 `view=filesystem` 控制，默认展示 legacy 视图。

**理由**：
- 用户可以自行选择视图模式
- 便于分享特定视图的链接
- 不需要额外的 feature flag 基础设施
- 渐进式切换，不影响现有用户

**考虑的替代方案**：
- Feature flag 全局控制：被拒绝，因为用户无法自行选择视图
- UI 开关 + localStorage：被拒绝，增加复杂度且 URL 不可分享
- Feature flag + URL override：被拒绝，过于复杂

### 2. 面包屑数据来源

**决策**：在 GET `/media/project-folders/{id}/` 的响应中添加 `ancestors` 数组字段。

**理由**：
- 复用已有的 folder detail 端点，无需新增 API
- 支持直接 URL 访问时获取完整路径（如分享链接）
- 一次请求同时获取文件夹信息和祖先链

**考虑的替代方案**：
- 新增独立 breadcrumb 端点：被拒绝，增加 API 数量和维护成本
- 前端追踪导航路径：被拒绝，直接 URL 访问时无法获取祖先链

### 3. 移动文件夹交互方式

**决策**：通过 dropdown 菜单或 bulk bar 触发，打开 dialog 选择目标文件夹（类似 mushroom 的处理方式）。

**理由**：
- 与 mushroom 交互一致，用户熟悉
- Dialog 可以展示文件夹树结构，避免误操作
- 支持单个和批量移动

**考虑的替代方案**：
- 拖拽移动：被拒绝，交互复杂度高，触摸设备不友好

### 4. 后端 parent 参数语义

**决策**：
- `parent` 参数**不传**：返回所有文件夹（现有行为，完全向后兼容）
- `parent=""` (空字符串)：返回根文件夹（`parent_id__isnull=True`）
- `parent=<uuid>`：返回指定文件夹的直接子文件夹

**理由**：完全向后兼容，现有调用方（legacy 视图、其他功能）不受任何影响。新的 filesystem 视图显式传递 `parent` 参数来获取层级数据。

### 5. 文件夹删除行为

**决策**：使用 `on_delete=CASCADE`，删除父文件夹时级联删除所有子文件夹。

**理由**：
- 符合文件系统语义（删除目录时删除所有子内容）
- 实现简单可靠
- MediaJob 与 ProjectFolder 是 M2M 关系，删除文件夹只解除关联，不删除 MediaJob 本身

**FileSystem 视图下的删除规则**：
- **删除文件夹**：仅当文件夹为空（无子文件夹且无 MediaJob）时允许删除。若不为空，用户在 dropdown 点击「删除」时通过 `dialogManager.show(AlertDialogPreset, {...})` 提示，不执行删除。
- **删除 MediaJob**：与现有行为一致，直接在后端软删除。

### 6. 条件渲染策略

**决策**：在 `project-list-client.tsx` 中根据 URL 搜索参数 `view` 的值条件渲染：`view=filesystem` 渲染新页面，否则渲染 legacy `ProjectPage`。

**理由**：
- 最小改动点，只修改一个文件的渲染逻辑
- 两个页面完全独立，互不干扰
- 可以共享 `ProjectListWithoutAuth` 等外层逻辑

## Data Model

### Modified Model: ProjectFolder

```python
# webserver/backend/media/models/project_folder.py
class ProjectFolder(UUIDModelMixin, TimeStampModelMixin, UserAndWorkspaceMixin, BrandMixin):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    parent = models.ForeignKey(       # ← NEW FIELD
        'self',
        null=True, blank=True,
        on_delete=models.CASCADE,
        related_name='children'
    )
    # ... existing fields (media_jobs M2M etc.) unchanged
```

### API Response: List (GET /media/project-folders/)

新增可选查询参数 `parent`，响应中每个 item 新增 `parent` 字段：

```json
// GET /media/project-folders/?parent=<uuid>&search=xxx&ordering=-created_at&page=1&page_size=20
{
    "count": 10,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": "folder-uuid-1",
            "name": "Sub Folder A",
            "description": "",
            "parent": "parent-uuid",
            "created_at": "2025-01-15T10:00:00Z",
            "updated_at": "2025-01-20T14:30:00Z",
            "workspace_id": "ws-uuid",
            "media_job_count": 5
        }
    ]
}
```

**查询参数语义**：
| `parent` 值 | 行为 | 说明 |
|-------------|------|------|
| 不传 | 返回所有文件夹 | 向后兼容，legacy 视图使用 |
| `""` (空字符串) | 返回根文件夹 | `parent_id__isnull=True` |
| `<uuid>` | 返回该文件夹的直接子文件夹 | `parent_id=<uuid>` |

### API Response: Detail (GET /media/project-folders/{id}/)

新增 `ancestors` 字段：

```json
{
    "id": "folder-uuid",
    "name": "Sub Folder B",
    "description": "",
    "parent": "parent-uuid",
    "ancestors": [
        { "id": "root-uuid", "name": "Root Folder" },
        { "id": "parent-uuid", "name": "Parent Folder" }
    ],
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-20T14:30:00Z",
    "workspace_id": "ws-uuid",
    "media_job_count": 3
}
```

`ancestors` 数组有序，从根文件夹到当前文件夹的直接父级。根文件夹自身的 `ancestors` 为空数组 `[]`。

### API: Create (POST /media/project-folders/)

新增可选 body 字段 `parent`：

```json
{
    "name": "New Folder",
    "description": "",
    "parent": "parent-uuid"   // optional, null or omitted = root
}
```

### API: Update/Move (PATCH /media/project-folders/{id}/)

支持更新 `parent` 字段（即移动文件夹）：

```json
{
    "parent": "new-parent-uuid"   // null = move to root
}
```

后端需校验不会产生循环引用（A→B→A）。

### API: Bulk Move Folders (POST /media/project-folders/bulk_move/)

新增端点，批量移动文件夹：

```json
// Request
{
    "folder_ids": ["uuid-1", "uuid-2"],
    "target_parent": "target-uuid"   // null = move to root
}

// Response: 200 OK
{
    "moved_count": 2
}
```

后端需校验：
- 不会产生循环引用
- 不能将文件夹移动到自己或自己的子孙下

## MVC Architecture Design

### Decision: 新建 ViewController vs 扩展现有 ViewController

**决策**：新建 `ProjectFileSystemViewController`，不修改现有 `ProjectListViewController`。

**理由**：
- Filesystem 视图的 URL 同步逻辑、导航行为、Manager 配置方式与 legacy 视图完全不同
- 新建 VC 无任何影响现有 legacy 视图的风险
- 两个 VC 可以复用相同的 Manager **类**（FilterManager、FolderListManager 等），但各自拥有独立的 **实例** 和不同的配置
- 新增的 BreadcrumbManager 仅 filesystem 视图需要，不应耦合到 legacy VC

**考虑的替代方案**：
- 扩展 `ProjectListViewController` 添加 mode 切换：被拒绝，因为增加 VC 复杂度且有 regression 风险

### ViewController & Manager 关系图

```
ProjectFileSystemViewController (NEW)
│
├── filterManager: ProjectFilterManager
│   ├── REUSE existing class
│   ├── EXTEND: folderFilter state 新增 parent 字段
│   └── EXTEND: folderQueryParams 返回值包含 parent
│
├── folderListManager: FolderListManager
│   ├── REUSE existing class (as-is)
│   └── 已有订阅 filterManager 变化自动 refetch 的逻辑，parent 参数通过 folderQueryParams 自动传递
│
├── folderOperateManager: FolderOperateManager
│   ├── REUSE existing class
│   ├── EXTEND: create() 支持传入 parent 参数
│   ├── NEW: moveFolder(folderId, targetParentId) 方法
│   └── NEW: bulkMoveFolders(folderIds, targetParentId) 方法
│
├── mediaJobOperateManager: MediaJobOperateManager
│   └── REUSE existing class (as-is, no changes)
│
├── selectFilesManager: SelectionManager<mediaJobResultType>
│   └── REUSE (as-is, with same mutual exclusion wiring)
│
├── selectFolderManager: SelectionManager<ProjectFolderItem>
│   └── REUSE (as-is, with same mutual exclusion wiring)
│
└── breadcrumbManager: BreadcrumbManager (NEW)
    ├── state: { currentFolderId, breadcrumbs: Array<{id, name}> }
    ├── bootstrap(folderId): fetch folder detail → build ancestors breadcrumbs
    ├── updateForFolder(folderId): re-fetch ancestors when navigation changes
    └── uses: getProjectFolderDetail API (mock in Phase 1)
```

### ViewController 核心职责

`ProjectFileSystemViewController` 作为 filesystem 视图的协调者，负责：

1. **Manager 创建与注入**：构造函数中创建所有 Manager 实例，注入 Service 依赖
2. **URL ↔ State 同步**：bootstrap 时从 URL 读取 `folderId`，同步到 filterManager 和 breadcrumbManager
3. **跨 Manager 协调**：
   - filterManager 变化 → folderListManager 自动 refetch（已有机制）
   - filterManager.folderId 变化 → mediaJob list refetch（已有机制）
   - 文件夹导航 → 同时更新 filterManager + breadcrumbManager + URL
4. **导航方法**：`navigateToFolder(folderId)` 和 `navigateToRoot()` 统一处理 URL、state、breadcrumb 更新
5. **生命周期**：`bootstrap(folderId?)` / `dispose()`

### 各 Manager 变更说明

#### BreadcrumbManager (NEW)

新建 Manager，管理面包屑导航状态。

- **State**: `currentFolderId: string | null`, `breadcrumbs: Array<{id: string, name: string}>`
- **bootstrap(folderId)**: 如果 folderId 存在，调用 `getProjectFolderDetail` 获取 ancestors 构建面包屑；根目录时 breadcrumbs 为空数组
- **updateForFolder(folderId)**: 当用户导航时，重新获取 ancestors 并更新面包屑
- **dispose()**: 清理

#### ProjectFilterManager (EXTEND)

在现有 FilterManager 基础上小幅扩展以支持 `parent` 筛选。

- **State 扩展**: `folderFilter` 新增 `parent: string` 字段（默认 `''` 表示根目录）
- **folderQueryParams 扩展**: 返回值包含 `parent` 字段，FolderListManager 的 fetch 自动携带
- **向后兼容**: Legacy 视图不设置 `parent` 字段，保持现有行为（或 `folderQueryParams` 中如 parent 为 undefined 则不传）

> 具体是直接修改 `ProjectFilterManager` 还是创建子类，在实施时视影响范围决定。如果直接修改不影响 legacy 视图（parent 不传时接口保持原行为），则优先直接修改。

#### FolderOperateManager (EXTEND)

在现有 FolderOperateManager 基础上扩展移动和创建功能。

- **create(parent?)**: 扩展现有 create 方法，支持传入 `parent` 参数
- **moveFolder(folderId, targetParentId)**: 新增方法，调用 PATCH API 修改 parent
- **bulkMoveFolders(folderIds, targetParentId)**: 新增方法，调用 bulk_move API
- 移动完成后触发 `folderListManager.refetch()`

#### ProjectFolderItem (EXTEND)

- 现有 `openFolder()` 导航到 `/projects/folder-detail`，在 legacy 视图中保持不变
- Filesystem 视图中不直接使用 `openFolder()`，而是由页面组件的 `onDoubleClick` 回调调用 VC 的 `navigateToFolder(folderId)`
- 可选：添加 `moveToFolder(targetParentId)` 便捷方法

### Page 组件与 VC 的关系

```
project-list-client.tsx
├── view=filesystem → ProjectFileSystemBootstrap
│   ├── 创建 ProjectFileSystemViewController
│   ├── Provider 包裹
│   └── ProjectFileSystemPageContent
│       ├── Header (reuse/adapt ProjectPageHeader)
│       ├── ProjectBreadcrumbNavigation ← breadcrumbManager
│       ├── FilesystemFoldersSection ← folderListManager + selectFolderManager
│       ├── FilesystemJobsSection ← mediaJobOperateManager + selectFilesManager
│       └── Batch Bars (folder / mediajob, mutual exclusive)
└── default → ProjectBootstrap (legacy, NO changes)
    └── ProjectPage
```

### 设计说明

> 以上为初始设计，具体实施时可能根据实际情况调整：
> - FilterManager 的扩展方式（直接修改 vs 子类）需要在实施时评估对 legacy 视图的影响
> - BreadcrumbManager 的具体实现可能参考 mushroom 的 `BreadcrumbManager` 思路，但代码完全独立
> - VC 与 URL 同步的具体方式（useEffect 监听 searchParams vs router subscription）在实施时确定
> - 选择互斥逻辑（selectFilesManager / selectFolderManager）的 wiring 与现有 ProjectListViewController 相同，可直接复制

## Component Structure

### Frontend 新增/修改文件

```
webserver/frontend/feature/project/
├── api/
│   └── folder.ts                              # MODIFY: add parent param, getFolderDetail, moveFolders
├── manager/
│   ├── project-list-view-controller.ts        # EXISTING (NO changes, legacy VC)
│   ├── project-filesystem-view-controller.ts  # NEW: filesystem VC, coordinates all managers
│   ├── filter-manager.ts                      # EXTEND: folderFilter.parent, folderQueryParams
│   ├── folder-list-manager.ts                 # EXISTING (as-is, auto-picks-up parent from filterManager)
│   ├── folder-operate-manager.ts              # EXTEND: create(parent), moveFolder, bulkMoveFolders
│   ├── medai-job-operate-manager.ts           # EXISTING (as-is)
│   └── breadcrumb-manager.ts                  # NEW: manage breadcrumb state, fetch ancestors
├── bootstrap/
│   ├── project-bootstrap.tsx                  # EXISTING (legacy bootstrap, NO changes)
│   ├── project-list-context.tsx               # EXISTING (legacy context, NO changes)
│   ├── project-filesystem-bootstrap.tsx       # NEW: create filesystem VC, Provider wrapper
│   └── project-filesystem-context.tsx         # NEW: context + useProjectFileSystemViewController hook
├── block/
│   ├── folder/                                # EXISTING folder components (reuse card/row)
│   ├── breadcrumb/
│   │   └── project-breadcrumb-navigation.tsx  # NEW: breadcrumb UI component
│   └── move-folder/
│       └── move-folder-dialog.tsx             # NEW: dialog to select target folder
├── page/
│   ├── project-list-client.tsx                # MODIFY: add conditional render for view=filesystem
│   ├── project-page.tsx                       # EXISTING (legacy, NO changes)
│   └── project-list-filesystem/
│       ├── index.tsx                          # NEW: ProjectListFileSystemPage entry
│       ├── filesystem-page-content.tsx        # NEW: page layout with sections
│       ├── filesystem-folders-section.tsx     # NEW: folder cards/table for current folder
│       └── filesystem-jobs-section.tsx        # NEW: media jobs list for current folder
├── type/
│   └── folder.ts                              # MODIFY: add parent, ancestors, move types
├── entity/
│   └── project-folder-item.ts                 # EXISTING (minor extend if needed)
└── mock/
    └── project-list-filesystem-mock.ts        # NEW (Phase 1 only): mock data, remove in Phase 3
```

### Backend 新增/修改文件

```
webserver/backend/media/
├── models/
│   └── project_folder.py                      # MODIFY: add parent FK
├── serializers/
│   └── project_folder.py                      # MODIFY: add parent field, ancestors, move serializer
├── views/
│   └── project_folder.py                      # MODIFY: add parent filter, bulk_move action
└── migrations/
    └── xxxx_add_parent_to_projectfolder.py    # NEW: migration for parent field
```

## Architecture Patterns

- **Manager Pattern**：遵循项目架构规范（`.project-rules/frontend/architecture.md`），新建 `ProjectFileSystemViewController` 协调多个 Manager，各 Manager 封装独立领域逻辑
- **新建 VC 而非扩展**：filesystem 视图拥有独立的 `ProjectFileSystemViewController`，与 legacy 的 `ProjectListViewController` 完全隔离，两者复用相同 Manager 类但持有独立实例
- **URL-Driven State**：`folderId` 和 `view` 参数从 URL search params 读取，VC 在 bootstrap 和导航时同步到 FilterManager 和 BreadcrumbManager
- **构造器注入**：Service 通过 `useServices()` 获取，然后注入到 VC 构造函数；Manager 实例在 bootstrap 组件中通过 `useState` 创建
- **生命周期管理**：`bootstrap()` / `dispose()` 遵循架构规范，使用 `DisposerManager` 统一管理副作用
- **Props 解构规范**：所有组件遵循 `(props: PropsType)` 签名 + 函数体内解构（`.project-rules/frontend/coding-conventions.md`）
- **Entity Pattern**：`ProjectFolderItem` 封装文件夹数据和行为，filesystem 视图通过 VC 导航方法替代 entity 的 `openFolder()`
- **Mock-First Development**：Phase 1 使用集中的 mock 文件，所有 mock 标记清晰（`// MOCK: Remove in Phase 3`），Phase 3 统一移除
- **Conditional Rendering**：`project-list-client.tsx` 根据 URL 参数选择 bootstrap + page 组件，新旧完全独立

## Risks / Trade-offs

### Risk: 循环引用

**风险**：移动文件夹时可能产生循环引用（A 移动到 B 下，而 B 是 A 的子孙）。

**缓解措施**：
- 后端在 PATCH (move) 和 bulk_move 时，遍历 target_parent 的祖先链，校验不包含被移动的文件夹
- 前端 dialog 中禁止选择被移动文件夹的子孙作为目标

### Risk: 深度嵌套性能

**风险**：文件夹嵌套过深时，ancestors 查询可能变慢。

**缓解措施**：
- ProjectFolder 预期数据量不大（每个 workspace 通常几十到几百个文件夹），递归查询可接受
- 暂不限制深度，后续可根据实际使用情况添加限制

### Risk: Mock/真实 API 不匹配

**风险**：Phase 1 使用 mock 数据开发，Phase 3 集成时可能发现 API contract 不匹配。

**缓解措施**：
- Phase 0 严格锁定 API contract，mock 数据完全按 contract 构造
- 集中 mock 在单个文件中，Phase 3 可一次性替换

### Trade-off: 向后兼容 vs 简洁性

**决策**：`parent` 参数不传时返回所有文件夹（而非默认根目录）。

**影响**：
- 优点：完全向后兼容，现有调用方无需任何修改
- 缺点：filesystem 视图每次都需要显式传递 `parent` 参数
- 权衡：兼容性优先，filesystem 视图传参是可控的

## Open Questions

无（所有问题已在与用户确认中解决）。

## Migration Plan

### Steps

1. **Phase 0**：锁定 API contract（T-001）
2. **Phase 1**：前端 mock 开发（T-002 ~ T-007），可与 Phase 2 并行
3. **Phase 2**：后端实现（T-008 ~ T-010）
4. **Phase 3**：移除 mock，集成真实 API，E2E 验证（T-011）

### Rollback

- **前端**：移除 `project-list-client.tsx` 中的 `view=filesystem` 条件分支即可禁用新视图，legacy 视图无任何改动
- **后端**：`parent` 字段为 nullable，不影响现有行为；migration 可逆（remove field）
- **数据**：现有文件夹 parent 全部为 null，无数据迁移风险；新创建的带 parent 的文件夹在回滚后会变为根目录文件夹

## References

- 实现计划：`.doc/projects-list-filesystem-plan.md`
- 前端架构规范：`.project-rules/frontend/architecture.md`
- 前端目录结构规范：`.project-rules/frontend/directory-structure.md`
- 后端规范：`.project-rules/backend/index.md`
- Mushroom 参考实现：`webserver/frontend/feature/mushroom/sub-feature/project-management/`
- 现有前端项目列表：`webserver/frontend/feature/project/`
- 现有后端文件夹模型：`webserver/backend/media/models/project_folder.py`
- 现有后端文件夹 API：`webserver/backend/media/views/project_folder.py`
