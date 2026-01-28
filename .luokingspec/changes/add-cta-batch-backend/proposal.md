# Proposal: 为 CTA Generator 添加 Batch Mode 后端支持

## 需求摘要

为 CTA Generator 工具添加后端 Batch Mode 支持，允许用户从多个 URL/Product 批量生成 CTA 预览项，支持并行处理和状态追踪。

## 背景与动机

### 现有情况

当前 CTA Generator 仅支持 **Single Mode**（单条生成）：
- 用户每次只能从一个 URL/Product 生成一个 CTA 预览
- 使用 `ProductCTAFlow` 模型存储单条分析结果
- 通过 `generate_creative_suggestions_v2` API 生成创意建议

### 问题与痛点

1. **效率低**：用户需要重复操作多次才能生成多个 CTA
2. **批量场景缺失**：电商用户通常有大量产品需要批量生成 CTA
3. **无任务管理**：无法查看批量任务进度、状态和历史记录
4. **前端已完成 Mock**：前端 Batch Mode 已使用 Mock 数据开发完成，等待后端实现

### 解决方案

添加完整的后端 Batch Mode 支持：
- 新增两个 Model：`CTABulkGenerateTask`（批量任务）和 `CTAIFramePreview`（预览项）
- 新增批量 API 接口
- 实现异步任务流程，支持并行生成和排队机制
- 支持状态追踪和进度查询

## 目标与成功标准

### 目标

1. 支持用户从多个 URL 批量生成 CTA 预览项
2. 提供批量任务管理接口（创建、查询、状态追踪）
3. 支持并行生成和智能排队（Rate Limit + 状态追踪）
4. 提供预览项的查询和编辑能力

### 成功标准

- 用户可以创建包含最多 5 个 URL 的批量任务
- 每个 URL 可指定 1-10 个预览项（batch_size）
- 支持并行生成（Rate Limit: 20/m），自动排队
- 可以实时查询任务进度（pending/queued/running/done/failed）
- 单条预览项支持 prefill 的局部或整块更新

## 范围与边界

### In Scope（本次包含）

#### Model 层
- 新增 `CTABulkGenerateTask` 模型（批量任务）
- 新增 `CTAIFramePreview` 模型（预览项）
- 复用现有 `ECommerceProduct` 模型

#### API 层
- `POST /api/llm-editor/cta/batch/` - 创建批量任务
- `GET /api/llm-editor/cta/batch/` - 获取批量任务列表
- `GET /api/llm-editor/cta/batch/{id}/` - 获取批量任务详情
- `GET /api/llm-editor/cta/previews/` - 获取预览项列表
- `PATCH /api/llm-editor/cta/previews/{id}/` - 更新预览项

#### 任务层
- `bulk_generate_main_task` - 批量生成主任务
- `process_url_source_task` - URL 处理任务（爬取、选图、创建 m1）
- `generate_single_preview_task` - 单条预览生成任务
- `generate_background_image_task` - 背景图生成子任务
- `generate_prefill_task` - Prefill 生成子任务

#### 业务逻辑
- 图片相关度排序（基于 CLIP）
- batch_size 循环补足机制
- 并行控制（Rate Limit + queued 状态）

### Out of Scope（本次不包含）

- **前端实现** - 前端已使用 Mock 数据开发，本次不涉及
- **prod.tsx 修改** - 严格禁止修改线上版本
- **数据库迁移脚本** - 由 Django 自动生成，不在本次任务范围
- **性能优化** - 基础实现，不做深度优化
- **用户权限细化** - 使用现有的 workspace 权限机制
- **Batch Mode 删除功能** - 本次不支持删除批量任务

## 用户/系统场景

### 场景 1：创建批量任务

- **谁**：电商运营人员
- **何时/条件**：需要为多个产品批量生成 CTA 广告
- **做什么**：
  1. 输入多个产品 URL
  2. 为每个 URL 指定 batch_size（1-10）
  3. 提交批量任务
- **得到什么**：
  - 返回 `bulk_generate_task_id`
  - 返回 Celery `task_id` 用于轮询状态
  - 任务自动开始处理

### 场景 2：查看批量任务进度

