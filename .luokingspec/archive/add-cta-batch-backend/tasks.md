# 任务列表

本变更包含以下 10 个任务，按依赖顺序排列：

---

# T-001 创建批量任务和预览项 Model (deps: 无)

## 需求描述

创建两个新的 Django Model：`CTABulkGenerateTask`（批量任务）和 `CTAIFramePreview`（预览项）。

- `CTABulkGenerateTask` 存储批量任务的基本信息和状态
- `CTAIFramePreview` 存储单个预览项的数据，关联 product 和 bulk_task
- 支持按 workspace 隔离和查询
- 支持级联删除

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/models.py` - 参考 `ProductCTAFlow` 的现有实现
- `webserver/backend/products/models/product.py` - 参考 `ECommerceProduct` 的 Mixin 使用
- Django Model 文档：https://docs.djangoproject.com/en/stable/topics/db/models/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/models.py` - 在此文件中添加新 Model

## 注意点

- 使用 `UUIDModelMixin`, `TimeStampModelMixin`, `UserAndWorkspaceMixin` 保持一致性
- `CTAIFramePreview.workspace` 是冗余字段，需要在创建时从 `bulk_generate_task` 带入
- 外键删除策略：`on_delete=models.CASCADE`
- 添加数据库索引：`workspace + created_at`, `bulk_generate_task + status`, `product + status`

## Scenario

### Scenario 1: 创建批量任务和预览项

**场景描述：**
用户通过 API 创建批量任务后，系统需要：
1. 创建 `CTABulkGenerateTask` 记录
2. 为每个 URL 创建 `ECommerceProduct`（或复用现有）
3. 为每个 batch_size 创建 `CTAIFramePreview` 记录

**预期结果：**
- Model 正确创建并存储到数据库
- 外键关系正确建立
- workspace 正确关联

## Checklist

- [x] C-001 `CTABulkGenerateTask` Model 创建完成，包含所有必需字段（id, created_at, updated_at, user, workspace, name, status, error_message）
- [x] C-002 `CTAIFramePreview` Model 创建完成，包含所有必需字段（id, created_at, updated_at, workspace, bulk_generate_task, product, prefill, status, error_message）
- [x] C-003 外键关系正确配置（bulk_generate_task → CTABulkGenerateTask CASCADE, product → ECommerceProduct CASCADE）
- [x] C-004 `CTAIFramePreview.workspace` 冗余字段添加，与 `bulk_generate_task.workspace` 语义一致
- [x] C-005 数据库索引添加（workspace, bulk_generate_task, product 相关索引）
- [x] C-006 Meta 配置正确（verbose_name, ordering）
- [x] C-007 `__str__` 方法正确实现

---

# T-002 创建批量任务和预览项 Serializer (deps: T-001)

## 需求描述

创建 `CTABulkGenerateTaskSerializer` 和 `CTAIFramePreviewSerializer`，用于 API 请求/响应的序列化和验证。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/serializers.py` - 参考 `ProductCTAFlowSerializer` 的现有实现
- Django REST Framework Serializers 文档：https://www.django-rest-framework.org/api-guide/serializers/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/serializers.py` - 在此文件中添加新 Serializer

## 注意点

- `CTABulkGenerateTaskSerializer` 需要包含 `progress` 字段（实时计算）
- `progress` 使用 `SerializerMethodField` 实现
- `CTAIFramePreviewSerializer` 的 `prefill` 字段使用 `JSONField`
- 创建批量任务时，`name` 字段自动生成，不需要用户输入
- 需要验证 `sources` 参数：非空，每个 `batch_size` ∈ [1, 10]

## Scenario

### Scenario 1: 序列化批量任务详情

**场景描述：**
用户请求批量任务详情时，需要返回：
- 任务基本信息（id, name, status, created_at, updated_at）
- 进度统计（progress: total/queued/running/done/failed）
- 每个 URL 的处理情况汇总

**预期结果：**
- Serializer 正确序列化所有字段
- progress 字段实时计算并返回
- sources 汇总信息正确

### Scenario 2: 反序列化创建批量任务请求

**场景描述：**
用户提交创建批量任务请求：
```json
{
  "sources": [
    {"url": "https://example.com/product1", "batch_size": 5}
  ]
}
```

**预期结果：**
- Serializer 正确验证请求参数
- `sources` 非空验证
- `batch_size` 范围验证 [1, 10]
- 验证失败返回明确的错误信息

## Checklist

