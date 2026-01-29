# T-001 添加批量任务和预览项 API 客户端

## 需求描述

添加批量任务和预览项相关的 API 客户端函数，用于调用后端接口。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 添加 `createBulkTask` API 函数（POST /api/llm-editor/cta/batch/）
- 添加 `getBulkTaskList` API 函数（GET /api/llm-editor/cta/batch/）
- 添加 `getBulkTaskDetail` API 函数（GET /api/llm-editor/cta/batch/{id}/）
- 添加 `getPreviewList` API 函数（GET /api/llm-editor/cta/previews/）
- 定义 TypeScript 类型接口

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 API 调用规范

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - 现有 API 文件
- `webserver/frontend/feature/tool.cta-generator/type.ts` - 类型定义文件

**其他:**
- 后端设计文档：`.luokingspec/archive/add-cta-batch-backend/design.md`

## 注意点

- 使用 `clientRequest` 统一请求方法
- 正确定义请求和响应的 TypeScript 类型
- 处理错误响应和异常情况
- 支持分页参数（CursorPagination）

## Scenario

### Scenario 1: 创建批量任务

    **场景描述：**
    - **前置条件**：用户填写了 URL 和 Size
    - **操作步骤**：
      1. 调用 `createBulkTask({ sources: [...] })`
      2. 后端创建任务并返回 `bulk_generate_task_id` 和 `task_id`
    - **预期结果**：
      - 返回批量任务 ID
      - 返回 Celery 任务 ID 用于轮询

### Scenario 2: 获取批量任务列表

    **场景描述：**
    - **前置条件**：用户进入批量任务列表页面
    - **操作步骤**：
      1. 调用 `getBulkTaskList({ page_size: 20 })`
      2. 后端返回分页的任务列表
    - **预期结果**：
      - 返回任务列表（results）
      - 返回分页信息（next, previous）

### Scenario 3: 获取预览项列表

    **场景描述：**
    - **前置条件**：用户查看某个批量任务的预览项
    - **操作步骤**：
      1. 调用 `getPreviewList({ bulk_task_id: 'xxx' })`
      2. 后端返回该任务的预览项列表
    - **预期结果**：
      - 返回预览项列表
      - 每项包含完整的 prefill 数据

## Checklist

- [x] C-001 `createBulkTask` API 函数实现
- [x] C-002 `getBulkTaskList` API 函数实现
- [x] C-003 `getBulkTaskDetail` API 函数实现
- [x] C-004 `getPreviewList` API 函数实现
- [x] C-005 TypeScript 类型定义完整
- [x] C-006 错误处理正确
- [x] C-007 支持分页参数

---

# T-002 修改 BatchListViewController 使用真实 API (deps: T-001)

## 需求描述

修改 `BatchListViewController`，使用 `PaginatedQueryManager` 调用真实的批量任务列表 API，并添加轮询机制。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 使用 `PaginatedQueryManager` 替换 Mock 数据
- 添加轮询机制，定期刷新任务状态
- 支持分页加载
- 轮询间隔为 3 秒

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式
- `.project-rules/frontend/utility-managers.md` - PaginatedQueryManager 使用

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - ViewController
- `webserver/frontend/feature/tool.cta-generator/context/batch-list-view-controller-context.tsx` - Context

**前端路由:**
- `/tool/cta-generator/batch` - 批量任务列表页

## 注意点

- `PaginatedQueryManager` 需要传入稳定的 API 函数引用
- 轮询使用 `ProcessingTaskManager` 或自定义 `setInterval`
- 在 `dispose()` 时清理轮询定时器
- 状态定义：列表数据、加载状态、错误信息

## Scenario

### Scenario 1: 页面加载获取任务列表

    **场景描述：**
    - **前置条件**：用户进入批量任务列表页面
    - **操作步骤**：
      1. `bootstrap()` 时调用 `fetchTasks()`
      2. `PaginatedQueryManager` 获取第一页数据
    - **预期结果**：
      - 显示真实的批量任务列表
      - 显示加载状态

### Scenario 2: 定期刷新任务状态

    **场景描述：**
    - **前置条件**：用户在批量任务列表页面
    - **操作步骤**：
      1. 启动轮询定时器（3 秒间隔）
      2. 定期刷新任务列表
      3. 更新任务状态和进度
    - **预期结果**：
      - 任务状态实时更新
      - 进度统计正确显示

### Scenario 3: 离开页面停止轮询

    **场景描述：**
    - **前置条件**：用户离开批量任务列表页面
    - **操作步骤**：
      1. 调用 `dispose()`
      2. 清理轮询定时器
    - **预期结果**：
      - 轮询停止
      - 资源正确释放

## Checklist

- [x] C-001 使用 `PaginatedQueryManager` 替换 Mock 数据
- [x] C-002 实现 `fetchTasks()` 方法
- [x] C-003 添加轮询机制（3 秒间隔）
- [x] C-004 `dispose()` 时清理定时器
- [x] C-005 状态定义正确（列表、加载、错误）
- [x] C-006 支持分页加载
- [x] C-007 错误处理正确