- **谁**：电商运营人员
- **何时/条件**：批量任务已创建，需要了解处理进度
- **做什么**：调用 `GET /batch/{id}/` 接口
- **得到什么**：
  - 任务状态（pending/running/done/failed）
  - 进度统计（total/pending/queued/running/done/failed）
  - 每个 URL 的处理情况汇总

### 场景 3：查看预览项列表

- **谁**：电商运营人员
- **何时/条件**：批量任务完成后，需要查看和编辑预览项
- **做什么**：调用 `GET /previews/?bulk_task_id=xxx` 接口
- **得到什么**：
  - 分页的预览项列表
  - 每项包含完整的 prefill 数据（背景图、文案、颜色等）
  - 可以按 `product_id` 过滤特定 URL 的预览项

### 场景 4：编辑预览项 Prefill

- **谁**：电商运营人员
- **何时/条件**：需要调整某个预览项的内容
- **做什么**：调用 `PATCH /previews/{id}/` 接口，传入要修改的字段
- **得到什么**：
  - 支持局部更新（只传要改的字段）
  - 返回更新后的完整 prefill

### 场景 5：并行生成与排队

- **系统**：Celery 任务系统
- **何时/条件**：用户创建大任务（10 个 URL × 10 batch_size = 100 条）
- **做什么**：
  1. 前 20 个任务立即开始执行（status: running）
  2. 超出 Rate Limit 的任务自动排队（status: queued）
  3. 随着任务完成，排队的任务自动开始
- **得到什么**：
  - 系统不会过载
  - 用户可以通过 API 看到 queued/running 状态
  - 所有任务最终都会完成（除非失败）

## 约束与假设

### 约束

#### 业务约束
- **batch_size 范围**：[1, 10]
- **URL 数量限制**：一次最多 5 个 URL
- **workspace 隔离**：所有数据按 workspace 隔离
- **级联删除**：product 或 bulk_task 删除时，m1 级联删除

#### 技术约束
- **Rate Limit**：20/m（每分钟最多 20 个任务）
- **并发控制**：使用 Celery 的 rate_limit + queued 状态
- **分页方式**：统一使用 CursorPagination
- **数据存储**：prefill 使用 JSONField，progress 实时计算

#### 兼容性约束
- **不修改 prod.tsx**：严格禁止修改线上版本
- **不考虑前端 Mock**：完全以后端为主设计

### 假设

1. **产品图片可获取**：假设爬取的 product 有足够的 `image_urls` 用于排序
2. **AI 服务可用**：假设 Gemini 和 image2image 服务正常可用
3. **Celery 运行正常**：假设 Celery worker 正常运行，有足够资源
4. **前端就绪**：假设前端已准备好对接真实 API

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| **m2** | CTABulkGenerateTask | 批量任务模型，一次批量操作 |
| **m1** | CTAIFramePreview | 预览项模型，单个预览单元 |
| **batch_size** | 单个 URL 的预览项数量 | 范围 [1, 10] |
| **pre-fill / prefill** | iframe 预填充数据 | 包含背景图、文案、颜色等 |
| **Rate Limit** | Celery 任务速率限制 | 20/m，每分钟最多 20 个任务 |
| **queued** | 排队等待状态 | 任务在队列中等待执行 |
| **cursor pagination** | 游标分页 | 使用 next/previous URL 分页 |
| **CLIP** | 对比语言-图像预训练模型 | 用于图片相关度排序 |

## 参考与链接

### 现有相关代码

#### Model 层
- `webserver/backend/products/models/product.py` - ECommerceProduct 模型
- `webserver/backend/tools/llm_editor/models.py` - ProductCTAFlow 模型

#### API 层
- `webserver/backend/tools/llm_editor/views.py` - ProductCTAFlowViewSet
- `webserver/backend/tools/llm_editor/serializers.py` - 现有 Serializer

#### 任务层
- `webserver/backend/tools/llm_editor/tasks/v2.py` - generate_creative_suggestions_v2_task, image2image_task

#### 前端相关
- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` - 入口代码点
- `.luokingspec/archive/cta-generator-batch-mode/` - 前端 Batch Mode 设计文档

### 设计文档

- 本变更的 `design.md` - 详细设计文档
- 本变更的 `tasks.md` - 任务拆解文档
