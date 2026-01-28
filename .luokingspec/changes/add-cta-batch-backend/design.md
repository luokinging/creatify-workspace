## Context

### 当前系统状态

CTA Generator 工具当前仅支持 **Single Mode**：
- 使用 `ProductCTAFlow` 模型存储单条 CTA 分析结果
- 通过 `generate_creative_suggestions_v2` API 生成创意建议
- 通过 `image2image_task` 生成背景图
- 前端已使用 Mock 数据完成 Batch Mode 开发

### 为什么需要这个变更

1. **业务需求**：电商用户需要批量生成 CTA 广告，提高效率
2. **前端就绪**：前端 Batch Mode 已完成开发，等待后端支持
3. **现有能力不足**：Single Mode 无法满足批量场景需求

### 相关现有实现

- **ECommerceProduct**：存储产品信息（url, image_urls, ai_summary 等）
- **ProductCTAFlow**：单条 CTA 分析（product FK, status, analyzed_result JSON）
- **generate_creative_suggestions_v2_task**：生成创意建议（Gemini）
- **image2image_task**：图片生成（image2image 服务）

## Goals / Non-Goals

### Goals

1. 支持从多个 URL 批量生成 CTA 预览项
2. 提供批量任务管理能力（创建、查询、状态追踪）
3. 实现并行生成和智能排队机制
4. 提供预览项的查询和编辑能力

### Non-Goals

1. **前端实现**：前端已完成，本次不涉及
2. **prod.tsx 修改**：严格禁止修改线上版本
3. **数据库迁移脚本**：由 Django 自动生成
4. **深度性能优化**：基础实现，后续优化
5. **删除功能**：不支持删除批量任务

## Decisions

### 1. Model 设计

#### 1.1 CTABulkGenerateTask (m2)

**决策**：新增独立的批量任务模型，不复用 `ProductCTAFlow`

**理由**：
- `ProductCTAFlow` 是单条任务模型，字段不适用（没有 progress 概念）
- 批量任务需要额外的状态管理和进度追踪
- 职责分离更清晰

**考虑的替代方案**：
- 扩展 `ProductCTAFlow`：被拒绝，因为会导致模型职责混乱，单条和批量逻辑耦合

**字段设计**：
```python
class CTABulkGenerateTask(
    UUIDModelMixin,
    TimeStampModelMixin,
    UserAndWorkspaceMixin,
):
    name = models.CharField(max_length=255)  # 自动生成："Batch Task - Jan 28, 10:30 AM"
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('running', 'Running'),
            ('done', 'Done'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    error_message = models.TextField(blank=True, null=True)

    # 关系
    # → CTAIFramePreview (1:N, related_name='bulk_generate_task')
```

#### 1.2 CTAIFramePreview (m1)

**决策**：新增预览项模型，存储单条预览的所有数据

**理由**：
- 需要关联 product 和 bulk_task
- 需要存储 prefill JSON（iframe 所需数据）
- 需要独立的状态管理（queued/running/done/failed）

**考虑的替代方案**：
- 扩展 `ProductCTAFlow`：被拒绝，因为 status 含义不同（单条 vs 批量预览项）

**字段设计**：
```python
class CTAIFramePreview(
    UUIDModelMixin,
    TimeStampModelMixin,
):
    # 冗余存储，便于按 workspace 查询
    workspace = models.ForeignKey('accounts.Workspace', on_delete=models.CASCADE)

    # 关系
    bulk_generate_task = models.ForeignKey(
        'CTABulkGenerateTask',
        on_delete=models.CASCADE,
        related_name='iframe_previews'
    )
    product = models.ForeignKey(
        'products.ECommerceProduct',
        on_delete=models.CASCADE,
        related_name='cta_preview_items'
    )

    # 数据
    prefill = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('queued', 'Queued'),
            ('running', 'Running'),
            ('done', 'Done'),
            ('failed', 'Failed'),
        ],
        default='queued'
    )
    error_message = models.TextField(blank=True, null=True)
```