- [x] C-001 `CTABulkGenerateTaskSerializer` 创建完成，包含所有必需字段
- [x] C-002 `progress` 字段使用 `SerializerMethodField` 实现实时计算
- [x] C-003 `CTAIFramePreviewSerializer` 创建完成，包含所有必需字段
- [x] C-004 `prefill` 字段使用 `JSONField`，支持读写
- [x] C-005 创建批量任务时的 Request Serializer 验证规则正确（sources 非空，batch_size 范围）
- [x] C-006 验证失败时返回明确的错误信息

---

# T-003 实现批量任务 ViewSet (CTABulkFlowViewSet) (deps: T-002)

## 需求描述

创建 `CTABulkFlowViewSet`，提供批量任务的 CRUD 接口。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/views.py` - 参考 `ProductCTAFlowViewSet` 的现有实现
- Django REST Framework ViewSets 文档：https://www.django-rest-framework.org/api-guide/viewsets/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/views.py` - 在此文件中添加新 ViewSet
- `webserver/backend/tools/llm_editor/urls.py` - 配置路由

## 注意点

- 使用 `ModelViewSet` 基类
- 通过 `get_queryset()` 按 `current_workspace` 过滤
- 使用 `CursorPagination`，参数仅 `page_size`
- 创建任务时，`name` 字段自动生成（格式：`"Batch Task - Jan 28, 10:30 AM"`）
- 创建任务后立即启动 Celery 任务

## Scenario

### Scenario 1: 创建批量任务

**场景描述：**
用户 POST 请求创建批量任务：
```json
{
  "sources": [
    {"url": "https://example.com/product1", "batch_size": 5}
  ]
}
```

**预期结果：**
- 返回 201 状态码
- 返回 `bulk_generate_task_id`
- 返回 Celery `task_id`
- 自动生成 `name` 字段
- 启动 `bulk_generate_main_task`

### Scenario 2: 获取批量任务列表

**场景描述：**
用户 GET 请求获取批量任务列表，支持 `status` 过滤和分页。

**预期结果：**
- 返回 200 状态码
- 按 `current_workspace` 过滤
- 支持按 `status` 过滤（可选）
- 使用 CursorPagination 分页
- 返回 `next`, `previous`, `results`

### Scenario 3: 获取单个批量任务详情

**场景描述：**
用户 GET 请求获取单个批量任务详情。

**预期结果：**
- 返回 200 状态码
- 包含任务基本信息
- 包含 progress（实时计算）
- 包含 sources 汇总信息

## Checklist

- [x] C-001 `CTABulkFlowViewSet` 创建完成，继承 `ModelViewSet`
- [x] C-002 `get_queryset()` 按 `current_workspace` 过滤
- [x] C-003 `POST /batch/` 接口实现，创建任务并启动 Celery 任务
- [x] C-004 `GET /batch/` 接口实现，支持 status 过滤和 CursorPagination
- [x] C-005 `GET /batch/{id}/` 接口实现，返回任务详情和 progress
- [x] C-006 `name` 字段自动生成逻辑正确（格式：`"Batch Task - {created_at}"`）
- [x] C-007 Celery 任务正确启动（`bulk_generate_main_task.delay()`）
- [x] C-008 URL 路由配置正确

---

# T-004 实现预览项 ViewSet (CTAIFramePreviewViewSet) (deps: T-002)

## 需求描述

创建 `CTAIFramePreviewViewSet`，提供预览项的查询和更新接口。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/views.py` - 参考 `ProductCTAFlowViewSet` 的现有实现
- Django REST Framework ViewSets 文档：https://www.django-rest-framework.org/api-guide/viewsets/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/views.py` - 在此文件中添加新 ViewSet
- `webserver/backend/tools/llm_editor/urls.py` - 配置路由

## 注意点

- 使用 `ReadOnlyModelViewSet` + 自定义 `PATCH` action（或 `ModelViewSet`）
- 通过 `get_queryset()` 按 `current_workspace` 过滤
- 使用 `CursorPagination`，参数仅 `page_size`
- 支持按 `bulk_task_id` 和 `product_id` 过滤
- `PATCH /previews/{id}/` 支持 prefill 的局部或整块更新

## Scenario

### Scenario 1: 获取预览项列表

**场景描述：**
用户 GET 请求获取预览项列表，支持过滤和分页：
```
GET /previews/?bulk_task_id=xxx&product_id=yyy&page_size=20
```

