# Proposal: 项目列表页文件系统风格改造

## 需求摘要

将 `/projects/list` 页面改造为文件系统风格的管理界面，支持文件夹层级导航、双击进入、面包屑、单项操作菜单和批量操作。新旧视图通过 URL 参数 `view=filesystem` 切换共存；后端为 ProjectFolder 添加独立的层级文件系统支持（parent 字段），不影响现有扁平行为。

## 背景与动机

- 当前项目列表页面采用扁平文件夹列表 + 独立的 `folder-detail` 页面，用户无法在同一页面内浏览文件夹层级，体验割裂。
- Mushroom 的 asset 管理页面已实现文件系统风格（面包屑导航、双击进入文件夹、URL 驱动层级），用户体验优于当前项目列表。
- 本次改造将项目列表页的管理体验对齐到 mushroom asset 的水平，但完全隔离于 mushroom 组件体系——如需类似功能则复制到 project feature 下。

## 目标与成功标准

- 在 `/projects/list` 路由下提供文件系统风格的文件夹层级管理体验。
- 支持双击进入文件夹、面包屑返回上级、文件夹创建/重命名/删除/移动。
- 新旧视图共存，通过 URL 参数 `view=filesystem` 切换，默认保持 legacy 视图。
- 后端添加独立的层级文件系统支持，不破坏现有扁平文件夹行为。
- 进入 MediaJob 详情保持现状（给到 mediaJobId）。

**成功标准**：

- 用户通过 `?view=filesystem` 可以看到文件系统风格的项目列表页。
- 双击文件夹可进入子文件夹，面包屑正确显示层级路径。
- 创建、重命名、删除、移动文件夹操作均正常工作。
- MediaJob 列表正确展示当前文件夹内的内容，点击进入详情行为不变。
- 现有 legacy 视图和 folder-detail 页面完全不受影响。

## 范围与边界

### In Scope（本次包含）

- 文件系统风格的 `ProjectListFileSystemPage`（新页面）
- URL 参数驱动的视图切换（`view=filesystem`）
- 面包屑导航组件（项目内独立实现，不依赖 mushroom）
- 文件夹层级浏览（双击导航进入子文件夹）
- 文件夹 CRUD + 移动操作（dropdown/bulk bar → dialog 选择目标文件夹）
- MediaJob 列表（按当前文件夹筛选，复用已有组件）
- 批量操作（文件夹选择 + MediaJob 选择，互斥）
- 后端 ProjectFolder 添加 `parent` 字段（nullable FK to self）
- 后端 folder detail 接口添加 `ancestors` 字段
- 后端移动文件夹接口（修改 parent）

### Out of Scope（本次不包含）

- 修改 legacy 视图或 folder-detail 页面 — 保持现有行为
- 移动端适配 — 后续优化
- 使用 mushroom 组件 — 完全隔离，如需则复制到 project feature
- 修改现有扁平文件夹 API 的默认行为 — parent 参数不传时保持向后兼容
- 文件夹嵌套深度限制 — 暂不限制

## 用户/系统场景

### 场景 1：浏览文件夹层级

- **谁**：已登录用户
- **何时/条件**：访问 `/projects/list?view=filesystem`
- **做什么**：看到根目录文件夹列表和未分类的 MediaJob；双击某个文件夹进入子级
- **得到什么**：面包屑更新显示路径，URL 更新为 `?folderId=xxx&view=filesystem`，内容变为子文件夹 + 该文件夹内的 MediaJob

### 场景 2：移动文件夹

- **谁**：已登录用户
- **何时/条件**：在 filesystem 视图中，通过 dropdown 菜单或批量操作栏选择"移动到"
- **做什么**：弹出 dialog 展示文件夹树，选择目标文件夹并确认
- **得到什么**：文件夹被移动到目标文件夹下，当前列表刷新

### 场景 3：通过 URL 直接访问子文件夹

- **谁**：已登录用户（通过分享链接）
- **何时/条件**：直接打开 `/projects/list?folderId=xxx&view=filesystem`
- **做什么**：页面加载，获取文件夹详情和祖先链
- **得到什么**：面包屑正确显示从根目录到当前文件夹的完整路径，内容展示该文件夹的子文件夹和 MediaJob

### 场景 4：创建子文件夹

- **谁**：已登录用户
- **何时/条件**：在 filesystem 视图的某个文件夹内
- **做什么**：点击"新建文件夹"按钮，输入名称
- **得到什么**：文件夹创建在当前目录下（parent 为当前 folderId），列表刷新

### 场景 5：MediaJob 详情导航

- **谁**：已登录用户
- **何时/条件**：在 filesystem 视图中看到 MediaJob 列表
- **做什么**：点击某个 MediaJob
- **得到什么**：导航到 MediaJob 详情页（保持现有行为，给到 mediaJobId）

## 约束与假设

### 约束

- 不使用任何 mushroom 组件，如需类似功能则复制到 project feature 下
- 后端 `parent` 参数不传时保持现有行为（返回所有文件夹）
- 进入 MediaJob 详情保持现状（给到 mediaJobId）
- 开发顺序严格遵循：Phase 0（API contract）→ Phase 1（Frontend mock）→ Phase 2（Backend）→ Phase 3（Integration）
- 遵循 Manager 模式架构（`.project-rules/frontend/architecture.md`）

### 假设

- 现有 ProjectFolder 添加 parent 字段后，所有现有文件夹 parent 为 null（即根目录），符合预期
- 文件夹嵌套深度暂不限制
- 删除文件夹时级联删除子文件夹（model 使用 `on_delete=CASCADE`）
- MediaJob 与 ProjectFolder 是 M2M 关系，删除文件夹只解除关联，不删除 MediaJob 本身

## 名词与术语

| 术语 | 含义 | 备注 |
|------|------|------|
| Filesystem View | 文件系统风格视图 | 通过 `?view=filesystem` URL 参数激活 |
| Legacy View | 现有扁平列表视图 | 默认视图，即 `ProjectPage` |
| parent | 文件夹的父级 FK | null 表示根目录 |
| ancestors | 文件夹祖先链 | 从根到当前文件夹的有序数组，用于面包屑 |
| folderId | URL 参数，当前文件夹 ID | 缺省或空表示根目录 |

## 参考与链接

- 实现计划：`.doc/projects-list-filesystem-plan.md`
- 现有项目列表页面：`webserver/frontend/feature/project/page/project-page.tsx`
- 入口文件：`webserver/frontend/feature/project/page/project-list-client.tsx`
- 参考实现（Mushroom asset）：`webserver/frontend/feature/mushroom/sub-feature/project-management/`
- 后端文件夹模型：`webserver/backend/media/models/project_folder.py`
- 后端文件夹 API：`webserver/backend/media/views/project_folder.py`
- 前端文件夹 API：`webserver/frontend/feature/project/api/folder.ts`
- 前端架构规范：`.project-rules/frontend/architecture.md`
- 前端目录结构规范：`.project-rules/frontend/directory-structure.md`
- 后端规范：`.project-rules/backend/index.md`