**关于 workspace 冗余的决策**：
- **决策**：在 m1 上冗余存储 workspace
- **理由**：主要查询场景是按 workspace 查询预览项，避免 join task 表
- **代价**：需要在创建/更新时保证与 task.workspace 一致

**关于 prefill 的决策**：
- **决策**：使用 JSONField 存储所有 iframe 所需数据
- **结构**：必须包含 `original_background_url` 和 `generated_background_url`
- **更新时机**：创建时写入 `{}`，任务完成后更新完整内容

### 2. API 设计

#### 2.1 ViewSet 结构

**决策**：使用两个独立的 ViewSet，不使用嵌套路由

**理由**：
- 职责分离清晰
- 符合 Django REST Framework 最佳实践
- 代码更易维护和扩展

**考虑的替代方案**：
- 使用嵌套路由（`/batch/{id}/items/`）：被拒绝，因为在 DRF 中需要自定义路由器

**路由设计**：
```
/api/llm-editor/cta/
├── /batch/                      # CTABulkFlowViewSet
│   ├── POST   /                 # 创建批量任务
│   ├── GET    /                 # 获取批量任务列表（CursorPagination）
│   └── GET    /{id}/            # 获取批量任务详情
│
└── /previews/                   # CTAIFramePreviewViewSet
    ├── GET    /                 # 获取预览项列表（支持过滤）
    ├── GET    /{id}/            # 获取单个预览项详情
    └── PATCH  /{id}/            # 更新预览项的 prefill
```

#### 2.2 分页策略

**决策**：所有列表接口统一使用 CursorPagination

**理由**：
- 用户体验好（支持无限滚动）
- 性能好（避免 offset 查询）
- 与现有系统一致（参考 `StandardCursorPagination`）

**请求参数**：仅 `page_size`（可选，默认 20，最大 100）

#### 2.3 更新预览项的路径

**决策**：使用 `PATCH /api/llm-editor/cta/previews/{item_id}/`

**理由**：
- item_id 是 UUID，全局唯一
- 前端体验更好（无需额外传递 bulk_task_id）
- 权限验证不变（通过 get_queryset 按 workspace 过滤）

**考虑的替代方案**：
- 使用层级路径 `/batch/{id}/items/{item_id}/`：被拒绝，虽然更 RESTful，但不够简洁

### 3. 内部流程设计

#### 3.1 任务链结构

**决策**：使用 Celery 的 `group` + `chord` 模式实现并行+汇总

**理由**：
- `group`：并行执行多个任务
- `chord`：所有任务完成后执行回调（更新 m2 状态）
- Celery 内置支持，成熟可靠

**任务结构**：
```
bulk_generate_main_task (主任务)
├── 遍历 sources，对每个 URL:
│   └── process_url_source_task (并行)
│       ├── 爬取/复用 ECommerceProduct
│       ├── 获取图片并排序
│       └── 创建 batch_size 个 CTAIFramePreview
│
└── 所有 m1 创建完成后:
    └── generate_single_preview_task (并行，Rate Limit 控制)
        ├── generate_background_image_task (并行子任务)
        └── generate_prefill_task (并行子任务)
```

#### 3.2 并发控制

**决策**：使用方案 B（Rate Limit + queued 状态）

**理由**：
- **简单够用**：只需增加一个状态值
- **用户体验好**：可以区分"等待中"和"执行中"
- **无需额外依赖**：不需要 Redis 信号量
- **Celery 自动排队**：任务不会丢失

**考虑的替代方案**：
- 方案 A（仅 Rate Limit）：被拒绝，状态不透明
- 方案 C（全局信号量）：被拒绝，稍复杂但不必要

**配置**：
```python
@app2.task(bind=True, rate_limit='20/m')
def generate_single_preview_task(...):
    # 任务真正开始执行时更新状态
    preview.status = 'running'
    preview.save(update_fields=['status'])
```

**状态流转**：
```
创建 → queued → running → done/failed
       ↑         ↑
       └─────────┴─ Rate Limit 等待在这里
```

