# T-001 创建 Project Selection Dialog 通用模块

## 需求描述

**创建 ProjectSelectionDialog 及其配套的 ViewController 和 UI 组件**

将 filesystem 版本的 Project List 核心浏览能力（文件夹导航、筛选、MediaJob 列表）提取为可复用模块，并基于 BasicDialog 创建 ProjectSelectionDialog，供外部模块调起用于选择 MediaJob。

**需求类型**：Feature

**涉及领域**：前端

### 1. Dialog Props 设计

```typescript
interface ProjectSelectionDialogProps {
  /** Whether multiple selection is allowed. Default: true */
  multiple?: boolean;
  /** Initial filter for media job status (API-level filtering) */
  initialStatusFilter?: MediaJobFilterStatusEnum;
  /** Initial filter for media job type */
  initialTypeFilter?: MediaJobTypeEnum;
  /** Client-side filter function for additional filtering (e.g., non-batch, has video URL) */
  filterMediaJob?: (mediaJob: MediaJobType) => boolean;
  /** Dialog title override */
  title?: string;
  /** Confirm button text override */
  confirmText?: string;
}
```

Dialog 通过 `dialogManager.show(ProjectSelectionDialog, props)` 调起，resolve 返回 `MediaJobType[]`（选中的 MediaJob 数组）。

### 2. ProjectSelectionViewController

创建 Dialog 专用的轻量级 ViewController，仅包含浏览和选择所需的 Manager：

- **复用** `ProjectFilterManager`（筛选状态管理）- 新建独立实例
- **复用** `BreadcrumbManager`（面包屑导航）- 新建独立实例
- **新建/复用** `SelectionManager`（MediaJob 选择态管理）- 参考现有 `selectFilesManager` 模式
- **使用** `useMediaJobListQuery` 和文件夹列表查询获取数据

不包含 `FolderOperateManager`、`MediaJobOperateManager` 等操作类 Manager（Dialog 中不需要增删改）。

ViewController 需要：
- `bootstrap(options)` 方法，接收 Dialog Props 中的初始筛选条件
- `dispose()` 方法清理所有 Manager 和订阅
- `navigateToFolder(folderId)` 方法，同步面包屑和筛选的文件夹 ID
- `combinedStore` 组合所有 Manager 的 store

### 3. Dialog UI 组件

Dialog 内部的 UI 布局（参考 filesystem 页面但简化）：

```
┌──────────────────────────────────────────────────────────────┐
│  Dialog Header: "Select Projects"              [X Close]     │
├──────────────────────────────────────────────────────────────┤
│  [面包屑导航]                                                 │
│                                                              │
│  [搜索框] [类型筛选] [状态筛选]                                │
│                                                              │
│  ┌─ Folders ────────────────────────────────────────────┐    │
│  │ 📁 Folder A    📁 Folder B    📁 Folder C           │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─ Files ──────────────────────────────────────────────┐    │
│  │ ☐ Video 1     ☐ Video 2     ☐ Video 3               │    │
│  │ ☐ Video 4     ☐ Video 5                              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                        [Cancel]  [Confirm (N selected)]      │
└──────────────────────────────────────────────────────────────┘
```

**关键差异（相比 filesystem 路由页面）**：
- 无 Header 标题区（由 Dialog Header 替代）
- 无批量操作栏（batch bars）
- MediaJob 卡片上显示 checkbox 选择态
- 底部有 Cancel / Confirm 按钮
- 文件夹双击导航（与路由页面一致）
- 筛选栏可能隐藏部分控件（如 New Folder、Launch Ads 等操作按钮）

### 4. 文件结构

