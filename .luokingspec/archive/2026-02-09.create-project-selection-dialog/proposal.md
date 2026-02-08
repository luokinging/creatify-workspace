# Proposal: Create Project Selection Dialog

## 需求摘要

将 filesystem 版本的 Project List 抽取为通用可复用模块，并包装成 Dialog 供外部模块（如 Mushroom）调起用于选择 MediaJob。同时在 Mushroom 的 Asset 页面 New 下拉菜单中集成 "Import from Projects" 功能，实现从主站 Projects 导入视频到 Mushroom Asset 的完整流程。

## 背景与动机

当前 `/projects/list?view=filesystem` 路由的页面提供了文件系统式的项目管理功能（文件夹导航、搜索筛选、MediaJob 列表等），但这些功能模块与路由页面耦合，无法被其他模块复用。

Mushroom 模块需要一种能力：从主站的 Projects 中选择已渲染完成的视频，并导入到 Mushroom Asset 系统中。当前没有这种跨模块的项目选择能力，用户必须手动复制链接或下载后重新上传，体验较差。

## 目标与成功标准

- 将 filesystem Project List 的核心内容（文件夹导航、筛选栏、MediaJob 卡片列表）抽取为可复用模块
- 提供 Project Selection Dialog，基于 BasicDialog 实现，支持外部模块调起选择 MediaJob
- Dialog 支持通过 Props 控制筛选条件（如 MediaJob 状态）、选择模式（单选/多选）等
- 在 Mushroom Asset 页面的 "New" 下拉菜单中添加 "Import from Projects"，实现从 Projects 导入视频的完整流程

**成功标准**：
- Dialog 可以独立于路由页面使用，外部模块通过 `dialogManager.show()` 即可调起
- 用户在 Mushroom 中点击 "Import from Projects" → 在 Dialog 中浏览/搜索/筛选 MediaJob → 选择后确认 → 视频自动导入为 Mushroom Asset
- 导入后的 Asset 在 Mushroom 列表中正确显示

## 范围与边界

### In Scope（本次包含）

- 抽取 filesystem 页面的核心组件为可复用模块（面包屑、筛选栏、文件夹区、MediaJob 列表区）
- 创建 Project Selection Dialog（基于 BasicDialog），支持文件夹导航、搜索筛选、MediaJob 选择
- Dialog Props 设计：筛选条件控制、选择模式（单选/多选由外部决定）、返回值为 MediaJob 数组
- 在 Mushroom content-toolbar.tsx 的 New 下拉菜单中添加 "Import from Projects"
- 实现从 Dialog 选择结果到 Mushroom `uploadAssetsFromUrls` 的完整上传流程

### Out of Scope（本次不包含）

- 不修改现有 filesystem 路由页面的功能和表现 — 只是抽取复用
- 不修改 Mushroom 的上传进度管理（UploadProgressManager） — 直接使用 `uploadAssetsFromUrls` API
- 不涉及后端 API 改动 — 前端已有 API 接口足够实现需求
- 不涉及移动端适配 — 后续优化

## 用户/系统场景

### 场景 1：Mushroom 用户从 Projects 导入视频

- **谁**：Mushroom Asset 管理员
- **何时/条件**：需要将主站已渲染完成的视频导入到 Mushroom 的当前项目中
- **做什么**：
  1. 在 Mushroom Asset 页面点击 "New" → "Import from Projects"
  2. Dialog 弹出，展示 filesystem 风格的 Project 列表（仅展示渲染完成且非 Batch 的 MediaJob）
  3. 用户在 Dialog 中浏览文件夹、搜索、筛选，找到目标 MediaJob
  4. 选择一个或多个 MediaJob，点击确认
  5. 系统自动提取视频 URL，通过 `uploadAssetsFromUrls` 导入到 Mushroom
- **得到什么**：选中的视频以 Asset 形式出现在 Mushroom 的当前文件夹中

### 场景 2：其他模块复用 Dialog 选择 MediaJob

- **谁**：需要选择 Project MediaJob 的任意前端模块
- **何时/条件**：模块需要用户从 Projects 中选择 MediaJob（如导入、引用、分享等场景）
- **做什么**：
  1. 通过 `dialogManager.show(ProjectSelectionDialog, { ... })` 调起 Dialog
  2. 通过 Props 控制筛选条件（如只展示特定状态的 MediaJob）
  3. 用户选择后，Dialog resolve 返回选中的 MediaJob 数组
- **得到什么**：获取用户选中的 MediaJob 数据，按需进行后续操作

## 约束与假设

### 约束

- Dialog 必须基于 `BasicDialog` 实现，遵循项目 Dialog 管理规范（`dialogManager.show()`）
- 不直接修改 filesystem 路由页面现有代码，通过抽取公共模块的方式复用
- 遵循 Manager 模式架构，Dialog 内部逻辑应通过 ViewController / Manager 管理
- 导入流程使用现有的 `uploadAssetsFromUrls` API，不需要新增后端接口
- 选择模式由外部 Props 控制（单选/多选），回调统一返回 MediaJob 数组

### 假设

- 现有的 MediaJob 数据结构中 `outputs` 字段包含足够的信息来判断是否已渲染完成以及提取视频 URL
- `uploadAssetsFromUrls` API 支持接收外部 CDN/S3 URL（主站 MediaJob 的视频 URL 格式）
- 用户在 Dialog 中选择的 MediaJob 其 `outputs` 中的 `videoUrl`（通过 `getVideoParam` 提取）可以直接用于 Mushroom 导入

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MediaJob | 主站 Project 系统中的媒体任务，包含视频/图片/音频等 | 对应 `mediaJobSchema` 类型 |
| Filesystem View | Project List 的文件系统式管理视图 | 路由 `/projects/list?view=filesystem` |
| Mushroom Asset | Mushroom 模块中的资产节点 | 通过 `uploadAssetsFromUrls` 创建 |
| Batch Job | 包含多个子任务的批量 MediaJob | `outputs.media_job_ids` 存在时为 Batch |
| BasicDialog | 项目 UI 库提供的标准对话框组件 | `@/component/ui/modal/preset/basic-dialog` |

## 参考与链接

- 前端路由：`/projects/list?view=filesystem` - Filesystem Project List 页面
- 前端路由：`/mushroom/project/asset` - Mushroom Asset 管理页面
- `.project-rules/frontend/dialog.md` - Dialog 管理系统使用指南
- `.project-rules/frontend/architecture.md` - 架构设计指南
- `webserver/frontend/feature/project/page/project-list-filesystem/` - Filesystem 页面代码
- `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/content-toolbar.tsx` - Mushroom Toolbar
- `webserver/frontend/feature/mushroom/block/new-node-dropdown-button.tsx` - New 下拉菜单
- `webserver/frontend/feature/mushroom/manager/common/asset-list-upload-manager.ts` - Upload Manager
- `webserver/frontend/component/ui/modal/preset/basic-dialog.tsx` - BasicDialog 组件
