## Context

当前 `/projects/list?view=filesystem` 路由页面通过 `ProjectFileSystemViewController` 协调多个 Manager（FilterManager、BreadcrumbManager、FolderListManager 等）来实现文件系统式的项目管理。但这些逻辑与路由页面紧耦合，无法被其他模块（如 Mushroom）复用。

需要将核心的文件系统浏览能力抽取为通用模块，并包装成 Dialog 供外部模块使用。同时需要在 Mushroom Asset 页面集成 "Import from Projects" 功能，通过该 Dialog 选择 MediaJob，提取视频 URL 后导入为 Mushroom Asset。

### 现有架构

```
project-list-filesystem/
├── filesystem-page-content.tsx    # 页面布局（Header + Breadcrumb + Filter + Content）
├── filesystem-filter-bar.tsx      # 筛选栏
├── filesystem-folders-section.tsx # 文件夹列表
├── filesystem-jobs-section.tsx    # MediaJob 列表
└── filesystem-batch-bars.tsx      # 批量操作栏

bootstrap/
├── project-filesystem-bootstrap.tsx  # 创建 VC 并管理生命周期
└── project-filesystem-context.tsx    # Context Provider

manager/
├── project-filesystem-view-controller.ts  # ViewController
├── filter-manager.ts                      # 筛选状态管理
├── breadcrumb-manager.ts                  # 面包屑导航
├── folder-list-manager.ts                 # 文件夹数据
├── folder-operate-manager.ts              # 文件夹操作
└── medai-job-operate-manager.ts           # MediaJob 操作
```

## Goals / Non-Goals

### Goals

- 将 filesystem 核心浏览能力（文件夹导航 + 筛选 + MediaJob 列表）抽取为可复用组件
- 创建 ProjectSelectionDialog，基于 BasicDialog，支持 Props 控制筛选和选择模式
- Dialog 内部使用独立的 ViewController 管理状态，不依赖路由页面
- Mushroom 集成：New 下拉菜单 → "Import from Projects" → Dialog → 选择 → 导入

### Non-Goals

- 不重构现有 filesystem 路由页面 — 路由页面继续使用现有代码，Dialog 通过复用底层组件实现
- 不修改现有 Manager 的接口 — 新建 Dialog 专用的轻量级 ViewController
- 不新增后端 API — 使用现有的 MediaJob 列表 API 和 Mushroom `uploadAssetsFromUrls` API

## Decisions

### 1. 复用策略：共享底层组件而非包装整个页面

**决策**：不将整个 `FileSystemPageContent` 组件直接塞入 Dialog，而是抽取底层的核心 UI 组件（文件夹卡片区、MediaJob 卡片区、筛选栏、面包屑），在 Dialog 中组装一个专门的选择版本。

**理由**：
- `FileSystemPageContent` 包含批量操作栏（batch bars）、header 标题等不适合 Dialog 的部分
- Dialog 需要额外的选择态（checkbox、选中高亮）和确认按钮
- Dialog 的 FilterManager 需要支持外部注入的初始筛选条件（如 status = completed）
- 保持 filesystem 路由页面和 Dialog 各自独立演进

**考虑的替代方案**：
- 直接包装 `FileSystemPageContent`：被拒绝，因为页面布局和 Dialog 布局需求不同，且需要移除不相关的功能（batch bars、header）

### 2. Dialog ViewController 设计

**决策**：为 Dialog 创建独立的 `ProjectSelectionViewController`，复用现有的 `ProjectFilterManager`、`BreadcrumbManager`、`FolderListManager`，但不使用 `FolderOperateManager` 和 `MediaJobOperateManager`（Dialog 中不需要增删改操作）。

**理由**：
- Dialog 只需要浏览和选择能力，不需要文件夹/MediaJob 的增删改操作
- 独立 VC 可以接收 Dialog Props（筛选条件、选择模式等）来初始化 Manager 状态
- 避免与路由页面的 VC 状态互相干扰

