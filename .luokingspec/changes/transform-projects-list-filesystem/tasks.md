# Phase 0 – API Contract

---

# T-001 定义并锁定 API Contract

## 需求描述

**Infrastructure：定义所有受影响端点的 API contract**

在开始任何前端或后端实现之前，明确定义并记录所有受影响的 API 端点的请求/响应格式。此 contract 是 Phase 1（前端 mock）和 Phase 2（后端实现）的共同依据。

**需求类型**：Infrastructure

**涉及领域**：全栈

### 需要定义的端点

1. **GET /media/project-folders/** (List)
   - 新增可选查询参数 `parent`（uuid | 空字符串）
   - `parent` 不传 → 返回所有文件夹（现有行为）
   - `parent=""` → 返回根文件夹（`parent_id__isnull=True`）
   - `parent=<uuid>` → 返回该文件夹的直接子文件夹
   - 响应每个 item 新增 `parent` 字段（uuid | null）

2. **GET /media/project-folders/{id}/** (Detail)
   - 响应新增 `ancestors` 字段：从根到直接父级的有序数组 `[{id, name}, ...]`
   - 响应新增 `parent` 字段

3. **POST /media/project-folders/** (Create)
   - 请求 body 新增可选 `parent` 字段（uuid | null）
   - 省略 `parent` 或传 null → 创建为根文件夹

4. **PATCH /media/project-folders/{id}/** (Update)
   - 支持更新 `parent` 字段（即移动文件夹）
   - 后端需校验不会产生循环引用

5. **POST /media/project-folders/bulk_move/** (新端点)
   - 请求：`{ folder_ids: uuid[], target_parent: uuid | null }`
   - 响应：`{ moved_count: number }`
   - 校验不会产生循环引用、不能移动到自己或子孙下

### 输出物

在 `design.md` 的 Data Model 部分已包含完整的 API contract 定义（请求参数、响应格式、语义说明）。本任务确认 contract 无遗漏并冻结。

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式和 API 调用规范

**后端规则:**
- `.project-rules/backend/index.md` - API 设计规范

**前端Code Point:**
- `webserver/frontend/feature/project/api/folder.ts` - 现有文件夹 API 函数
- `webserver/frontend/feature/project/type/folder.ts` - 现有文件夹类型定义

**后端Code Point:**
- `webserver/backend/media/views/project_folder.py` - 现有 ViewSet
- `webserver/backend/media/serializers/project_folder.py` - 现有 Serializer

**其他:**
- `design.md` 中的 Data Model 章节 - 完整的 API contract 定义

## 注意点

- 向后兼容性是最高优先级：`parent` 参数不传时必须保持现有行为
- `ancestors` 数据结构要足够轻量，只返回 `{id, name}`，避免返回完整的文件夹对象
- bulk_move 需要定义清晰的错误响应格式（循环引用、文件夹不存在等）
- 确保 contract 与 `design.md` 中的定义完全一致

## Scenario

### Scenario 1: 审查并冻结 API contract

**场景描述：**
- **前置条件**：`design.md` 中已定义初版 API contract
- **操作步骤**：
  1. 审查 design.md 中所有端点定义
  2. 检查是否有遗漏的端点或字段
  3. 确认错误响应格式
  4. 冻结 contract，后续以此为准
- **预期结果**：
  - 所有端点的请求参数、响应格式、语义均已明确
  - 前端和后端可以基于此 contract 独立开发

## Checklist

- [x] C-001 GET list 的 `parent` 参数三种语义（不传/空字符串/uuid）已明确定义
- [x] C-002 GET detail 的 `ancestors` 响应格式已定义，包含字段和排序规则
- [x] C-003 POST create 的 `parent` 可选字段已定义
- [x] C-004 PATCH update 的 `parent` 字段更新语义已定义，包含循环引用校验
- [x] C-005 POST bulk_move 端点的请求/响应格式已定义，包含错误场景
- [x] C-006 所有端点定义与 design.md 一致且无遗漏

---

# Phase 1 – Frontend Only (Mock)

---

# T-002 Frontend API 类型定义与 Mock 层 (deps: T-001)

## 需求描述

**Infrastructure：定义前端 API 类型并创建 mock 数据层**

基于 T-001 锁定的 API contract，在前端定义所有新增/修改的类型，并创建集中的 mock 数据文件。Mock 层为 Phase 1 中所有前端任务提供数据基础，所有 mock 集中在一个文件中，便于 Phase 3 统一替换。

**需求类型**：Infrastructure

**涉及领域**：前端

### 1. 类型定义

在 `webserver/frontend/feature/project/type/folder.ts` 中扩展：

- `ProjectFolderResultItemType` 新增 `parent: string | null` 字段
- 新增 `ProjectFolderAncestorType`：`{ id: string; name: string }`
- 新增 `ProjectFolderDetailType`：扩展 list item，添加 `ancestors: ProjectFolderAncestorType[]`
- 新增 `MoveFoldersRequestType`：`{ folder_ids: string[]; target_parent: string | null }`
- 新增 `MoveFoldersResponseType`：`{ moved_count: number }`

### 2. API 函数签名

在 `webserver/frontend/feature/project/api/folder.ts` 中扩展：

- `getProjectFolderList` 参数新增可选 `parent?: string`
- 新增 `getProjectFolderDetail(id: string)` 函数签名（返回包含 ancestors 的详情）
- 新增 `moveProjectFolders(data: MoveFoldersRequestType)` 函数签名
- `createProjectFolder` 参数新增可选 `parent?: string | null`

### 3. Mock 数据文件

创建 `webserver/frontend/feature/project/mock/project-list-filesystem-mock.ts`：

- 构造至少 2 层文件夹层级的 mock 数据（根 → 子文件夹 → 孙文件夹）
- 提供 mock 函数：`mockGetFolderList(parent)`、`mockGetFolderDetail(id)`、`mockMoveFolders`、`mockCreateFolder`
- Mock 数据须严格符合 T-001 的 API contract
- 所有 mock 标记清晰（如注释 `// MOCK: Remove in Phase 3`）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - API 层规范
- `.project-rules/frontend/directory-structure.md` - `api/`、`type/`、`mock/` 目录职责

**前端Code Point:**
- `webserver/frontend/feature/project/api/folder.ts` - 现有文件夹 API 函数
- `webserver/frontend/feature/project/type/folder.ts` - 现有文件夹类型定义（`ProjectFolderResultItemType` schema）

**其他:**
- `design.md` Data Model 章节 - API contract 定义

## 注意点

- 类型定义必须与 API contract 严格一致
- Mock 数据需要覆盖根文件夹、子文件夹、空文件夹等场景
- Mock 文件应创建在 `mock/` 目录下（注意：目录结构规范未列出 `mock/`，但这是临时的 Phase 1 文件，Phase 3 会删除）
- API 函数签名此时只定义接口，实际调用在 Phase 1 中可能暂时调用 mock

## Scenario

### Scenario 1: Mock 数据层提供文件夹层级数据

**场景描述：**
- **前置条件**：类型和 mock 文件已创建
- **操作步骤**：
  1. 调用 `mockGetFolderList("")` 获取根文件夹列表
  2. 调用 `mockGetFolderList("folder-uuid")` 获取子文件夹列表
  3. 调用 `mockGetFolderDetail("sub-folder-uuid")` 获取文件夹详情含 ancestors
- **预期结果**：
  - 根文件夹列表返回 parent 为 null 的文件夹
  - 子文件夹列表返回 parent 为指定 uuid 的文件夹
  - 文件夹详情包含正确的 ancestors 数组

## Checklist

- [x] C-001 `ProjectFolderResultItemType` 已新增 `parent` 字段
- [x] C-002 `ProjectFolderAncestorType` 和 `ProjectFolderDetailType` 类型已定义
- [x] C-003 `MoveFoldersRequestType` 和 `MoveFoldersResponseType` 类型已定义
- [x] C-004 `getProjectFolderList` 参数已扩展支持 `parent`
- [x] C-005 `getProjectFolderDetail` 和 `moveProjectFolders` 函数签名已定义
- [x] C-006 Mock 数据文件已创建，包含至少 2 层层级数据
- [x] C-007 所有 mock 函数可正常调用并返回符合 contract 的数据
- [x] C-008 所有 mock 标记清晰（`// MOCK: Remove in Phase 3`）

---

# T-003 入口、页面骨架、MVC 架构与 URL/状态同步 (deps: T-002)

## 需求描述

**Infrastructure + Feature：创建 filesystem 页面的 MVC 架构基础**

新建 `ProjectFileSystemViewController`（独立于现有 `ProjectListViewController`），创建对应的 Bootstrap/Context/Page 组件，在 `project-list-client.tsx` 中添加条件渲染逻辑，实现 URL 参数与状态管理器的双向同步。此任务建立整个 filesystem 视图的 MVC 骨架。

**需求类型**：Infrastructure

**涉及领域**：前端

### 1. 入口条件渲染

修改 `webserver/frontend/feature/project/page/project-list-client.tsx`：

- 读取 URL search param `view`
- `view=filesystem` → 渲染 `ProjectFileSystemBootstrap` + `ProjectListFileSystemPage`
- 其他值或缺省 → 渲染现有 `ProjectBootstrap` + `ProjectPage`（legacy 视图）
- 保持 `ProjectListWithoutAuth` 和 analytics 行为对两个视图都生效

### 2. ProjectFileSystemViewController（新建 VC）

创建 `webserver/frontend/feature/project/manager/project-filesystem-view-controller.ts`：

独立的 ViewController，与 `ProjectListViewController` 完全隔离。复用相同的 Manager **类**，但持有独立**实例**。

**构造函数注入**（参考现有 `ProjectListViewController` 的模式）：
- `organizationService: IOrganizationService`
- `brandSpaceService: IBrandSpaceService`
- `filterManager: ProjectFilterManager`（with filesystem-specific defaults）
- `folderListManager: FolderListManager`
- `folderOperateManager: FolderOperateManager`
- `mediaJobOperateManager: MediaJobOperateManager`
- `selectFilesManager: SelectionManager<mediaJobResultType>`（with mutual exclusion）
- `selectFolderManager: SelectionManager<ProjectFolderItem>`（with mutual exclusion）
- `breadcrumbManager: BreadcrumbManager`（新建，见下方）

**核心职责**：
- **bootstrap(folderId?)**：
  1. 从 URL 读取 `folderId`
  2. 同步到 `filterManager`（设置 `folderFilter.parent`、`mediaJobFilter.folderId`、`mediaJobFilter.noFolder`）
  3. 初始化 `breadcrumbManager` 获取 ancestors
  4. 触发 folderList 和 mediaJob list 数据加载
- **navigateToFolder(folderId)**：统一处理文件夹导航——更新 URL search params + filterManager state + breadcrumbManager
- **navigateToRoot()**：清除 folderId，重置到根目录状态
- **dispose()**：清理所有订阅和 Manager

**选择互斥逻辑**：与现有 `ProjectListViewController` 相同——override `selectFilesManager.select` 和 `selectFolderManager.select`，互斥时 Toast 提示。

### 3. BreadcrumbManager（新建）

创建 `webserver/frontend/feature/project/manager/breadcrumb-manager.ts`：

- **State**: `currentFolderId: string | null`、`breadcrumbs: Array<{id: string; name: string}>`、`loading: boolean`
- **bootstrap(folderId)**：如果 folderId 存在，调用 `getProjectFolderDetail`（Phase 1 用 mock）获取 ancestors 构建面包屑链；根目录时 breadcrumbs 为空数组
- **updateForFolder(folderId)**：当导航到新文件夹时，重新获取 ancestors 并更新面包屑
- **dispose()**：清理

### 4. FilterManager 扩展

扩展 `ProjectFilterManager` 的 `folderFilter` state 和 `folderQueryParams`：

- `folderFilter` 新增 `parent?: string` 字段
- `folderQueryParams` getter 在 `parent` 存在时返回 `parent` 参数
- 向后兼容：legacy 视图不设置 `parent`，`folderQueryParams` 中 `parent` 为 undefined 时不传该参数，保持现有行为

> 具体是直接修改 `ProjectFilterManager` 还是创建子类，在实施时视影响范围决定。

### 5. Bootstrap 与 Context

创建 `webserver/frontend/feature/project/bootstrap/`：

- `project-filesystem-bootstrap.tsx`：
  - 使用 `useServices()` 获取 Service
  - `useState` 创建各 Manager 实例和 VC 实例（确保只创建一次）
  - `useEffect` 管理 `bootstrap(folderId)` / `dispose()` 生命周期
  - 当 URL 中 `folderId` 变化时，调用 VC 的 `navigateToFolder` 重新同步
  - 用 `ProjectFileSystemProvider` 包裹 children
- `project-filesystem-context.tsx`：
  - `ProjectFileSystemViewControllerContext` + `ProjectFileSystemProvider`
  - `useProjectFileSystemViewController()` hook

### 6. 页面骨架

创建 `webserver/frontend/feature/project/page/project-list-filesystem/`：

- `index.tsx`：`ProjectListFileSystemPage` 入口，使用 `ProjectFileSystemBootstrap` 包裹
- `filesystem-page-content.tsx`：页面布局组件
  - Header 区域（复用或适配 `ProjectPageHeader`）
  - Breadcrumb 区域（T-004 实现，先用占位）
  - Folders section（T-005 实现，先用占位）
  - Media jobs section（T-007 实现，先用占位）
  - Batch operation bars（T-007 实现，先用占位）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - ViewController 协调多个 Manager 的完整示例、构造器注入、生命周期管理、Context Provider 模式、状态访问规范
- `.project-rules/frontend/coding-conventions.md` - 组件 Props 解构规范（`props: PropsType` + 函数体内解构）
- `.project-rules/frontend/directory-structure.md` - page/、manager/、bootstrap/ 目录职责

**前端Code Point:**
- `webserver/frontend/feature/project/page/project-list-client.tsx` - 入口文件，添加条件渲染
- `webserver/frontend/feature/project/manager/project-list-view-controller.ts` - 现有 VC，参考结构和选择互斥逻辑
- `webserver/frontend/feature/project/bootstrap/project-bootstrap.tsx` - 现有 Bootstrap，参考 VC 创建和 Provider 包裹模式
- `webserver/frontend/feature/project/bootstrap/project-list-context.tsx` - 现有 Context，参考 Provider 和 hook 模式
- `webserver/frontend/feature/project/manager/filter-manager.ts` - 现有 FilterManager，扩展 folderFilter
- `webserver/frontend/feature/project/manager/folder-list-manager.ts` - 现有 FolderListManager，了解如何订阅 filterManager
- `webserver/frontend/feature/mushroom/sub-feature/project-management/page/layout.tsx` - Mushroom 参考：URL 同步逻辑
- `webserver/frontend/feature/mushroom/manager/breadcrumb-manager.ts` - Mushroom 参考：面包屑管理思路

**前端路由:**
- `/projects/list` - 项目列表路由
- `/projects/list?view=filesystem` - filesystem 视图
- `/projects/list?view=filesystem&folderId=xxx` - 子文件夹视图

## 注意点

- **新建 VC 而非扩展**：`ProjectFileSystemViewController` 是独立类，不继承或修改 `ProjectListViewController`，避免 regression
- **Manager 复用**: 使用相同的 Manager 类（FilterManager、FolderListManager 等），但每次创建独立实例，配置可能不同
- **选择互斥**: 与现有 VC 相同的 override select 方式实现，可直接参考/复制现有代码
- **URL 同步**: 需要考虑浏览器前进/后退（history 变化时重新同步），可能需要监听 searchParams 变化
- **BreadcrumbManager**: Phase 1 中使用 mock 数据获取文件夹详情
- **页面骨架**: 各 section 先用占位组件，由后续任务（T-004/T-005/T-007）实现

## Scenario

### Scenario 1: URL 参数切换视图

**场景描述：**
- **前置条件**：项目列表路由已加载
- **操作步骤**：
  1. 访问 `/projects/list` → 看到 legacy 视图（ProjectBootstrap + ProjectPage）
  2. 访问 `/projects/list?view=filesystem` → 看到 filesystem 视图骨架（ProjectFileSystemBootstrap + FileSystemPage）
  3. 访问 `/projects/list?view=filesystem&folderId=xxx` → filesystem 视图显示子文件夹状态
- **预期结果**：
  - 条件渲染正确切换两个完全独立的 Bootstrap + Page
  - filesystem 视图正确读取 folderId 并同步到 VC 和 Manager

### Scenario 2: 浏览器前进/后退

**场景描述：**
- **前置条件**：在 filesystem 视图中进行了多次文件夹导航
- **操作步骤**：
  1. 从根目录 → navigateToFolder(A) → navigateToFolder(B)
  2. 点击浏览器后退
- **预期结果**：
  - URL 回到 Folder A 状态
  - VC 检测到 folderId 变化，调用 navigateToFolder(A)
  - FilterManager、BreadcrumbManager、列表数据全部同步更新

## Checklist

- [x] C-001 `project-list-client.tsx` 根据 `view=filesystem` 条件渲染不同的 Bootstrap + Page
- [x] C-002 `ProjectFileSystemViewController` 创建完成，构造函数注入所有 Manager 和 Service
- [x] C-003 VC 的 `bootstrap(folderId)` 正确同步 URL → FilterManager → BreadcrumbManager
- [x] C-004 VC 的 `navigateToFolder(folderId)` 统一更新 URL + FilterManager + BreadcrumbManager
- [x] C-005 `BreadcrumbManager` 创建完成，可以通过 mock 数据构建面包屑链
- [x] C-006 `ProjectFilterManager` 的 `folderQueryParams` 扩展支持 `parent` 参数
- [x] C-007 `ProjectFileSystemBootstrap` 和 Context 创建完成，遵循现有 Bootstrap 模式
- [x] C-008 浏览器前进/后退时，状态正确同步
- [x] C-009 legacy 视图（无 `view=filesystem` 参数时）行为完全不受影响
- [x] C-010 组件 Props 解构遵循 coding-conventions 规范

---

# T-004 面包屑导航组件 (deps: T-003)

## 需求描述

**Feature：实现面包屑导航 UI 组件**

创建项目面包屑导航组件，展示从根目录到当前文件夹的完整路径，支持点击任意层级进行导航。此组件在 project feature 内独立实现，不依赖 mushroom 的面包屑组件。

**需求类型**：Feature

**涉及领域**：前端

### 1. 组件设计

创建 `webserver/frontend/feature/project/block/breadcrumb/project-breadcrumb-navigation.tsx`：

- **根目录显示**："Projects" 作为固定首项
- **面包屑路径**：根据 `BreadcrumbManager` 的 `breadcrumbs` 状态渲染层级
- **交互**：
  - 点击 "Projects" → 导航到根目录（清除 folderId）
  - 点击中间层级 → 导航到该文件夹（更新 folderId）
  - 当前层级（最后一项）不可点击，显示为非链接样式
- **分隔符**：使用 `/` 或 `>` 分隔各层级

### 2. UI 样式

```
Projects / Folder A / Sub Folder B
  ↑ 可点击    ↑ 可点击    ↑ 当前（不可点击）
```

- 可点击项：`text-sm text-muted-foreground hover:text-foreground cursor-pointer`
- 当前项：`text-sm text-foreground font-medium`
- 分隔符：`text-sm text-muted-foreground mx-1`

### 3. 与 ProjectFileSystemViewController 集成

- 通过 `useProjectFileSystemViewController()` 获取 VC 实例
- 从 `vc.breadcrumbManager.store` 订阅 `breadcrumbs` 状态
- 导航操作调用 `vc.navigateToFolder(id)` 或 `vc.navigateToRoot()`（由 VC 统一处理 URL + state + breadcrumb 更新）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 组件从 Manager 获取数据的规范
- `.project-rules/frontend/directory-structure.md` - block/ 目录用于可复用业务组件

**前端Code Point:**
- `webserver/frontend/feature/project/manager/breadcrumb-manager.ts` - 面包屑状态管理（T-003 创建）
- `webserver/frontend/feature/project/manager/project-filesystem-view-controller.ts` - VC，提供 navigateToFolder/navigateToRoot
- `webserver/frontend/feature/project/bootstrap/project-filesystem-context.tsx` - useProjectFileSystemViewController hook
- `webserver/frontend/feature/mushroom/sub-feature/project-management/block/breadcrumb-navigation.tsx` - Mushroom 参考：面包屑 UI 实现（只参考交互逻辑，不导入）

**其他:**
- `webserver/frontend/component/ui` - 项目内部 UI 组件库，可能有 Breadcrumb 基础组件可复用

## 注意点

- 不导入任何 mushroom 组件，但可以参考其面包屑的交互逻辑
- 面包屑路径很深时需要考虑折叠显示（如超过 5 级时中间层级用 `...` 代替），但初始版本可不实现
- 导航时需要同时更新 URL 和 BreadcrumbManager 状态，保持一致

## Scenario

### Scenario 1: 面包屑显示当前层级路径

**场景描述：**
- **前置条件**：用户在 `/projects/list?view=filesystem&folderId=sub-folder-id`
- **操作步骤**：
  1. 页面加载，BreadcrumbManager 从 mock 获取 ancestors
  2. 面包屑组件渲染
- **预期结果**：
  - 显示 "Projects / Parent Folder / Current Folder"
  - "Projects" 和 "Parent Folder" 可点击
  - "Current Folder" 为当前项，不可点击

### Scenario 2: 点击面包屑导航

**场景描述：**
- **前置条件**：面包屑显示 "Projects / Folder A / Folder B"
- **操作步骤**：
  1. 点击 "Folder A"
- **预期结果**：
  - URL 更新为 `?view=filesystem&folderId=folder-a-id`
  - BreadcrumbManager 状态更新
  - 页面内容切换到 Folder A 的子文件夹和 MediaJob

## Checklist

- [x] C-001 面包屑组件创建完成，从 BreadcrumbManager 获取数据
- [x] C-002 根目录显示 "Projects" 作为固定首项
- [x] C-003 中间层级可点击，点击后正确导航（URL 和状态同步更新）
- [x] C-004 当前层级（最后一项）不可点击
- [x] C-005 在根目录时，面包屑只显示 "Projects"
- [x] C-006 不依赖任何 mushroom 组件

---

# T-005 文件夹区域（列表、双击导航、单项 Dropdown）(deps: T-003)

## 需求描述

**Feature：实现 filesystem 视图的文件夹列表区域**

在 filesystem 页面中实现文件夹区域，展示当前文件夹的子文件夹列表，支持双击进入、单项 dropdown 操作菜单（重命名、删除、移动到）和多选。数据来源为 mock。

**需求类型**：Feature

**涉及领域**：前端

### 1. 文件夹列表

创建 `webserver/frontend/feature/project/page/project-list-filesystem/filesystem-folders-section.tsx`：

- 展示当前文件夹的子文件夹（通过 `folderListManager` 获取，数据来自 mock，使用 `parent` 参数筛选）
- 支持卡片视图（card）和列表视图（table），复用现有的 `ProjectFolderCard` 和 `ProjectFolderRow` 组件
- 文件夹信息展示：图标、名称、包含的 MediaJob 数量、创建/更新时间
- 空状态：当前文件夹下无子文件夹时显示空状态提示

### 2. 双击导航

- 双击文件夹 → 调用 `vc.navigateToFolder(folderId)`（VC 统一处理 URL + state + breadcrumb 更新）
- 参考 mushroom 的双击实现方式（桌面端使用 `onDoubleClick` 事件）
- 单击文件夹 → 选中/取消选中（用于批量操作）
- 注意：**不使用** `ProjectFolderItem.openFolder()`（那是 legacy 导航到 folder-detail 页面），而是通过 VC 导航

### 3. 单项 Dropdown 操作菜单

每个文件夹行/卡片右侧有 dropdown 菜单，包含：

- **打开**：进入该文件夹（等同双击）
- **重命名**：打开重命名 dialog（复用现有 rename 逻辑和 `folderOperateManager`）
- **移动到**：打开移动文件夹 dialog（T-006 实现，此处先预留入口）
- **删除**：若文件夹非空（有子文件夹或 MediaJob）则用 `dialogManager.show(AlertDialogPreset, {...})` 提示不允许删除；若为空则打开确认 dialog，确认后删除（复用现有 delete 逻辑和 `folderOperateManager`）

### 4. 选择功能

- 支持单选和多选（checkbox）
- 选中文件夹后显示批量操作栏（复用现有 `ProjectFolderBatchOperationBar`，但需扩展支持"移动到"）
- 文件夹选择与 MediaJob 选择互斥（与现有逻辑一致）

### 5. 创建子文件夹

- 在 filesystem 视图中，"新建文件夹"操作需要携带当前 `folderId` 作为 `parent`
- 复用现有创建文件夹的 dialog/modal，扩展 `folderOperateManager` 的 create 方法支持 `parent` 参数

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式，从 Manager 获取数据
- `.project-rules/frontend/directory-structure.md` - page/ 下的子组件组织

**前端Code Point:**
- `webserver/frontend/feature/project/block/folder/folder-list/project-folder-list.tsx` - 现有文件夹列表（切换 card/table）
- `webserver/frontend/feature/project/block/folder/project-folder-card.tsx` - 现有文件夹卡片组件
- `webserver/frontend/feature/project/block/folder/project-folder-row.tsx` - 现有文件夹行组件
- `webserver/frontend/feature/project/entity/project-folder-item.ts` - 文件夹实体（含 delete、rename、select、openFolder 方法）
- `webserver/frontend/feature/project/manager/folder-list-manager.ts` - 文件夹列表管理器
- `webserver/frontend/feature/project/manager/folder-operate-manager.ts` - 文件夹操作管理器（create、delete）
- `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/folders-section.tsx` - Mushroom 参考：文件夹 section

**前端路由:**
- `/projects/list?view=filesystem&folderId=xxx` - 导航目标

## 注意点

- **不修改** `ProjectFolderItem.openFolder()`（保持 legacy 行为），filesystem 视图中使用 `vc.navigateToFolder(folderId)` 替代
- `FolderListManager` 目前不支持 `parent` 参数，T-003 已扩展 FilterManager 的 `folderQueryParams` 包含 `parent`，FolderListManager 的 fetch 自动携带
- 通过 `useProjectFileSystemViewController()` 获取 VC 实例
- 文件夹 dropdown 的"移动到"选项先预留 onClick 入口，T-006 实现 dialog 后再连接
- 批量操作栏的"移动到"按钮同理

## Scenario

### Scenario 1: 查看当前文件夹的子文件夹

**场景描述：**
- **前置条件**：在 filesystem 视图中，当前 folderId 为某个文件夹
- **操作步骤**：
  1. 页面加载，folderListManager 使用 parent 参数获取子文件夹（mock）
  2. 渲染文件夹列表
- **预期结果**：
  - 只展示当前文件夹的直接子文件夹
  - 卡片/列表正确显示文件夹信息

### Scenario 2: 双击进入子文件夹

**场景描述：**
- **前置条件**：文件夹列表中有子文件夹
- **操作步骤**：
  1. 双击 "Folder A"
- **预期结果**：
  - URL 更新为 `?view=filesystem&folderId=folder-a-id`
  - 面包屑更新
  - 列表刷新为 Folder A 的子文件夹

### Scenario 3: 创建子文件夹

**场景描述：**
- **前置条件**：在某个文件夹内
- **操作步骤**：
  1. 点击"新建文件夹"
  2. 输入名称，确认
- **预期结果**：
  - 文件夹创建在当前目录下（parent = 当前 folderId）
  - 列表刷新显示新文件夹

## Checklist

- [x] C-001 文件夹区域组件创建完成，展示当前 folderId 的子文件夹
- [x] C-002 支持卡片和列表两种视图模式
- [x] C-003 双击文件夹可以导航进入（URL 和状态同步更新）
- [x] C-004 单项 dropdown 包含打开、重命名、删除操作且正常工作
- [x] C-005 单项 dropdown 包含"移动到"入口（T-006 连接）
- [x] C-006 选择功能正常，支持单选和多选
- [x] C-007 创建子文件夹时携带当前 folderId 作为 parent
- [x] C-008 空状态正确展示
- [x] C-009 现有 legacy 视图的文件夹列表行为不受影响

---

# T-006 移动文件夹 Dialog (deps: T-005)

## 需求描述

**Feature：实现移动文件夹的目标选择 Dialog**

创建一个可复用的 dialog 组件，让用户选择目标文件夹来移动一个或多个文件夹。Dialog 展示文件夹树结构，支持展开/收起层级，选择目标后确认移动。交互方式参考 mushroom 的移动 dialog。

**需求类型**：Feature

**涉及领域**：前端

### 1. Dialog 组件

创建 `webserver/frontend/feature/project/block/move-folder/move-folder-dialog.tsx`：

- **触发方式**：从文件夹单项 dropdown "移动到" 或批量操作栏 "移动到" 按钮打开
- **内容**：
  - 标题："移动到..."
  - 文件夹树结构，展示所有文件夹层级
  - "根目录" 作为特殊选项（移动到根目录）
  - 当前被移动的文件夹及其子孙文件夹灰显不可选（防止循环引用）
- **操作**：
  - 选择目标文件夹 → 高亮显示
  - 确认 → 调用移动 API（Phase 1 用 mock）
  - 取消 → 关闭 dialog

### 2. 文件夹树组件

- 可以是简单的缩进列表（不需要完整的 tree view）
- 每个文件夹项：文件夹图标 + 名称，可展开/收起查看子文件夹
- 需要按需加载子文件夹数据（或 Phase 1 中一次性加载 mock 数据）

### 3. 与 FolderOperateManager 集成

扩展 `FolderOperateManager`：

- 新增 `moveFolder(folderId: string, targetParentId: string | null)` 方法
- 新增 `bulkMoveFolders(folderIds: string[], targetParentId: string | null)` 方法
- 移动完成后刷新文件夹列表

### 4. 连接入口

- 连接 T-005 中文件夹 dropdown 的"移动到"选项
- 连接批量操作栏的"移动到"按钮

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 处理业务逻辑
- `.project-rules/frontend/directory-structure.md` - block/ 目录存放可复用业务组件

**前端Code Point:**
- `webserver/frontend/feature/project/manager/folder-operate-manager.ts` - 现有文件夹操作管理器
- `webserver/frontend/feature/project/block/folder/move-folder.modal.tsx` - 现有移动 MediaJob 到文件夹的 dialog（参考 UI 模式）
- `webserver/frontend/feature/mushroom/sub-feature/project-management/` - Mushroom 参考：移动操作的交互模式

## 注意点

- 防止循环引用：被移动的文件夹及其所有子孙文件夹不能作为目标
- Phase 1 中使用 mock 数据，文件夹树可以是扁平数据构建的树结构
- Dialog 关闭时需要清理选择状态
- 移动成功后需要刷新当前文件夹列表和面包屑

## Scenario

### Scenario 1: 单个文件夹移动

**场景描述：**
- **前置条件**：在 filesystem 视图中，有多个文件夹
- **操作步骤**：
  1. 点击文件夹 A 的 dropdown → "移动到"
  2. Dialog 打开，展示文件夹树
  3. 选择 "Folder B" 作为目标
  4. 点击确认
- **预期结果**：
  - Folder A 移动到 Folder B 下
  - 当前列表刷新，Folder A 消失（已移到 Folder B 内）

### Scenario 2: 批量移动文件夹

**场景描述：**
- **前置条件**：选中了多个文件夹
- **操作步骤**：
  1. 批量操作栏点击 "移动到"
  2. Dialog 打开，选择目标文件夹
  3. 确认
- **预期结果**：
  - 所有选中文件夹移动到目标文件夹下
  - 列表刷新

### Scenario 3: 防止循环引用

**场景描述：**
- **前置条件**：Folder A 包含 Sub Folder B
- **操作步骤**：
  1. 尝试将 Folder A 移动到 Sub Folder B
- **预期结果**：
  - Dialog 中 Sub Folder B 及其子孙灰显不可选
  - 无法完成移动操作

## Checklist

- [x] C-001 移动文件夹 dialog 创建完成，可以从 dropdown 和批量操作栏打开
- [x] C-002 Dialog 展示文件夹树结构，支持选择目标
- [x] C-003 "根目录" 作为特殊选项可选
- [x] C-004 被移动的文件夹及其子孙不可选（灰显）
- [x] C-005 `FolderOperateManager` 已扩展 moveFolder/bulkMoveFolders 方法
- [x] C-006 移动完成后列表正确刷新
- [x] C-007 Dialog 取消/关闭时状态正确清理

---

# T-007 MediaJob 区域与批量操作 (deps: T-003)

## 需求描述

**Feature：实现 filesystem 视图的 MediaJob 列表区域和批量操作**

在 filesystem 页面中实现 MediaJob 列表区域，按当前文件夹筛选展示 MediaJob，复用现有的 MediaJob 列表组件和批量操作栏。确保文件夹和 MediaJob 的选择互斥逻辑正常工作。

**需求类型**：Feature

**涉及领域**：前端

### 1. MediaJob 列表区域

创建 `webserver/frontend/feature/project/page/project-list-filesystem/filesystem-jobs-section.tsx`：

- 展示当前文件夹内的 MediaJob 列表
- 数据筛选逻辑：
  - 当 `folderId` 存在时：使用 `filterManager.mediaJobFilter.folderId` 筛选该文件夹内的 MediaJob
  - 当 `folderId` 为空（根目录）时：使用 `no_folder` 参数筛选未分类的 MediaJob
- 复用现有 `MediaJobList` 组件或其内部的卡片/列表组件
- 点击 MediaJob → 保持现有行为（导航到详情页，给 mediaJobId）

### 2. 批量操作栏

- **MediaJob 批量操作栏**：复用现有 `MediaJobBatchOperationBar`，选中 MediaJob 时浮出
- **文件夹批量操作栏**：复用现有 `ProjectFolderBatchOperationBar`，选中文件夹时浮出（需扩展支持"移动到"按钮，由 T-006 连接）
- **互斥逻辑**：文件夹选择和 MediaJob 选择互斥（与现有逻辑一致），选中文件夹时清空 MediaJob 选择，反之亦然

### 3. 工具栏 / 筛选栏

- 在 filesystem 页面中提供搜索、排序功能
- 可以复用现有 `ProjectFilterBar` 的部分功能（search、ordering）
- 搜索范围为当前文件夹内的子文件夹 + MediaJob

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 组件从 Manager 获取数据

**前端Code Point:**
- `webserver/frontend/feature/project/page/project-page.tsx` - 现有页面中 MediaJob 列表和批量操作栏的使用方式
- `webserver/frontend/feature/project/manager/filter-manager.ts` - FilterManager 中 mediaJobFilter.folderId 和 no_folder 的使用
- `webserver/frontend/feature/project/manager/project-filesystem-view-controller.ts` - 新 VC，提供 selectFilesManager/selectFolderManager 互斥逻辑
- `webserver/frontend/feature/project/bootstrap/project-filesystem-context.tsx` - useProjectFileSystemViewController hook

## 注意点

- MediaJob 列表使用的是现有 API（不需要 mock，已有真实 API 支持 folder 筛选），但需要确保 `folderId` 从 URL 参数正确同步到 `filterManager`
- `no_folder` 筛选用于根目录展示未分类 MediaJob
- 确保选择互斥逻辑正确工作（选中文件夹时清空 MediaJob 选择，反之亦然）
- MediaJob 的点击行为不变（给 mediaJobId 导航到详情），只是列表筛选方式随 filesystem 视图变化

## Scenario

### Scenario 1: 查看文件夹内的 MediaJob

**场景描述：**
- **前置条件**：在 filesystem 视图中，当前 folderId 为某个文件夹
- **操作步骤**：
  1. 页面加载，MediaJob 列表使用 folderId 筛选
- **预期结果**：
  - 只展示该文件夹内的 MediaJob
  - MediaJob 点击行为不变

### Scenario 2: 根目录的 MediaJob

**场景描述：**
- **前置条件**：在 filesystem 视图根目录（无 folderId）
- **操作步骤**：
  1. 页面加载，MediaJob 列表使用 no_folder 筛选
- **预期结果**：
  - 展示未分类的 MediaJob（不属于任何文件夹的）

### Scenario 3: 选择互斥

**场景描述：**
- **前置条件**：页面同时有文件夹和 MediaJob
- **操作步骤**：
  1. 选中一个 MediaJob → MediaJob 批量操作栏出现
  2. 选中一个文件夹
- **预期结果**：
  - MediaJob 选择被清空，文件夹批量操作栏出现
  - MediaJob 批量操作栏消失

## Checklist

- [x] C-001 MediaJob 区域组件创建完成，正确按 folderId 筛选
- [x] C-002 根目录下使用 no_folder 筛选未分类 MediaJob
- [x] C-003 MediaJob 点击行为保持现有（导航到详情，给 mediaJobId）
- [x] C-004 MediaJob 批量操作栏正常工作
- [x] C-005 文件夹批量操作栏正常工作
- [x] C-006 文件夹选择和 MediaJob 选择互斥逻辑正确
- [x] C-007 搜索/排序功能在 filesystem 视图中正常工作

---

# Phase 2 – Backend Only

---

# T-008 后端 Model 迁移与 List/Create API 更新 (deps: T-001)

## 需求描述

**Feature：为 ProjectFolder 添加 parent 字段并更新 List/Create API**

在后端为 `ProjectFolder` 模型添加 `parent` 外键字段，运行迁移，并更新 List 和 Create API 以支持层级文件夹功能。确保所有更改向后兼容，现有行为不受影响。

**需求类型**：Feature

**涉及领域**：后端

### 1. Model 变更

在 `ProjectFolder` 模型中添加：

```python
parent = models.ForeignKey(
    'self',
    null=True, blank=True,
    on_delete=models.CASCADE,
    related_name='children'
)
```

运行 `makemigrations` 和 `migrate`。

### 2. List API 变更

修改 `ProjectFolderViewSet.get_queryset()`：

- 新增可选查询参数 `parent`
- `parent` 不传 → 保持现有行为，返回所有文件夹
- `parent=""` (空字符串) → 筛选 `parent_id__isnull=True`（根文件夹）
- `parent=<uuid>` → 筛选 `parent_id=<uuid>`（子文件夹）
- 其他已有筛选条件（search、ordering、pagination、workspace/brand filter）保持不变

### 3. Create API 变更

修改 Serializer 支持 `parent` 字段：

- 写入时接受可选 `parent` 字段
- 省略 `parent` 或传 null → 创建为根文件夹（现有行为）
- `parent=<uuid>` → 创建为指定文件夹的子文件夹

### 4. Serializer 变更

- List serializer：新增 `parent` 只读字段（uuid 或 null）
- Create/Update serializer：接受可选 `parent` 写入字段

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 运行在 docker 内，使用 ruff lint

**后端Code Point:**
- `webserver/backend/media/models/project_folder.py` - ProjectFolder 模型
- `webserver/backend/media/views/project_folder.py` - ProjectFolderViewSet
- `webserver/backend/media/serializers/project_folder.py` - ProjectFolderSerializer

## 注意点

- 迁移必须在 docker container 内运行
- `parent` 参数不传时**必须**保持现有行为（返回所有文件夹），这是向后兼容的关键
- `on_delete=CASCADE` 意味着删除父文件夹会级联删除所有子文件夹，需确认这是预期行为
- 已有的 workspace/brand 过滤、search、ordering、pagination 功能必须保持正常
- 提交前运行 ruff lint

## Scenario

### Scenario 1: List API 向后兼容

**场景描述：**
- **前置条件**：已有文件夹数据
- **操作步骤**：
  1. 调用 GET `/media/project-folders/`（不带 parent 参数）
- **预期结果**：
  - 返回所有文件夹，与修改前行为完全一致
  - 每个文件夹新增 `parent` 字段（现有文件夹均为 null）

### Scenario 2: 按 parent 筛选

**场景描述：**
- **前置条件**：已创建层级文件夹（Root → Child → Grandchild）
- **操作步骤**：
  1. 调用 GET `/media/project-folders/?parent=`（空字符串）→ 返回根文件夹
  2. 调用 GET `/media/project-folders/?parent=root-id` → 返回 Root 的子文件夹
- **预期结果**：
  - 空字符串返回 parent 为 null 的文件夹
  - uuid 返回指定 parent 的直接子文件夹

### Scenario 3: 创建子文件夹

**场景描述：**
- **前置条件**：已有一个根文件夹 "Root"
- **操作步骤**：
  1. 调用 POST `/media/project-folders/` with `{ name: "Child", parent: "root-id" }`
- **预期结果**：
  - 文件夹创建成功，parent 为 "root-id"
  - List API 可以通过 `?parent=root-id` 查到此文件夹

## Checklist

- [ ] C-001 `parent` 字段已添加到 ProjectFolder 模型，migration 已运行
- [ ] C-002 List API 不带 `parent` 参数时返回所有文件夹（向后兼容）
- [ ] C-003 List API `parent=""` 返回根文件夹
- [ ] C-004 List API `parent=<uuid>` 返回指定文件夹的直接子文件夹
- [ ] C-005 Create API 支持可选 `parent` 字段
- [ ] C-006 Serializer 在 List 响应中包含 `parent` 字段
- [ ] C-007 现有的 search、ordering、pagination、workspace/brand 过滤正常工作
- [ ] C-008 ruff lint 通过

---

# T-009 文件夹详情 Ancestors 与移动文件夹 API (deps: T-008)

## 需求描述

**Feature：为文件夹详情添加 ancestors 数据，并实现移动文件夹 API**

扩展文件夹详情接口以返回祖先链数据（用于面包屑），并实现移动文件夹的 API（单个和批量），包含循环引用校验。

**需求类型**：Feature

**涉及领域**：后端

### 1. 文件夹详情 ancestors

修改 `ProjectFolderViewSet.retrieve()` 或 Serializer：

- 在 GET `/media/project-folders/{id}/` 响应中新增 `ancestors` 字段
- `ancestors` 为有序数组，从根文件夹到当前文件夹的直接父级：`[{id, name}, ...]`
- 根文件夹（parent 为 null）的 `ancestors` 为空数组 `[]`
- 实现方式：从当前文件夹向上遍历 parent 链，收集祖先信息（ProjectFolder 数据量小，递归查询可接受）

### 2. 移动文件夹（单个）

通过 PATCH `/media/project-folders/{id}/`：

- 支持更新 `parent` 字段
- 校验：
  - 不能将文件夹设为自己的 parent
  - 不能将文件夹移动到自己的子孙下（遍历 target 的祖先链校验）
  - target parent 必须存在（如果不为 null）
- 校验失败返回 400 错误，附带描述信息

### 3. 批量移动文件夹

新增 action：POST `/media/project-folders/bulk_move/`：

- 请求：`{ folder_ids: [uuid], target_parent: uuid | null }`
- 校验同上（对每个 folder_id 逐一校验循环引用）
- 成功返回 `{ moved_count: N }`
- 部分失败策略：全部校验通过才执行移动，否则返回错误

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - docker 运行、ruff lint

**后端Code Point:**
- `webserver/backend/media/views/project_folder.py` - ViewSet，新增 bulk_move action
- `webserver/backend/media/serializers/project_folder.py` - 新增 ancestors serializer、bulk_move serializer

## 注意点

- ancestors 遍历需要防止无限循环（虽然循环引用在移动时已校验，但 defensive coding 仍然需要设置最大递归深度）
- 循环引用校验逻辑要严谨：收集 target_parent 的所有祖先，检查是否包含被移动的文件夹
- bulk_move 是原子操作：要么全部移动，要么全部不移动
- 提交前运行 ruff lint

## Scenario

### Scenario 1: 获取文件夹详情含 ancestors

**场景描述：**
- **前置条件**：已有层级结构 Root → Parent → Child
- **操作步骤**：
  1. GET `/media/project-folders/{child-id}/`
- **预期结果**：
  - 响应包含 `ancestors: [{id: root-id, name: "Root"}, {id: parent-id, name: "Parent"}]`

### Scenario 2: 移动文件夹

**场景描述：**
- **前置条件**：Folder A 在根目录，Folder B 在根目录
- **操作步骤**：
  1. PATCH `/media/project-folders/{folder-a-id}/` with `{ parent: folder-b-id }`
- **预期结果**：
  - Folder A 的 parent 更新为 Folder B
  - GET list with `parent=folder-b-id` 包含 Folder A

### Scenario 3: 循环引用拒绝

**场景描述：**
- **前置条件**：Folder A → Folder B（B 是 A 的子文件夹）
- **操作步骤**：
  1. PATCH `/media/project-folders/{folder-a-id}/` with `{ parent: folder-b-id }`
- **预期结果**：
  - 返回 400 错误，提示不能移动到子孙文件夹下

## Checklist

- [ ] C-001 GET detail 响应包含 `ancestors` 字段，格式为 `[{id, name}]`
- [ ] C-002 根文件夹的 ancestors 为空数组
- [ ] C-003 ancestors 排序正确（从根到直接父级）
- [ ] C-004 PATCH update 支持修改 parent（移动文件夹）
- [ ] C-005 移动时循环引用校验正确工作
- [ ] C-006 不能移动文件夹到自身下
- [ ] C-007 POST bulk_move 端点创建完成
- [ ] C-008 bulk_move 循环引用校验对每个文件夹生效
- [ ] C-009 bulk_move 是原子操作
- [ ] C-010 ruff lint 通过

---

# T-010 后端测试 (deps: T-008, T-009)

## 需求描述

**Testing：为所有后端变更编写测试**

为 ProjectFolder 的 parent 字段、List/Create 的 parent 支持、Detail 的 ancestors、移动文件夹功能编写全面的单元测试和集成测试，确保新功能正确且现有功能不受影响。

**需求类型**：Testing

**涉及领域**：后端

### 测试覆盖范围

1. **Model 测试**：
   - parent FK 关系正确
   - CASCADE 删除行为

2. **List API 测试**：
   - 不传 parent → 返回所有文件夹（向后兼容）
   - `parent=""` → 返回根文件夹
   - `parent=<uuid>` → 返回子文件夹
   - 与 search、ordering、pagination 组合使用

3. **Create API 测试**：
   - 不传 parent → 根文件夹
   - 传 parent → 子文件夹
   - 传不存在的 parent → 错误

4. **Detail API 测试**：
   - ancestors 字段正确（多层级）
   - 根文件夹 ancestors 为空

5. **Move (PATCH) 测试**：
   - 正常移动
   - 循环引用拒绝
   - 移动到自身拒绝
   - 移动到根目录

6. **Bulk Move 测试**：
   - 批量移动成功
   - 循环引用拒绝
   - 原子性（部分失败时全部不移动）

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 测试在 docker container 内运行

**后端Code Point:**
- `webserver/backend/media/tests/` - 现有测试目录

## 注意点

- 所有测试必须在 docker container 内运行
- 测试必须覆盖向后兼容场景（不传 parent 参数时的行为）
- 循环引用校验的边界场景要覆盖：自身、直接子、间接子孙
- 提交前运行 ruff lint 和 pytest

## Scenario

### Scenario 1: 运行完整测试套件

**场景描述：**
- **前置条件**：T-008 和 T-009 的代码已完成
- **操作步骤**：
  1. 在 docker container 中运行 pytest
- **预期结果**：
  - 所有新增测试通过
  - 所有现有测试通过

## Checklist

- [ ] C-001 Model 测试覆盖 parent FK 和 CASCADE
- [ ] C-002 List API 测试覆盖三种 parent 参数场景
- [ ] C-003 Create API 测试覆盖 with/without parent
- [ ] C-004 Detail API 测试覆盖 ancestors 字段
- [ ] C-005 Move 测试覆盖正常移动和循环引用拒绝
- [ ] C-006 Bulk Move 测试覆盖批量移动和原子性
- [ ] C-007 向后兼容测试通过（不传 parent 时行为不变）
- [ ] C-008 所有测试在 docker 内运行通过
- [ ] C-009 ruff lint 通过

---

# Phase 3 – Integration

---

# T-011 移除 Mock、集成真实 API、E2E 验证 (deps: T-004, T-005, T-006, T-007, T-009, T-010)

## 需求描述

**Integration：移除所有 mock，连接真实后端 API，端到端验证**

将 Phase 1 中使用的 mock 数据层替换为 Phase 2 实现的真实后端 API，验证 API contract 匹配，运行全面的端到端测试，确保整个 filesystem 视图功能正常工作。

**需求类型**：Integration

**涉及领域**：全栈

### 1. 移除 Mock

- 删除 `webserver/frontend/feature/project/mock/project-list-filesystem-mock.ts`
- 搜索所有 `// MOCK: Remove in Phase 3` 标记，替换为真实 API 调用
- 确保所有 mock 导入和引用被清理

### 2. 连接真实 API

- `getProjectFolderList` 传递 `parent` 参数到后端
- `getProjectFolderDetail` 调用真实后端接口获取 ancestors
- `createProjectFolder` 传递 `parent` 参数
- `moveProjectFolders` / `bulkMoveFolders` 调用真实 bulk_move 端点
- PATCH 移动单个文件夹调用真实 update 接口

### 3. Contract 验证

- 验证前端发送的请求参数与后端期望一致
- 验证后端返回的响应格式与前端类型定义一致
- 修复任何 contract 不匹配

### 4. E2E 验证

- 根目录 → 进入文件夹 → 面包屑返回 → 验证导航
- 创建根目录文件夹 → 创建子文件夹 → 验证层级
- 移动文件夹 → 验证列表更新
- 批量操作 → 验证批量移动/删除
- MediaJob 列表筛选 → 验证按文件夹正确展示
- 直接 URL 访问子文件夹 → 验证面包屑和内容
- Legacy 视图 → 验证完全不受影响
- Folder-detail 页面 → 验证完全不受影响

### 5. Lint / Precommit

- 前端：`bun biome:fix` → `bun precommit`
- 后端：ruff lint → pytest

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - precommit 流程

**后端规则:**
- `.project-rules/backend/index.md` - ruff、pytest

**前端Code Point:**
- `webserver/frontend/feature/project/mock/project-list-filesystem-mock.ts` - 待删除的 mock 文件
- `webserver/frontend/feature/project/api/folder.ts` - API 函数（mock → 真实）
- `webserver/frontend/feature/project/manager/breadcrumb-manager.ts` - 面包屑（mock → 真实）

## 注意点

- Contract 不匹配是 Phase 3 最可能遇到的问题，需要仔细核对每个端点
- 移除 mock 后要确认所有 API 调用的 error handling 正确工作（网络错误、后端错误等）
- E2E 测试要覆盖 happy path 和 error path
- 确保 legacy 视图和 folder-detail 页面在整个过程中不受任何影响

## Scenario

### Scenario 1: 完整用户流程

**场景描述：**
- **前置条件**：前后端代码均已部署
- **操作步骤**：
  1. 访问 `/projects/list?view=filesystem` → 看到根目录
  2. 创建文件夹 "Marketing"
  3. 双击进入 "Marketing"
  4. 创建子文件夹 "Q1 2025"
  5. 面包屑点击 "Projects" 返回根目录
  6. 将 "Q1 2025" 移动到另一个文件夹
  7. 验证 MediaJob 列表按文件夹正确筛选
- **预期结果**：
  - 所有操作均使用真实 API
  - 数据持久化，刷新后仍然存在
  - 面包屑、导航、列表全部正确

### Scenario 2: Legacy 视图不受影响

**场景描述：**
- **前置条件**：filesystem 视图已完全集成
- **操作步骤**：
  1. 访问 `/projects/list`（无 view 参数）
  2. 浏览文件夹列表
  3. 点击文件夹进入 folder-detail
- **预期结果**：
  - 完全与改造前一致
  - 无任何功能回退

## Checklist

- [ ] C-001 所有 mock 文件和 mock 引用已移除
- [ ] C-002 所有 API 调用已连接到真实后端
- [ ] C-003 API contract 验证通过（请求参数和响应格式匹配）
- [ ] C-004 文件夹层级导航正常（双击进入、面包屑返回）
- [ ] C-005 文件夹 CRUD 正常工作
- [ ] C-006 移动文件夹（单个和批量）正常工作
- [ ] C-007 MediaJob 列表按文件夹正确筛选
- [ ] C-008 直接 URL 访问子文件夹时面包屑正确
- [ ] C-009 Legacy 视图完全不受影响
- [ ] C-010 Folder-detail 页面完全不受影响
- [ ] C-011 前端 `bun precommit` 通过
- [ ] C-012 后端 ruff lint 和 pytest 通过
