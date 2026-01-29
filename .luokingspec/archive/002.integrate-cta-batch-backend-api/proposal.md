# Proposal: CTA Generator Batch Mode - 接入后端真实 API

## 需求摘要

将 CTA Generator Batch Mode 前端从 Mock 数据切换到真实的后端 API，包括批量任务列表、创建批量任务、预览项展示等功能。

## 背景与动机

### 现有情况

1. **前端已完成 Mock 开发**：Batch Mode 相关页面（列表页、新建页、预览页）已使用 Mock 数据完成开发
2. **后端 API 已完成**：后端已提供完整的批量任务管理接口
3. **数据源不统一**：前端使用静态 Mock 数据，无法与实际业务数据关联

### 问题与痛点

1. **功能不可用**：用户创建的批量任务无法持久化，刷新页面后数据丢失
2. **无实时状态**：无法查看批量任务的真实处理进度
3. **无真实数据**：预览项显示的是 Mock 数据，不是 AI 生成的真实内容

### 解决方案

全面采用后端 API 替换前端 Mock 数据：
- 批量任务列表使用 `GET /api/llm-editor/cta/batch/` 接口
- 创建批量任务使用 `POST /api/llm-editor/cta/batch/` 接口
- 预览项列表使用 `GET /api/llm-editor/cta/previews/` 接口
- 支持轮询刷新任务状态

## 目标与成功标准

### 目标

1. 批量任务列表页显示真实的批量任务数据，支持定期刷新
2. 创建批量任务页调用后端 API 创建任务并立即跳转到预览页
3. 预览页从后端获取真实的预览项数据并显示

### 成功标准

- 用户创建的批量任务可以持久化保存
- 批量任务列表显示真实数据，状态实时更新
- 预览页显示真实生成的预览项内容
- 支持定期刷新任务状态（轮询批量任务列表）

## 范围与边界

### In Scope（本次包含）

#### API 层
- 添加批量任务相关的 API 客户端函数
- 添加预览项相关的 API 客户端函数

#### Manager 层
- 修改 `BatchListViewController` 使用 `PaginatedQueryManager` 获取批量任务列表
- 添加轮询机制，定期刷新批量任务状态
- `NewBatchViewController` 调用真实 API 创建任务
- `BatchPreviewViewController` 从后端获取预览项数据

#### View 层
- 修改批量列表页，显示真实数据和实时状态
- 修改新建批量页，调用真实 API
- 修改预览页，显示真实预览项

### Out of Scope（本次不包含）

- **HTML 文件修改**：不修改 `iframe/cta-generator-test.html`
- **编辑功能**：不实现预览项的编辑功能（PATCH 接口）
- **删除功能**：不实现批量任务的删除功能
- **生成器页面**：不涉及 `/tool/cta-generator/generator` 单个生成页面

## 用户/系统场景

### 场景 1：查看批量任务列表

- **谁**：电商运营人员
- **何时/条件**：进入批量任务列表页面
- **做什么**：
  1. 页面自动加载批量任务列表
  2. 显示每个任务的状态、进度统计
  3. 定期刷新列表（轮询）
- **得到什么**：
  - 真实的批量任务列表
  - 实时更新的任务状态

### 场景 2：创建新的批量任务

- **谁**：电商运营人员
- **何时/条件**：需要为多个产品批量生成 CTA
- **做什么**：
  1. 填写多个 URL 和对应的 Size
  2. 点击 Generate 按钮
  3. 后端创建批量任务，返回 task_id
  4. 立即跳转到预览页面（携带 bulk_task_id）
- **得到什么**：
  - 后端创建的批量任务
  - 跳转到预览页面查看生成进度

### 场景 3：查看预览项列表

- **谁**：电商运营人员
- **何时/条件**：从列表页点击 View all 或新建页跳转过来
- **做什么**：
  1. 根据 bulk_task_id 获取预览项列表
  2. 显示每个预览项的 prefill 数据
  3. 支持按产品分组显示
- **得到什么**：
  - 真实的预览项数据
  - AI 生成的背景图和文案

### 场景 4：定期刷新任务状态

- **谁**：系统
- **何时/条件**：用户在批量任务列表页面
- **做什么**：
  1. 定期调用 `GET /api/llm-editor/cta/batch/` 接口
  2. 更新任务状态和进度统计
  3. 用户离开页面时停止轮询
- **得到什么**：
  - 实时更新的任务状态
  - 最新的进度信息

## 约束与假设

### 约束

#### 技术约束
- 使用 `PaginatedQueryManager` 管理批量任务列表
- 使用 `ProcessingTaskManager` 管理轮询逻辑
- 使用 `createAutoKeyMiniQueryClient` 管理预览项查询

#### 兼容性约束
- 不修改 HTML 文件，假设 HTML 已支持所需功能
- 不改变现有的页面路由和布局

### 假设

1. **后端 API 可用**：假设后端接口已部署且可正常调用
2. **数据格式一致**：假设后端响应格式与设计文档一致
3. **轮询间隔**：假设每 3 秒轮询一次批量任务列表

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| **m2** | CTABulkGenerateTask | 批量任务模型 |
| **m1** | CTAIFramePreview | 预览项模型 |
| **bulk_task_id** | 批量任务 ID | UUID 格式 |
| **prefill** | iframe 预填充数据 | 包含背景图、文案、颜色等 |
| **轮询** | 定期请求接口 | 用于刷新任务状态 |

## 参考与链接

### 后端 API 文档
- `.luokingspec/archive/add-cta-batch-backend/design.md` - 后端设计文档
- `.luokingspec/archive/add-cta-batch-backend/proposal.md` - 后端需求文档

### 前端相关代码
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - 批量列表 ViewController
- `webserver/frontend/feature/tool.cta-generator/page/batch/index.tsx` - 批量列表页
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 新建批量页
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 预览页
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - API 客户端

### 设计文档
- 本变更的 `design.md` - 详细设计文档（如需要）
- 本变更的 `tasks.md` - 任务拆解文档