```
feature/project/
├── block/
│   └── project-selection-dialog/
│       ├── project-selection-dialog.tsx           # Dialog 入口（BasicDialog + VC Provider）
│       ├── project-selection-content.tsx           # 内容区域布局
│       ├── project-selection-filter-bar.tsx        # 筛选栏（简化版，无操作按钮）
│       ├── project-selection-folders-section.tsx   # 文件夹区
│       ├── project-selection-jobs-section.tsx      # MediaJob 列表（带选择态）
│       └── type.ts                                # Props 和类型定义
├── manager/
│   └── project-selection-view-controller.ts       # Dialog 专用 ViewController
└── context/
    └── project-selection-context.tsx              # Dialog VC Context
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式、ViewController 协调、生命周期管理
- `.project-rules/frontend/dialog.md` - Dialog 管理系统使用指南（BasicDialog、WithResolve、dialogManager）
- `.project-rules/frontend/directory-structure.md` - Feature 目录组织规范

**前端Code Point:**
- `webserver/frontend/feature/project/page/project-list-filesystem/` - filesystem 页面组件（参考）
- `webserver/frontend/feature/project/bootstrap/project-filesystem-bootstrap.tsx` - VC 创建和生命周期管理（参考）
- `webserver/frontend/feature/project/bootstrap/project-filesystem-context.tsx` - Context Provider（参考）
- `webserver/frontend/feature/project/manager/project-filesystem-view-controller.ts` - 现有 ViewController（参考）
- `webserver/frontend/feature/project/manager/filter-manager.ts` - ProjectFilterManager
- `webserver/frontend/feature/project/manager/breadcrumb-manager.ts` - BreadcrumbManager
- `webserver/frontend/feature/project/hook/use-media-job-list-query.ts` - MediaJob 列表查询 Hook
- `webserver/frontend/component/ui/modal/preset/basic-dialog.tsx` - BasicDialog 组件

**前端路由:**
- `/projects/list?view=filesystem` - filesystem 页面（功能参考）

## 注意点

- Dialog 内的 FilterManager 必须创建独立实例，不能复用路由页面的实例，避免状态干扰
- `initialStatusFilter` 和 `initialTypeFilter` 需要在 FilterManager bootstrap 时注入为初始状态
- `filterMediaJob` 是前端二次过滤函数，在查询结果渲染前过滤，不影响 API 请求参数
- 选择模式（单选/多选）影响 checkbox 交互行为：单选时点击新项自动取消之前选中
- Dialog 关闭时需要正确 dispose 所有 Manager，清理副作用
- 面包屑导航不同步 URL（Dialog 中不需要 URL 状态同步）
- MediaJob 列表使用 `useMediaJobListQuery`，该 Hook 内部使用 React Query 缓存，Dialog 打开时会触发新的请求
- 筛选栏中的操作按钮（New Folder、Launch Ads）不应出现在 Dialog 中

## Scenario

### Scenario 1: 外部模块调起 Dialog 选择 MediaJob

**场景描述：**
- **前置条件**：外部模块有 MediaJob 选择需求
- **操作步骤**：
  1. 外部模块调用 `dialogManager.show(ProjectSelectionDialog, { multiple: true, initialStatusFilter: MediaJobFilterStatusEnum.Completed })`
  2. Dialog 弹出，FilterManager 以 `Completed` 状态初始化
  3. 用户在 Dialog 中浏览文件夹，点击进入子文件夹
  4. 用户搜索关键词过滤 MediaJob
  5. 用户通过 checkbox 选择多个 MediaJob
  6. 用户点击 "Confirm" 按钮
  7. Dialog resolve 返回 `MediaJobType[]`
- **预期结果**：
  - Dialog 正确展示文件夹和 MediaJob
  - 筛选条件生效，只展示 Completed 状态的 MediaJob
  - 选中的 MediaJob 通过 resolve 返回给调用方

### Scenario 2: 单选模式下选择

**场景描述：**
- **前置条件**：外部模块以单选模式调起 Dialog
- **操作步骤**：
  1. 调用 `dialogManager.show(ProjectSelectionDialog, { multiple: false })`
  2. 用户点击一个 MediaJob
  3. 再点击另一个 MediaJob
- **预期结果**：
  - 第二次点击自动取消第一个选中
  - 同一时间只有一个 MediaJob 被选中
  - Confirm 按钮显示 "Confirm (1 selected)"

### Scenario 3: 用户取消 Dialog

**场景描述：**
- **前置条件**：Dialog 已打开
- **操作步骤**：用户点击 Cancel 或 Dialog 外部区域
- **预期结果**：
  - Dialog 关闭
  - Promise reject，调用方可通过 try-catch 或 await 后流程中断处理

## Checklist

- [x] C-001 `ProjectSelectionViewController` 创建完成，包含 FilterManager、BreadcrumbManager、SelectionManager 的协调
- [x] C-002 `ProjectSelectionDialog` 基于 BasicDialog 实现，支持 `dialogManager.show()` 调起
- [x] C-003 Dialog Props（`multiple`、`initialStatusFilter`、`initialTypeFilter`、`filterMediaJob`、`title`、`confirmText`）正确生效
- [x] C-004 Dialog 内文件夹导航正常工作（面包屑 + 双击进入文件夹 + 返回上级）
- [x] C-005 Dialog 内搜索和筛选正常工作
- [x] C-006 MediaJob 选择态正确（多选 checkbox / 单选 radio 行为）
- [x] C-007 Confirm 按钮正确显示选中数量，点击后 resolve 返回选中的 MediaJob 数组
- [x] C-008 Cancel 或关闭 Dialog 时正确 reject
- [x] C-009 Dialog 关闭时正确 dispose 所有 Manager，无内存泄漏
- [x] C-010 `filterMediaJob` 前端过滤函数正确过滤 MediaJob 列表
- [x] C-011 Dialog 样式与项目设计规范一致，BasicDialog 布局正确

---

# T-002 在 Mushroom Asset 页面集成 Import from Projects (deps: T-001)

## 需求描述

**在 Mushroom Asset 页面的 "New" 下拉菜单中添加 "Import from Projects" 选项，打开 T-001 创建的 ProjectSelectionDialog，用户选择 MediaJob 后将视频导入为 Mushroom Asset。**

**需求类型**：Feature

**涉及领域**：前端

### 1. 扩展 NewNodeDropdownButton

在 `NewNodeDropdownButton` 组件中添加 `onImportFromProjects` prop：

```typescript
export type NewNodeDropdownButtonProps = {
  // ... existing props
  onImportFromProjects?: () => void;  // New prop
};
```

当 `onImportFromProjects` 存在时，在下拉菜单中显示 "Import from Projects" 选项：

```
┌─────────────────────────┐
│ 📤 Upload Assets        │
│ ─────────────────────── │
│ 📁 New Folder           │
│ ─────────────────────── │
│ 📥 Import from Projects │  ← 新增
└─────────────────────────┘
```

### 2. NodeFolderActionMenu 中的导入逻辑

在 `NodeFolderActionMenu`（`multiple-action-menu.tsx`）中添加导入处理逻辑：

```typescript
const handleImportFromProjects = async () => {
  // 1. Open dialog with conditions:
  //    - Only show completed (rendered) MediaJobs
  //    - Non-batch (has rendered output URL)
  const selectedJobs = await dialogManager.show(ProjectSelectionDialog, {
    multiple: true,
    initialStatusFilter: MediaJobFilterStatusEnum.Completed,
    filterMediaJob: (job) => {
      const { videoUrl } = getVideoParam(job);
      const isBatch = (job.outputs?.media_job_ids?.length ?? 0) > 0;
      return !!videoUrl && !isBatch;
    },
    title: 'Import from Projects',
    confirmText: 'Import',
  });

  // 2. Extract video URLs from selected jobs
  // 3. Call uploadAssetsFromUrls to import into Mushroom
  // 4. Show success/error Toast
  // 5. Refresh asset list
};
```

### 3. 导入上传流程

选择完成后的上传流程：

1. 遍历 `selectedJobs`，通过 `getVideoParam(job)` 提取 `videoUrl`
2. 构造 `files` 数组：`[{ url: videoUrl, name: job.name }, ...]`
3. 获取当前 Mushroom 文件夹 ID（`parentId`）
4. 调用 `uploadAssetsFromUrls(parentId, files)`
5. 对返回的每个 `task_id`，通过 `getTaskDetail` 轮询等待处理完成
6. 全部完成后刷新 Asset 列表
7. 通过 Toast 通知用户导入结果

**注意**：由于是从已有的 CDN URL 导入（不涉及本地文件上传），不需要使用 `UploadProgressManager` 的文件上传流程。但需要等待后端处理（`uploadAssetsFromUrls` 返回的 task）。

### 4. 错误处理

- 如果 Dialog 被取消（reject），流程静默中断（`dialogManager.show` 的 await 会自动中断后续流程）
- 如果部分 MediaJob 的 videoUrl 为空，跳过这些项并给出 Toast 警告
- 如果 `uploadAssetsFromUrls` 调用失败，显示 Toast 错误提示
- 如果后端 task 处理失败，显示 Toast 错误提示但不阻塞其他 task

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式
- `.project-rules/frontend/dialog.md` - Dialog 管理系统（`dialogManager.show()`）

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/new-node-dropdown-button.tsx` - New 下拉菜单组件（需修改）
- `webserver/frontend/feature/mushroom/sub-feature/project-management/block/multiple-action-menu.tsx` - NodeFolderActionMenu（需添加导入逻辑）
- `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/content-toolbar.tsx` - Toolbar（传递 prop）
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` → `uploadAssetsFromUrls` - 上传 API
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-task.api.ts` → `getTaskDetail` - Task 轮询
- `webserver/frontend/feature/mushroom/manager/common/asset-list-upload-manager.ts` - 参考上传流程
- `webserver/frontend/feature/project/utils/common.ts` → `getVideoParam` - 视频 URL 提取
- `webserver/frontend/type/media-job.ts` - MediaJob 数据结构