**预期结果：**
- 返回 200 状态码
- 按 `current_workspace` 过滤
- 支持按 `bulk_task_id` 和 `product_id` 过滤（可选）
- 使用 CursorPagination 分页
- 返回 `next`, `previous`, `results`

### Scenario 2: 更新预览项 prefill（局部更新）

**场景描述：**
用户 PATCH 请求更新预览项的部分字段：
```json
{
  "prefill": {
    "headline": "New Headline"
  }
}
```

**预期结果：**
- 返回 200 状态码
- 只更新指定的字段
- 其他字段保持不变
- 返回更新后的完整 prefill

### Scenario 3: 更新预览项 prefill（整块更新）

**场景描述：**
用户 PATCH 请求更新预览项的所有字段：
```json
{
  "prefill": {
    "original_background_url": "...",
    "generated_background_url": "...",
    "headline": "...",
    ...（完整字段）
  }
}
```

**预期结果：**
- 返回 200 状态码
- 替换整个 prefill
- 返回更新后的完整 prefill

## Checklist

- [x] C-001 `CTAIFramePreviewViewSet` 创建完成，继承 `ModelViewSet`
- [x] C-002 `get_queryset()` 按 `current_workspace` 过滤
- [x] C-003 `GET /previews/` 接口实现，支持过滤和 CursorPagination
- [x] C-004 `GET /previews/{id}/` 接口实现，返回单个预览项详情
- [x] C-005 `PATCH /previews/{id}/` 接口实现，支持 prefill 局部或整块更新
- [x] C-006 过滤参数正确（bulk_task_id, product_id）
- [x] C-007 URL 路由配置正确

---

# T-005 实现批量生成主任务 (bulk_generate_main_task) (deps: T-001)

## 需求描述

实现 Celery 主任务 `bulk_generate_main_task`，协调整个批量生成流程。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 参考 `generate_creative_suggestions_v2_task` 的现有实现
- Celery Canvas 文档：https://docs.celeryproject.org/en/stable/userguide/canvas.html
- Django Async 文档：https://docs.djangoproject.com/en/stable/topics/async/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/batch_tasks.py` - 新建文件，实现批量任务

## 注意点

- 使用 `@app2.task` 装饰器
- 更新 m2 状态为 `running`
- 使用 Celery `group` 并行处理多个 URL
- 使用 Celery `chord` 在所有 URL 处理完成后更新 m2 状态
- 错误处理：单个 URL 失败不影响其他 URL

## Scenario

### Scenario 1: 批量生成主任务流程

**场景描述：**
用户创建批量任务后，主任务启动：
1. 更新 m2 状态为 `running`
2. 对每个 URL 启动 `process_url_source_task`（并行）
3. 等待所有 URL 处理完成
4. 更新 m2 状态为 `done` 或 `failed`

**预期结果：**
- 所有 URL 正确处理
- m2 状态正确流转
- 单个 URL 失败不影响其他 URL
- 所有 m1 创建完成后启动生成任务

## Checklist

- [x] C-001 `bulk_generate_main_task` 创建完成，使用 `@app2.task` 装饰器
- [x] C-002 任务开始时更新 m2 状态为 `running`
- [x] C-003 使用 Celery `group` 并行处理多个 URL
- [x] C-004 使用 Celery `chord` 在所有完成后更新 m2 状态
- [x] C-005 错误处理正确：单个 URL 失败不影响其他 URL
- [x] C-006 m2 状态正确流转：pending → running → done/failed

---

# T-006 实现 URL 处理任务 (process_url_source_task) (deps: T-005)

## 需求描述

实现 Celery 任务 `process_url_source_task`，处理单个 URL 的爬取、选图和创建 m1。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/common/product_scraper_mixin.py` - 参考 `scrape_product_from_url_util` 的现有实现
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 参考 URL 处理逻辑
- `webserver/backend/products/tasks/preprocessing.py` - 参考 `select_primary_image` 的实现

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/batch_tasks.py` - 在此文件中实现

## 注意点

- 使用 `@app2.task` 装饰器
- 爬取或复用 `ECommerceProduct`
- 获取 product 的图片列表（`image_urls`）
- 调用图片排序功能（T-010）
- 根据 batch_size 和排序结果确定源图列表（循环补足）
- 创建 batch_size 个 `CTAIFramePreview` 记录
- 返回 m1 IDs 列表

## Scenario

### Scenario 1: URL 处理任务流程