**考虑的替代方案**：
- 复用 `ProjectFileSystemViewController`：被拒绝，因为该 VC 包含操作相关的 Manager 和逻辑，且与路由 URL 状态同步，不适合 Dialog 场景

### 3. 选择模式的控制

**决策**：Dialog 通过 `multiple` prop 控制单选/多选模式，回调统一使用 MediaJob 数组。单选模式下数组只有一个元素。

**理由**：
- 统一的回调类型（数组）简化外部调用方的逻辑
- 灵活的选择模式适配不同使用场景
- 与现有的 `SelectionManager` 模式一致

### 4. MediaJob 筛选条件注入

**决策**：Dialog 通过 `initialFilter` prop 接收初始筛选条件，作为 FilterManager 的初始状态。同时提供 `filterMediaJob` prop 允许对查询结果进行二次过滤（如非 Batch 过滤）。

**理由**：
- `initialFilter` 控制 API 请求层面的筛选（如 status = completed），减少无效数据传输
- `filterMediaJob` 控制前端层面的二次过滤（如非 Batch 判断），灵活应对 API 无法直接过滤的条件
- 这种二层过滤设计覆盖了大部分使用场景

### 5. Mushroom 导入流程

**决策**：在 `NodeFolderActionMenu` 中处理 "Import from Projects" 的点击事件，打开 Dialog，获取结果后直接调用 `uploadAssetsFromUrls` API（不经过 `UploadProgressManager`）。

**理由**：
- 导入的是已有的 CDN URL，不需要本地文件上传和进度追踪
- `uploadAssetsFromUrls` 直接接受 URL 列表，返回 task_id，可以通过 TaskPolling 等待完成
- 保持流程简单直接，避免不必要的复杂度

**考虑的替代方案**：
- 通过 `UploadProgressManager` 管理导入进度：被拒绝，因为不涉及本地文件 → S3 的上传步骤，`UploadProgressManager` 的进度模拟不适用；但可以通过 Toast 通知用户导入结果

### 6. NewNodeDropdownButton 扩展方式

**决策**：在 `NewNodeDropdownButton` 添加 `onImportFromProjects` prop，仅当该 prop 存在时渲染 "Import from Projects" 菜单项。

**理由**：
- 与现有 `onUploadAsset`、`onNewFolder` 等 prop 设计模式保持一致
- 不影响其他使用 `NewNodeDropdownButton` 的模块（如 mirror-management），因为不传该 prop 时不显示此选项

## Data Model

### Existing Model (No Changes Required)

**MediaJob（主站项目系统）**：
- 使用现有 `mediaJobSchema` 定义的数据结构
- 关键字段：`id`, `name`, `status`, `outputs`, `created_with`
- 视频 URL 提取：通过 `getVideoParam(mediaJob)` 获取 `videoUrl`
- Batch 判断：`outputs.media_job_ids` 存在且长度 > 0 为 Batch Job

**Mushroom Asset**：
- 使用现有 `uploadAssetsFromUrls(parentId, files)` API 创建
- `files` 参数：`{ url: string, name?: string }[]`

### API Response Format

无新增 API，使用现有接口：
- MediaJob 列表：`GET /media-jobs/` （通过 `useMediaJobListQuery` 调用）
- Mushroom 上传：`POST /mushroom/nodes/upload-assets-from-urls/`

## Component Structure

```
feature/project/
├── block/
│   └── project-selection-dialog/
│       ├── project-selection-dialog.tsx           # Dialog 入口组件（BasicDialog 包装）
│       ├── project-selection-content.tsx           # Dialog 内容区域布局
│       ├── project-selection-filter-bar.tsx        # Dialog 内筛选栏（复用/简化版）
│       ├── project-selection-folders-section.tsx   # Dialog 内文件夹区
│       ├── project-selection-jobs-section.tsx      # Dialog 内 MediaJob 列表（带选择态）
│       └── type.ts                                # Dialog Props 类型定义
├── manager/
│   └── project-selection-view-controller.ts       # Dialog 专用 ViewController
├── context/  (或在 bootstrap/ 中)
│   └── project-selection-context.tsx              # Dialog VC Context
```