#### 3.3 图片排序与 batch_size 补足

**决策**：
1. 使用 CLIP 模型对图片进行相关度排序（扩展 `select_primary_image`）
2. batch_size 不足时，循环取图（从高到低相关度重复）

**理由**：
- CLIP 模型已在系统中使用（`select_primary_image`）
- 循环取图简单有效，保证每个预览项都有源图

**实现示例**：
```python
sorted_images = rank_product_images_by_relevance(product, image_urls)
batch_size = 5

# 循环补足
selected_images = []
for i in range(batch_size):
    selected_images.append(sorted_images[i % len(sorted_images)])
```

#### 3.4 错误处理策略

**决策**：单个 URL/m1 失败不影响其他任务

**具体策略**：
- 单个 URL 爬取失败：记录失败，继续处理其他 URL
- 单条 m1 生成失败：status=failed，记录 error_message，不影响其他 m1
- 所有 URL/m1 失败：m2 status=failed
- 部分成功：m2 status=done，通过 progress 显示详情

### 4. progress 计算

**决策**：progress 在查询时实时计算，不存储到数据库

**理由**：
- 批量任务数量不会太多（一次最多 5 URL × 10 batch_size = 50 条）
- 避免数据冗余和一致性问题
- 查询性能足够好（使用 aggregate）

**实现**：
```python
class CTABulkGenerateTaskSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    def get_progress(self, obj):
        return obj.iframe_previews.aggregate(
            total=Count('id'),
            queued=Count('id', filter=Q(status='queued')),
            running=Count('id', filter=Q(status='running')),
            done=Count('id', filter=Q(status='done')),
            failed=Count('id', filter=Q(status='failed')),
        )
```

### 5. prefill JSON 结构

**决策**：使用 Pydantic model 定义结构，便于前后端对齐

**结构定义**：
```python
class BatchPreviewPrefill(BaseModel):
    # 背景
    original_background_url: str
    generated_background_url: str
    background_prompt: str

    # 文案与颜色
    headline: str
    headline_color: str
    subtitle: str
    subtitle_color: str
    cta_button_text: str
    cta_button_color: str
    cta_text_color: str
    cta_button_link: str

    # 转化组件
    social_proof: Optional[V2ConversionWidget]
    discount_badge: Optional[V2ConversionWidget]
    special_offer_timer: Optional[V2ConversionWidget]
    top_banner: Optional[V2ConversionWidget]

    # 视觉风格
    visual_vibe: str

    # 品牌
    logo_url: Optional[str]
```

## Data Model

### Existing Model (No Changes Required)

#### ECommerceProduct
```python
# webserver/backend/products/models/product.py
class ECommerceProduct(
    UUIDModelMixin,
    TimeStampModelMixin,
    UserAndWorkspaceMixin,
    BrandMixin,
):
    slug = models.CharField(max_length=255)
    url = models.CharField(max_length=3000, null=True, blank=True)
    title = models.CharField(max_length=1000, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    image_urls = models.JSONField(blank=True, null=True)
    # ... 其他字段
```

### New/Modified Model

#### CTABulkGenerateTask (m2)
```python
# webserver/backend/tools/llm_editor/models.py
class CTABulkGenerateTask(
    UUIDModelMixin,
    TimeStampModelMixin,
    UserAndWorkspaceMixin,
):
    """批量生成任务模型"""

    name = models.CharField(
        max_length=255,
        help_text="自动生成的任务名称，格式：Batch Task - Jan 28, 10:30 AM"
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('running', 'Running'),
            ('done', 'Done'),
            ('failed', 'Failed'),
        ],
        default='pending'
    )
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "CTA Bulk Generate Task"
        verbose_name_plural = "CTA Bulk Generate Tasks"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.status})"
```