---

# T-003 修改批量列表页使用真实数据 (deps: T-002)

## 需求描述

修改批量列表页组件，从 `BatchListViewController` 获取真实数据并显示。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 从 ViewController 的 `combinedStore` 获取数据
- 显示任务状态和进度统计
- 显示每个任务的预览项缩略图（PreviewOnly iframe）
- 支持 View all 和 Download 按钮

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 组件与 Manager 交互

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch/index.tsx` - 列表页组件
- `webserver/frontend/feature/tool.cta-generator/page/batch/components/batch-list-item.tsx` - 列表项组件

## 注意点

- 使用 `useCombinedStore` 从 `combinedStore` 获取状态
- 预览项缩略图使用 PreviewOnly 模式的 iframe
- 任务状态显示：pending/running/done/failed
- 进度统计显示：total/queued/running/done/failed

## Scenario

### Scenario 1: 显示任务列表

    **场景描述：**
    - **前置条件**：任务列表已加载
    - **操作步骤**：
      1. 从 `vc.bulkTaskQueryManager.store` 获取数据
      2. 渲染任务列表
    - **预期结果**：
      - 显示所有批量任务
      - 每个任务显示状态和进度

### Scenario 2: 显示任务进度

    **场景描述：**
    - **前置条件**：任务正在处理中
    - **操作步骤**：
      1. 从 `progress` 字段获取统计数据
      2. 显示进度条或数字
    - **预期结果**：
      - 正确显示进度（如：3/10 完成）

### Scenario 3: View all 跳转

    **场景描述：**
    - **前置条件**：用户点击 View all 按钮
    - **操作步骤**：
      1. 跳转到预览页面
      2. 传递 `bulk_task_id` 参数
    - **预期结果**：
      - 正确跳转到预览页面
      - URL 包含 `bulk_task_id`

## Checklist

- [x] C-001 从 `combinedStore` 获取任务列表数据
- [x] C-002 显示任务状态和进度
- [x] C-003 显示加载状态
- [x] C-004 显示错误状态
- [x] C-005 View all 按钮跳转正确
- [x] C-006 空状态显示
- [x] C-007 预览项缩略图显示（PreviewOnly）

---

# T-004 修改 NewBatchViewController 调用真实 API (deps: T-001)

## 需求描述

修改 `NewBatchViewController`，调用真实的 `createBulkTask` API 创建批量任务。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 调用 `createBulkTask` API 创建任务
- API 返回后立即跳转到预览页面
- 传递 `bulk_task_id` 参数
- 处理 API 调用失败的情况

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 新建批量页

**前端路由:**
- `/tool/cta-generator/new-batch` - 新建批量页
- `/tool/cta-generator/batch-preview` - 预览页

## 注意点

- 表单数据验证：URL 格式、Size 范围（1-10）
- API 调用使用 `ProcessingTaskManager` 管理加载状态
- 成功后立即跳转，不等待任务完成
- 失败时显示错误提示

## Scenario

### Scenario 1: 创建批量任务并跳转

    **场景描述：**
    - **前置条件**：用户填写了 URL 和 Size
    - **操作步骤**：
      1. 用户点击 Generate 按钮
      2. 调用 `createBulkTask({ sources: [...] })`
      3. API 返回 `bulk_generate_task_id`
      4. 立即跳转到预览页面
    - **预期结果**：
      - 后端创建批量任务
      - 跳转到预览页面（携带 `bulk_task_id`）

### Scenario 2: API 调用失败

    **场景描述：**
    - **前置条件**：API 调用失败（网络错误或后端错误）
    - **操作步骤**：
      1. 捕获 API 错误
      2. 显示错误提示
    - **预期结果**：
      - 显示友好的错误信息
      - 用户可以重试

## Checklist

- [x] C-001 `handleGenerate()` 方法调用 `createBulkTask` API
- [x] C-002 API 成功后立即跳转到预览页
- [x] C-003 跳转时传递 `bulk_task_id` 参数
- [x] C-004 显示加载状态
- [x] C-005 错误处理和提示
- [x] C-006 表单验证正确
- [x] C-007 按钮状态管理（禁用/启用）

---

# T-005 修改 BatchPreviewViewController 获取真实预览数据 (deps: T-001)

## 需求描述

修改 `BatchPreviewViewController`，从后端获取真实的预览项数据并显示。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 使用 `createAutoKeyMiniQueryClient` 管理预览项查询
- 根据 `bulk_task_id` 获取预览项列表
- 支持按产品分组显示
- 支持多个 CreatifyHostController 实例管理

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式
- `.project-rules/frontend/utility-managers.md` - createAutoKeyMiniQueryClient 使用

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 预览页组件

**前端路由:**
- `/tool/cta-generator/batch-preview` - 预览页

## 注意点

- `createAutoKeyMiniQueryClient` 需要传入稳定的 API 函数引用
- 预览项数据包含 prefill JSON
- 需要管理多个 CreatifyHostController 实例（每个预览项一个）
- 按产品（product_id）分组显示

## Scenario

### Scenario 1: 从批量任务 ID 获取预览项

    **场景描述：**
    - **前置条件**：URL 包含 `bulk_task_id` 参数
    - **操作步骤**：
      1. 解析 `bulk_task_id`
      2. 调用 `getPreviewList({ bulk_task_id })`
      3. 获取预览项列表
    - **预期结果**：
      - 显示真实的预览项列表
      - 每项包含完整的 prefill 数据

### Scenario 2: 按产品分组显示

    **场景描述：**
    - **前置条件**：预览项已加载
    - **操作步骤**：
      1. 按 `product_id` 分组
      2. 每组显示产品信息和预览项
    - **预期结果**：
      - 正确分组显示
      - 产品标题和预览项对应

### Scenario 3: 管理 CreatifyHostController 实例

    **场景描述：**
    - **前置条件**：预览项已加载
    - **操作步骤**：
      1. 为每个预览项创建 CreatifyHostController
      2. 设置为 PreviewOnly 模式
      3. 通过 prefill 数据更新 iframe
    - **预期结果**：
      - 每个 iframe 独立控制
      - 正确显示 prefill 数据

## Checklist

- [x] C-001 使用 `createAutoKeyMiniQueryClient` 管理预览项查询
- [x] C-002 根据 `bulk_task_id` 获取预览项列表
- [x] C-003 按产品分组显示
- [x] C-004 管理多个 CreatifyHostController 实例
- [x] C-005 PreviewOnly 模式设置正确
- [x] C-006 显示加载状态
- [x] C-007 显示错误状态
- [x] C-008 空状态显示

---

# T-006 添加批量下载功能实现 (deps: T-005)

## 需求描述

实现批量下载功能，从多个 iframe 收集导出的 HTML 并打包成 zip 下载。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 调用 iframe 注册的导出函数
- 收集所有 File 或 Blob
- 使用 JSZip 打包成 zip
- 触发浏览器下载
- 显示下载进度

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/util/zip-downloader.ts` - 下载工具（待创建）