**前端路由:**
- `/mushroom/project/asset` - Mushroom Asset 管理页面

## 注意点

- `NewNodeDropdownButton` 是共享组件（project-management 和 mirror-management 都使用），新增 prop 仅在传入时显示菜单项，不影响其他使用方
- `getVideoParam(job)` 提取的 `videoUrl` 已经是完整的 CDN URL，可以直接传给 `uploadAssetsFromUrls`
- 非 Batch 判断：`outputs.media_job_ids` 不存在或长度为 0
- 导入使用 MediaJob 的 `name` 字段作为 Asset 名称
- 需要获取当前 Mushroom 项目的 `parentId`（当前文件夹 ID），通过 `assetListVC.locationStateManager.state.currentFolderId` 或 `projectId` 获取
- 导入完成后需要调用 `fireAssetListNodesModifiedEvent()` 或直接 refetch 刷新列表
- 考虑导入多个文件时的并发控制，可以使用 `Promise.allSettled` 保证部分失败不影响其他

## Scenario

### Scenario 1: Mushroom 用户成功导入视频

**场景描述：**
- **前置条件**：用户在 Mushroom Asset 页面，已有已渲染完成的 MediaJob 在主站 Projects 中
- **操作步骤**：
  1. 用户点击 "New" 下拉菜单
  2. 选择 "Import from Projects"
  3. ProjectSelectionDialog 弹出，仅展示渲染完成且非 Batch 的 MediaJob
  4. 用户浏览文件夹，选择 2 个视频
  5. 点击 "Import"
  6. 系统提取视频 URL，调用 `uploadAssetsFromUrls` 导入
  7. 等待后端处理完成