#### CTAIFramePreview (m1)
```python
# webserver/backend/tools/llm_editor/models.py
class CTAIFramePreview(
    UUIDModelMixin,
    TimeStampModelMixin,
):
    """CTA iframe 预览项模型"""

    # 冗余存储 workspace，便于按 workspace 查询
    workspace = models.ForeignKey(
        'accounts.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
        help_text="所属 workspace（与 bulk_generate_task.workspace 一致）"
    )

    # 关系
    bulk_generate_task = models.ForeignKey(
        'CTABulkGenerateTask',
        on_delete=models.CASCADE,
        related_name='iframe_previews',
        help_text="所属批量任务"
    )
    product = models.ForeignKey(
        'products.ECommerceProduct',
        on_delete=models.CASCADE,
        related_name='cta_preview_items',
        help_text="关联产品"
    )

    # 数据
    prefill = models.JSONField(
        default=dict,
        blank=True,
        help_text="iframe 预填充数据，包含背景图、文案、颜色等"
    )
    status = models.CharField(
        max_length=20,
        choices=[
            ('queued', 'Queued'),
            ('running', 'Running'),
            ('done', 'Done'),
            ('failed', 'Failed'),
        ],
        default='queued',
        help_text="预览项状态"
    )
    error_message = models.TextField(
        blank=True,
        null=True,
        help_text="失败原因"
    )

    class Meta:
        verbose_name = "CTA iframe Preview"
        verbose_name_plural = "CTA iframe Previews"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['workspace', '-created_at']),
            models.Index(fields=['bulk_generate_task', 'status']),
            models.Index(fields=['product', 'status']),
        ]

    def __str__(self):
        return f"Preview {self.id} - {self.get_status_display()}"
```

### API Response Format

#### 创建批量任务
```
POST /api/llm-editor/cta/batch/

Request:
{
  "sources": [
    {"url": "https://example.com/product1", "batch_size": 5},
    {"url": "https://example.com/product2", "batch_size": 3}
  ]
}

Response (201):
{
  "bulk_generate_task_id": "uuid-xxx",
  "task_id": "celery-task-id",
  "status": "pending"
}
```

#### 获取批量任务详情
```
GET /api/llm-editor/cta/batch/{id}/

Response (200):
{
  "id": "uuid-xxx",
  "name": "Batch Task - Jan 28, 10:30 AM",
  "status": "running",
  "created_at": "2025-01-28T10:00:00Z",
  "updated_at": "2025-01-28T10:05:00Z",
  "error_message": null,
  "progress": {
    "total": 8,
    "queued": 2,
    "running": 3,
    "done": 2,
    "failed": 1
  },
  "sources": [
    {
      "url": "https://example.com/product1",
      "product_id": "product-uuid-1",
      "batch_size": 5,
      "items_summary": {
        "total": 5,
        "queued": 1,
        "running": 2,
        "done": 2,
        "failed": 0
      }
    }
  ]
}
```

#### 获取预览项列表
```
GET /api/llm-editor/cta/previews/?bulk_task_id=xxx&page_size=20

Response (200):
{
  "next": "https://.../previews/?page_size=20&cursor=xxx",
  "previous": null,
  "results": [
    {
      "id": "item-uuid-1",
      "product_id": "product-uuid-1",
      "status": "done",
      "prefill": {
        "original_background_url": "https://...",
        "generated_background_url": "https://...",
        "headline": "Amazing Product",
        ...
      },
      "error_message": null
    }
  ]
}
```

## Component Structure

### 后端模块结构
```
webserver/backend/tools/llm_editor/
├── models.py                          # 新增：CTABulkGenerateTask, CTAIFramePreview
├── serializers.py                     # 新增：批量任务的 Serializer
├── views.py                           # 新增：CTABulkFlowViewSet, CTAIFramePreviewViewSet
├── tasks/
│   ├── v2.py                          # 现有：单条 CTA 任务
│   └── batch_tasks.py                 # 新增：批量任务相关
│       ├── bulk_generate_main_task
│       ├── process_url_source_task
│       ├── generate_single_preview_task
│       ├── generate_background_image_task
│       └── generate_prefill_task
├── urls.py                            # 修改：添加批量相关路由
└── admin.py                           # 新增：批量任务的 Admin 配置
```