**其他:**
- JSZip 文档：https://stuk.github.io/jszip/

## 注意点

- 需要等待所有 iframe 导出完成
- 文件命名要有规律（如 preview-1.html, preview-2.html）
- 处理单个 iframe 失败的情况
- 显示下载进度

## Scenario

### Scenario 1: 预览页批量下载

    **场景描述：**
    - **前置条件**：预览页面已加载，预览项已就绪
    - **操作步骤**：
      1. 用户点击下载按钮
      2. 系统调用所有 iframe 的导出函数
      3. 收集所有 HTML
      4. 打包下载
    - **预期结果**：
      - 显示下载进度
      - 成功下载 zip 文件

### Scenario 2: 部分导出失败

    **场景描述：**
    - **前置条件**：某个 iframe 导出失败
    - **操作步骤**：
      1. 系统调用所有导出函数
      2. 部分成功，部分失败
    - **预期结果**：
      - 显示错误提示
      - 下载成功的部分
      - 记录失败信息

## Checklist

- [x] C-001 iframe 导出函数调用实现
- [x] C-002 HTML 内容收集实现
- [x] C-003 JSZip 打包功能实现
- [x] C-004 浏览器下载触发实现
- [x] C-005 文件命名规则实现
- [x] C-006 下载进度显示
- [x] C-007 错误处理和降级

---

## 总结

| 任务 | 描述 | 依赖 | 状态 |
|------|------|------|------|
| T-001 | 添加批量任务和预览项 API 客户端 | 无 | ✅ 完成 |
| T-002 | 修改 BatchListViewController 使用真实 API | T-001 | ✅ 完成 |
| T-003 | 修改批量列表页使用真实数据 | T-002 | ✅ 完成 |
| T-004 | 修改 NewBatchViewController 调用真实 API | T-001 | ✅ 完成 |
| T-005 | 修改 BatchPreviewViewController 获取真实预览数据 | T-001 | ✅ 完成 |
| T-006 | 添加批量下载功能实现 | T-005 | ✅ 完成 |

**并行度分析**：
- T-002 和 T-004、T-005 可以并行开发（都依赖 T-001）
- T-003 必须在 T-002 之后
- T-006 必须在 T-005 之后

## 执行摘要

本次变更成功将 CTA Generator Batch Mode 从 Mock 数据切换到真实的后端 API。主要完成：

1. **API 层**：添加了批量任务和预览项的 API 客户端函数及类型定义
2. **Manager 层**：
   - BatchListViewController 使用 PaginatedQueryManager 管理任务列表，添加 3 秒轮询机制
   - NewBatchViewController 直接调用 createBulkTask API 创建任务
   - BatchPreviewViewController 使用 createAutoKeyMiniQueryClient 管理预览项查询
3. **View 层**：
   - 批量列表页显示真实数据和实时状态
   - 新建批量页调用真实 API 并跳转
   - 预览页显示真实预览项并支持按产品分组
4. **批量下载**：创建了独立的 zip-downloader 工具，支持批量下载 HTML 文件

所有任务已完成，TypeScript 检查通过，代码已格式化。