- **预期结果**：
  - Toast 提示 "Successfully imported 2 assets"
  - Mushroom Asset 列表刷新，新导入的 2 个 Asset 出现在当前文件夹中
  - Asset 名称与原 MediaJob 名称一致

### Scenario 2: Dialog 中没有符合条件的 MediaJob

**场景描述：**
- **前置条件**：用户的 Projects 中没有渲染完成的非 Batch MediaJob
- **操作步骤**：
  1. 用户点击 "New" → "Import from Projects"
  2. Dialog 弹出
- **预期结果**：
  - MediaJob 列表显示空状态
  - 用户可以切换文件夹或调整筛选条件查找
  - 用户可以取消关闭 Dialog

### Scenario 3: 导入过程中部分失败

**场景描述：**
- **前置条件**：用户选择了 3 个 MediaJob 导入
- **操作步骤**：
  1. 用户确认导入 3 个视频
  2. 其中 1 个的后端 task 处理失败
- **预期结果**：
  - 成功的 2 个 Asset 正常出现在列表中
  - 失败的 1 个显示 Toast 错误提示（如 "Failed to import: Video Name"）
  - 不阻塞成功的导入

## Checklist

- [x] C-001 `NewNodeDropdownButton` 添加 `onImportFromProjects` prop，菜单中正确显示 "Import from Projects" 选项
- [x] C-002 仅在 `onImportFromProjects` prop 存在时显示该菜单项，不影响 mirror-management 等其他使用方
- [x] C-003 点击 "Import from Projects" 正确打开 ProjectSelectionDialog，筛选条件为 Completed + 非 Batch
- [x] C-004 Dialog 中的 MediaJob 列表正确过滤（仅显示有 videoUrl 且非 Batch 的 Completed MediaJob）
- [x] C-005 选择确认后，正确提取视频 URL 并调用 `uploadAssetsFromUrls`
- [x] C-006 使用 MediaJob 的 `name` 作为导入 Asset 的名称
- [x] C-007 导入完成后 Mushroom Asset 列表正确刷新
- [x] C-008 导入成功显示 Toast 成功提示
- [x] C-009 导入失败（网络错误、task 失败等）显示 Toast 错误提示
- [x] C-010 Dialog 取消时流程正确中断，无副作用
- [x] C-011 多个文件导入时部分失败不阻塞其他文件的导入