```
feature/mushroom/
├── block/
│   └── new-node-dropdown-button.tsx               # 扩展：添加 onImportFromProjects prop
├── sub-feature/project-management/
│   └── block/
│       └── multiple-action-menu.tsx               # 添加 Import from Projects 处理逻辑
```

## Architecture Patterns

- **Manager Pattern**：Dialog 使用独立的 `ProjectSelectionViewController` 管理浏览和选择状态
  - 复用 `ProjectFilterManager` 管理筛选
  - 复用 `BreadcrumbManager` 管理文件夹导航
  - 新增轻量级 `SelectionManager` 管理 MediaJob 选择态
  - 通过 Context 提供 ViewController 实例

- **Dialog Manager Pattern**：通过 `dialogManager.show(ProjectSelectionDialog, props)` 打开，resolve 返回选中的 MediaJob 数组

- **Module Interaction**：Mushroom 通过 Dialog 的通用能力导入 Projects，不在 Project 模块内添加 Mushroom 特定逻辑

## Risks / Trade-offs

### Risk: FilterManager 状态隔离

**风险**：Dialog 内的 FilterManager 与路由页面的 FilterManager 使用相同的类，但需要独立的状态实例，避免互相干扰。

**缓解措施**：
- Dialog 内通过 `useState(() => new ProjectFilterManager())` 创建独立实例
- Dialog 关闭时（dispose）清理所有 Manager 状态

### Risk: MediaJob 视频 URL 格式兼容

**风险**：主站 MediaJob 的视频 URL 可能与 Mushroom `uploadAssetsFromUrls` 期望的格式不一致。

**缓解措施**：
- `getVideoParam()` 已经处理了各种 URL 格式（CloudFront、S3、相对路径等）
- 在导入前验证 URL 有效性，无效时给出提示

### Trade-off: Dialog 性能 vs 功能完整度

**决策**：Dialog 保留完整的文件夹导航功能，而非简化为扁平列表。

**影响**：
- 优点：用户体验与主站一致，方便在大量项目中定位
- 缺点：Dialog 初始化需要加载文件夹数据，有一定延迟
- 权衡：通过 skeleton loading 和数据缓存优化体验

## Open Questions

（已全部确认）

## Migration Plan

### Steps

1. **Phase 1: 抽取通用模块 (T-001)**
   - 创建 `ProjectSelectionViewController` 和 Context
   - 创建 Dialog 内部的 UI 组件（复用/简化 filesystem 组件）

2. **Phase 2: 创建 Dialog (T-002)**
   - 实现 `ProjectSelectionDialog` 基于 BasicDialog
   - 支持 Props 控制筛选、选择模式
   - 实现选择确认逻辑

3. **Phase 3: Mushroom 集成 (T-003)**
   - 扩展 `NewNodeDropdownButton` 支持 "Import from Projects"
   - 在 `NodeFolderActionMenu` 中实现导入流程
   - 调用 `uploadAssetsFromUrls` 完成导入

### Rollback

- **代码回滚**：通过 Git 回滚
- **功能降级**：如果出现问题，移除 `NewNodeDropdownButton` 的 `onImportFromProjects` prop 即可隐藏功能入口
- **无数据库变更**：纯前端改动，不影响后端

## References

- `.project-rules/frontend/architecture.md` - Manager 模式架构
- `.project-rules/frontend/dialog.md` - Dialog 管理系统
- `webserver/frontend/feature/project/manager/project-filesystem-view-controller.ts` - 现有 ViewController
- `webserver/frontend/feature/project/manager/filter-manager.ts` - FilterManager
- `webserver/frontend/feature/project/utils/common.ts` → `getVideoParam()` - 视频 URL 提取
- `webserver/frontend/feature/mushroom/manager/common/asset-list-upload-manager.ts` - Upload Manager 参考
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` → `uploadAssetsFromUrls` - 导入 API