## Architecture Patterns

### Celery Canvas 模式

- **group**: 并行执行多个任务
- **chord**: 所有任务完成后执行回调

```python
from celery import chord, group

# 示例：并行生成多个预览项
preview_tasks = [
    generate_single_preview_task.s(preview_id, source_image_url)
    for preview_id, source_image_url in preview_list
]

# 使用 chord 实现并行+汇总
workflow = chord(
    group(preview_tasks),
    update_bulk_task_status.s(bulk_task_id)
)

workflow.delay()
```

### Manager-ViewController 模式

虽然本次是后端任务，但仍遵循职责分离原则：
- **ViewSet**: 处理 HTTP 请求/响应，权限过滤
- **Serializer**: 处理数据序列化/验证
- **Task**: 处理异步业务逻辑

### Repository 模式

在 Task 中使用 Django ORM 进行数据访问：
- 使用 `select_related` 优化查询
- 使用 `aggregate` 计算统计数据
- 使用 `bulk_create` 批量创建记录

## Risks / Trade-offs

### Risk: Celery 并发控制可能不够精确

**风险**：Rate Limit = 20/m 是任务类型级别的限制，不是全局精确控制

**缓解措施**：
- 如果有多个 worker，每个 worker 都有自己的限制
- 可以通过监控 queued 任务数量来评估系统负载
- 后续可以升级到全局信号量（方案 C）进行精确控制

### Risk: 大任务可能导致 Celery 队列积压

**风险**：用户创建大任务（100 条），可能导致其他任务等待时间过长

**缓解措施**：
- 限制 URL 数量（最多 5 个）
- 限制 batch_size（最多 10）
- 使用 Rate Limit 控制并发
- 前端可以通过 progress 显示等待情况

### Trade-off: workspace 冗余 vs 数据一致性

**决策**：在 m1 上冗余存储 workspace

**影响**：
- 需要在创建/更新时保证与 task.workspace 一致
- 如果数据不一致，可能导致权限问题

**缓解措施**：
- 在创建 m1 时从 task 带入 workspace
- 不提供直接修改 m1.workspace 的接口
- 定期检查数据一致性（可选）

### Trade-off: progress 实时计算 vs 性能

**决策**：progress 在查询时实时计算

**影响**：
- 每次查询都需要执行 aggregate 查询
- 如果批量任务数量很大，可能影响性能

**评估**：
- 批量任务数量不会太多（预期每天 < 1000 个）
- aggregate 查询性能足够好（使用数据库索引）
- 如果后续性能有问题，可以考虑缓存

## Open Questions

无（所有关键问题已在讨论中确认）

## Migration Plan

### Steps

1. 创建新的 Model（CTABulkGenerateTask, CTAIFramePreview）
2. 生成并运行数据库迁移（`python manage.py makemigrations`, `python manage.py migrate`）
3. 创建 ViewSet 和 Serializer
4. 实现 Celery 任务
5. 配置 URL 路由
6. 测试完整流程

### Rollback

- 删除新增的 Model（通过 migration 回滚）
- 删除新增的 ViewSet 和 Serializer
- 删除新增的 Celery 任务
- 移除 URL 路由配置
- 回滚数据库迁移

## References

### 现有代码参考
- `webserver/backend/products/models/product.py` - ECommerceProduct 模型
- `webserver/backend/tools/llm_editor/models.py` - ProductCTAFlow 模型
- `webserver/backend/tools/llm_editor/views.py` - ProductCTAFlowViewSet
- `webserver/backend/tools/llm_editor/tasks/v2.py` - generate_creative_suggestions_v2_task

### 前端参考
- `.luokingspec/archive/cta-generator-batch-mode/` - 前端 Batch Mode 设计文档
- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` - 入口代码点

### 相关文档
- `.luokingspec/changes/add-cta-batch-backend/proposal.md` - 需求提案
- `.luokingspec/changes/add-cta-batch-backend/tasks.md` - 任务拆解