**场景描述：**
主任务为每个 URL 启动处理任务：
1. 爬取或复用 `ECommerceProduct`
2. 获取图片列表并排序
3. 根据 batch_size 确定源图列表（循环补足）
4. 创建 batch_size 个 `CTAIFramePreview`（status=queued）

**预期结果：**
- Product 正确爬取或复用
- 图片正确排序
- 源图列表正确生成（循环补足）
- m1 正确创建并关联

## Checklist

- [x] C-001 `process_url_source_task` 创建完成，使用 `@app2.task` 装饰器
- [x] C-002 爬取或复用 `ECommerceProduct` 逻辑正确
- [x] C-003 获取 product 的图片列表（`image_urls`）
- [x] C-004 调用图片排序功能（`rank_product_images_by_relevance`）
- [x] C-005 根据 batch_size 确定源图列表（循环补足逻辑）
- [x] C-006 创建 batch_size 个 `CTAIFramePreview`（status=queued, workspace=task.workspace）
- [x] C-007 返回 m1 IDs 列表

---

# T-007 实现单条预览生成任务 (generate_single_preview_task) (deps: T-006)

## 需求描述

实现 Celery 任务 `generate_single_preview_task`，生成单条预览的背景图和 prefill。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 参考 `generate_creative_suggestions_v2_task` 和 `image2image_task`
- Celery Canvas 文档：https://docs.celeryproject.org/en/stable/userguide/canvas.html
- Celery Rate Limit 文档：https://docs.celeryproject.org/en/stable/userguide/tasks.html#rate-limits

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/batch_tasks.py` - 在此文件中实现

## 注意点

- 使用 `@app2.task(bind=True, rate_limit='20/m')` 装饰器
- 任务真正开始时更新 m1 状态为 `running`
- 使用 Celery `group` 并行执行两个子任务：背景图生成 + prefill 生成
- 等待两个子任务完成
- 合并结果到 prefill
- 更新 m1 状态为 `done` 或 `failed`
- 失败时记录 `error_message`

## Scenario

### Scenario 1: 单条预览生成流程

**场景描述：**
m1 创建后，启动生成任务：
1. 更新 m1 状态为 `running`（等待 Rate Limit）
2. 并行执行：背景图生成 + prefill 生成
3. 等待两个子任务完成
4. 合并结果到 prefill
5. 更新 m1 状态为 `done`

**预期结果：**
- m1 状态正确流转：queued → running → done
- 背景图和 prefill 并行生成
- prefill 正确合并（original_background_url + generated_background_url + 文案等）
- Rate Limit 生效，超出限制的任务排队

### Scenario 2: 生成失败处理

**场景描述：**
生成任务执行过程中发生错误：
1. 捕获异常
2. 更新 m1 状态为 `failed`
3. 记录 `error_message`

**预期结果：**
- 错误正确捕获
- m1 状态正确更新为 `failed`
- error_message 正确记录

## Checklist

- [x] C-001 `generate_single_preview_task` 创建完成，使用 `@app2.task(bind=True, rate_limit='20/m')` 装饰器
- [x] C-002 任务开始时更新 m1 状态为 `running`
- [x] C-003 使用 Celery `group` 并行执行背景图生成和 prefill 生成
- [x] C-004 等待两个子任务完成
- [x] C-005 合并结果到 prefill（original_background_url + generated_background_url + 文案等）
- [x] C-006 更新 m1 状态为 `done` 或 `failed`
- [x] C-007 失败时记录 `error_message`
- [x] C-008 错误处理正确，不影响其他任务

---

# T-008 实现背景图生成子任务 (generate_background_image_task) (deps: T-007)

## 需求描述

实现 Celery 子任务 `generate_background_image_task`，调用 image2image 生成背景图。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 参考 `image2image_task` 的现有实现
- `webserver/backend/tools/common/prepare_product_creative_assets.py` - 参考 `ctv_image_to_image` 的实现

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/batch_tasks.py` - 在此文件中实现

## 注意点

- 使用 `@app2.task` 装饰器
- 调用 `ctv_image_to_image` 生成背景图
- 输入：源图 URL + prompt
- 输出：生成的背景图 URL
- 失败时抛出异常，由主任务处理

## Scenario

### Scenario 1: 背景图生成流程

**场景描述：**
主任务启动背景图生成子任务：
1. 接收源图 URL 和 prompt
2. 调用 `ctv_image_to_image`
3. 返回生成的背景图 URL

**预期结果：**
- 背景图正确生成
- 返回有效的 URL
- 失败时抛出异常

## Checklist

- [x] C-001 `generate_background_image_task` 创建完成，使用 `@app2.task` 装饰器
- [x] C-002 调用 `ctv_image_to_image` 生成背景图
- [x] C-003 输入参数正确（源图 URL + prompt）
- [x] C-004 返回生成的背景图 URL
- [x] C-005 失败时抛出异常

---

# T-009 实现 prefill 生成子任务 (generate_prefill_task) (deps: T-007)

## 需求描述

实现 Celery 子任务 `generate_prefill_task`，调用 Gemini 生成 prefill。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 参考 `generate_creative_suggestions_v2_with_gemini` 的现有实现

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/batch_tasks.py` - 在此文件中实现

## 注意点

- 使用 `@app2.task` 装饰器
- 调用 `generate_creative_suggestions_v2_with_gemini`
- 输入：product + 源图
- 输出：完整的 prefill JSON（文案、颜色、组件等）
- 失败时抛出异常，由主任务处理

## Scenario

### Scenario 1: Prefill 生成流程

**场景描述：**
主任务启动 prefill 生成子任务：
1. 接收 product 和源图
2. 调用 `generate_creative_suggestions_v2_with_gemini`
3. 返回完整的 prefill JSON

**预期结果：**
- prefill 正确生成
- 包含所有必需字段（headline, subtitle, colors, widgets, visual_vibe, etc.）
- 失败时抛出异常

## Checklist

- [x] C-001 `generate_prefill_task` 创建完成，使用 `@app2.task` 装饰器
- [x] C-002 调用 `generate_creative_suggestions_v2_with_gemini` 生成 prefill
- [x] C-003 输入参数正确（product + 源图）
- [x] C-004 返回完整的 prefill JSON
- [x] C-005 失败时抛出异常

---

# T-010 实现图片排序功能 (rank_product_images_by_relevance) (deps: T-001)

## 需求描述

实现图片排序函数 `rank_product_images_by_relevance`，根据产品内容对图片进行相关度排序。

**需求类型**：Feature

**涉及领域**：后端

## 相关指引

**后端规则:**
- `webserver/backend/products/tasks/preprocessing.py` - 参考 `select_primary_image` 的现有实现
- CLIP 模型文档：https://openai.com/research/clip/

**后端Code Point:**
- `webserver/backend/tools/llm_editor/utils.py` - 在此文件中实现（或新建）

## 注意点

- 使用 CLIP 模型计算图片与产品描述的相关性分数
- 返回排序后的 URL 列表（从高到低相关度）
- 异步函数（使用 `async`）
- 处理图片加载失败的情况

## Scenario

### Scenario 1: 图片排序流程

**场景描述：**
URL 处理任务调用图片排序功能：
1. 接收 product 和图片 URL 列表
2. 使用 CLIP 模型计算相关性分数
3. 返回排序后的 URL 列表

**预期结果：**
- 图片正确排序
- 返回从高到低相关度的 URL 列表
- 图片加载失败时跳过或降权

## Checklist

- [x] C-001 `rank_product_images_by_relevance` 函数创建完成
- [x] C-002 使用 CLIP 模型计算相关性分数
- [x] C-003 返回排序后的 URL 列表（从高到低相关度）
- [x] C-004 异步函数（使用 `async`）
- [x] C-005 处理图片加载失败的情况

---

## 总结

| 任务 | 描述 | 依赖 |
|------|------|------|
| T-001 | 创建批量任务和预览项 Model | 无 |
| T-002 | 创建批量任务和预览项 Serializer | T-001 |
| T-003 | 实现批量任务 ViewSet (CTABulkFlowViewSet) | T-002 |
| T-004 | 实现预览项 ViewSet (CTAIFramePreviewViewSet) | T-002 |
| T-005 | 实现批量生成主任务 (bulk_generate_main_task) | T-001 |
| T-006 | 实现 URL 处理任务 (process_url_source_task) | T-005 |
| T-007 | 实现单条预览生成任务 (generate_single_preview_task) | T-006 |
| T-008 | 实现背景图生成子任务 (generate_background_image_task) | T-007 |
| T-009 | 实现 prefill 生成子任务 (generate_prefill_task) | T-007 |
| T-010 | 实现图片排序功能 (rank_product_images_by_relevance) | T-001 |

**并行度分析**：
- T-003 和 T-004 可以并行（都依赖 T-002）
- T-006 开始执行后，T-007、T-008、T-009 可以并行开发
- T-010 可以与 T-002 并行开发（都依赖 T-001）
