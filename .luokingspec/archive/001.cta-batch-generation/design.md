## Context

当前 CTA Generator 只支持单个产品的创意生成。用户需要为每个产品单独创建任务，这在处理多个产品时效率较低。我们需要新增批量生成模式，允许前端一次性提交多个产品 URL，后端系统并行处理所有生成任务。

现有的单个 CTA Generator 实现：
- 后端：`ProductCTAFlowViewSet` + `generate_creative_suggestions_v2_task`

批量模式需要：
1. 新的 Model 来管理批量任务
2. 并行处理多个 CTAInfo 的机制
3. 新的 API 接口供前端调用

## Goals / Non-Goals

### Goals

- 创建 CTAGenerationJob 和 CTAInfo 模型，支持批量任务管理
- 实现并行处理多个 CTAInfo 的 Celery 任务流程
- 创建批量任务的 API 接口（创建、查询、更新、删除）
- 支持实时状态跟踪，供前端轮询查询

### Non-Goals

- 不修改现有的单个 CTA Generator 代码
- 不包含批量下载、批量编辑等高级功能
- 不包含任务暂停/恢复功能
- 前端页面、组件、路由等由前端团队负责

## Decisions

### 1. 模型关联设计

**决策**：CTAInfo 通过外键关联到 CTAGenerationJob，使用级联删除

**理由**：
- 数据关系清晰：一个 Job 包含多个 CTAInfo
- 查询效率高：通过 `job.cta_info_set.all()` 快速获取所有关联数据
- 数据一致性好：级联删除避免孤儿数据

**数据结构**：
```python
class CTAGenerationJob(TimeStampModelMixin, UserAndWorkspaceMixin):
    name = CharField(max_length=255)
    input = JSONField()  # [{url: str, variant: number}]

class CTAInfo(TimeStampModelMixin):
    job = ForeignKey(CTAGenerationJob, on_delete=CASCADE, related_name='cta_info_set')
    url = URLField(max_length=2048)
    product = ForeignKey(ECommerceProduct, null=True, on_delete=SET_NULL)
    suggestion = JSONField(default=dict)
    status = CharField(max_length=20, choices=CTAInfoStatus.choices)
```

### 2. 并发处理策略

**决策**：为每个 CTAInfo 创建独立的 Celery 任务

**理由**：
- 实现简单：不需要复杂的 group/chord 管理
- 独立性强：每个任务可以独立重试和更新状态
- 容错性好：单个任务失败不影响其他任务

**任务流程**：
```python
# 主任务：创建 Job 和 CTAInfo
@celery_app.task
def create_cta_batch_job(job_id: str):
    job = CTAGenerationJob.objects.get(id=job_id)
    for url, variant in job.input:
        for i in range(variant):
            cta_info = CTAInfo.objects.create(job=job, url=url)
            process_cta_info_task.delay(cta_info.id)

# 子任务：处理单个 CTAInfo
@celery_app.task(bind=True, max_retries=1)
def process_cta_info_task(self, cta_info_id: str):
    # 1. 分析 URL 获取 Product
    # 2. 设置 original image（循环复用）
    # 3. 生成 AI 背景图
    # 4. 生成 suggestion
    # 5. 更新状态为 done
```

### 3. 图片循环补足机制

**决策**：当分析得到的图片数量少于 variant 数量时，从相关度高到低循环复用

**理由**：
- 确保每个 variant 都有对应的 original image
- 保持图片质量优先级（高相关度图片优先使用）
- 实现简单，不需要额外的图片生成

**实现逻辑**：
```python
images = product.images_sorted_by_relevance()
for i in range(variant_count):
    original_image = images[i % len(images)]
    cta_info.original_image = original_image
```

### 4. 计算属性优化

**决策**：使用 Model 属性 + QuerySet 注解的组合方式

**理由**：
- 列表查询时性能最优（避免 N+1 问题）
- 单对象访问时也能正常工作
- 代码复用性好

**实现方式**：
```python
class CTAGenerationJob(models.Model):
    # ...

    @property
    def success_count(self):
        if hasattr(self, '_success_count'):
            return self._success_count
        return self.cta_info_set.filter(status='done').count()

# ViewSet 中
def get_queryset(self):
    return CTAGenerationJob.objects.annotate(
        _success_count=Count('cta_info_set', filter=Q(cta_info_set__status='done')),
        _failed_count=Count('cta_info_set', filter=Q(cta_info_set__status='failed')),
        _total_count=Count('cta_info_set')
    )
```

### 5. API 设计

**决策**：创建独立的 ViewSet（CTAGenerationJobViewSet 和 CTAInfoViewSet）

**理由**：
- 批量功能与单个功能是独立的概念
- API 结构清晰，便于维护
- 不影响现有的 ProductCTAFlowViewSet

**API 端点**：
```
POST   /api/cta-batch/jobs/              # 创建批量任务
GET    /api/cta-batch/jobs/              # 查询任务列表（分页）
GET    /api/cta-batch/jobs/{id}/         # 查询任务详情
DELETE /api/cta-batch/jobs/{id}/         # 删除任务
GET    /api/cta-batch/jobs/{id}/cta-infos/  # 查询任务的所有 CTAInfo
GET    /api/cta-batch/cta-infos/{id}/    # 查询单个 CTAInfo
PUT    /api/cta-batch/cta-infos/{id}/    # 更新 CTAInfo suggestion
```

## Data Model

### New/Modified Model

#### CTAGenerationJob

```python
class CTAGenerationJob(UUIDModelMixin, TimeStampModelMixin, UserAndWorkspaceMixin):
    """
    批量 CTA 生成任务

    Attributes:
        name: 任务名称，格式为 [Username]-CTA-[yyyy-mm-dd hh:ss]
        input: 输入参数，格式为 [{url: str, variant: number}]
        user: 创建用户
        workspace: 所属工作空间
    """
    name = models.CharField(max_length=255)
    input = models.JSONField(default=list)

    class Meta:
        db_table = 'cta_generation_job'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.id})"

    @property
    def success_count(self):
        """成功生成的 CTA 数量"""
        if hasattr(self, '_success_count'):
            return self._success_count
        return self.cta_info_set.filter(status='done').count()

    @property
    def failed_count(self):
        """失败的 CTA 数量"""
        if hasattr(self, '_failed_count'):
            return self._failed_count
        return self.cta_info_set.filter(status='failed').count()

    @property
    def total_count(self):
        """总 CTA 数量"""
        if hasattr(self, '_total_count'):
            return self._total_count
        return self.cta_info_set.count()

    @property
    def is_completed(self):
        """是否全部完成"""
        return self.total_count > 0 and (self.success_count + self.failed_count) == self.total_count
```

#### CTAInfo

```python
class CTAInfoStatus(models.TextChoices):
    PENDING = ('pending', 'Pending')
    ANALYZING = ('analyzing', 'Analyzing')
    GENERATING_IMAGE = ('generating_image', 'Generating Image')
    GENERATING_SUGGESTION = ('generating_suggestion', 'Generating Suggestion')
    DONE = ('done', 'Done')
    FAILED = ('failed', 'Failed')


class CTAInfo(UUIDModelMixin, TimeStampModelMixin):
    """
    单个 CTA 生成信息

    Attributes:
        job: 所属的批量任务
        url: 产品 URL
        product: 关联的产品（分析后设置）
        suggestion: 生成的创意建议（JSON 格式）
        status: 当前状态
        retry_count: 重试次数
        error_message: 错误信息（失败时）
    """
    job = models.ForeignKey(
        CTAGenerationJob,
        on_delete=models.CASCADE,
        related_name='cta_info_set'
    )
    url = models.URLField(max_length=2048)
    product = models.ForeignKey(
        'products.ECommerceProduct',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cta_infos'
    )
    suggestion = models.JSONField(default=dict)
    status = models.CharField(
        max_length=30,
        choices=CTAInfoStatus.choices,
        default=CTAInfoStatus.PENDING
    )
    retry_count = models.IntegerField(default=0)
    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'cta_info'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['job']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"CTAInfo {self.id} - {self.status}"
```

### API Response Format

#### 创建批量任务

**Request:**
```json
POST /api/cta-batch/jobs/
{
  "input": [
    {"url": "https://example.com/product1", "variant": 3},
    {"url": "https://example.com/product2", "variant": 2}
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "user-CTA-2025-01-29 10:30",
  "input": [...],
  "success_count": 0,
  "failed_count": 0,
  "total_count": 5,
  "is_completed": false,
  "created_at": "2025-01-29T10:30:00Z"
}
```

#### 查询任务列表（分页）

**Request:**
```
GET /api/cta-batch/jobs/?page=1&page_size=10
```

**Response:**
```json
{
  "count": 25,
  "next": "/api/cta-batch/jobs/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "name": "...",
      "success_count": 3,
      "failed_count": 0,
      "total_count": 5,
      "is_completed": true,
      "created_at": "..."
    }
  ]
}
```

#### 查询任务详情（包含 CTAInfo）

**Request:**
```
GET /api/cta-batch/jobs/{id}/
```

**Response:**
```json
{
  "id": "uuid",
  "name": "...",
  "input": [...],
  "success_count": 3,
  "failed_count": 0,
  "total_count": 5,
  "is_completed": true,
  "created_at": "...",
  "cta_infos": [
    {
      "id": "uuid",
      "url": "https://example.com/product1",
      "status": "done",
      "suggestion": {...},
      "created_at": "..."
    }
  ]
}
```

## Component Structure

### 后端模块结构

```
webserver/backend/tools/llm_editor/
├── models.py                    # 添加 CTAGenerationJob, CTAInfo
├── serializers.py               # 添加 CTAGenerationJobSerializer, CTAInfoSerializer
├── views.py                     # 添加 CTAGenerationJobViewSet, CTAInfoViewSet
├── urls.py                      # 添加路由
├── tasks/
│   ├── __init__.py
│   ├── v2.py                    # 添加批量处理任务
│   └── cta_batch.py             # 新增：批量任务专用模块（可选）
└── migrations/                  # 数据库迁移文件
```

## Architecture Patterns

### 后端架构模式

- **Repository Pattern**: ViewSet 不直接操作 Model，通过 Serializer 进行数据转换
- **Task Queue Pattern**: 使用 Celery 实现异步任务处理
- **State Machine Pattern**: CTAInfo 的状态转换遵循状态机模式
- **Retry Pattern**: 使用 Celery 的 `max_retries` 和 `retry()` 实现自动重试

## Risks / Trade-offs

### Risk: 并发任务数量过大

**风险**：当用户创建 5 个 URL 每个 10 个 variant 时，会同时启动 50 个 Celery 任务，可能造成资源压力。

**缓解措施**：
1. API 验证限制输入数量（URL 最多 5 个，variant 最多 10 个）
2. 使用 Celery 的 rate_limit 限制任务执行速率
3. 监控 Celery 队列长度，必要时增加 worker 数量

### Risk: 图片循环复用的质量

**风险**：当图片数量较少时，循环复用可能导致多个 variant 使用相同的 original image。

**缓解措施**：
1. 在分析阶段尽量获取更多图片
2. 允许前端在生成后手动编辑

## Migration Plan

### Steps

1. **数据库迁移**
   - 创建 `CTAGenerationJob` 表
   - 创建 `CTAInfo` 表
   - 添加外键约束和索引

2. **后端代码部署**
   - 部署新的 Model 和 Serializer
   - 部署新的 ViewSet 和 URL 配置
   - 部署 Celery 任务

### Rollback

- **数据库**：使用 Django migration 的回滚功能
- **后端代码**：通过代码回滚恢复

## References

- 参考 Model: `webserver/backend/tools/llm_editor/models.py::ProductCTAFlow`
- 参考 ViewSet: `webserver/backend/tools/llm_editor/views.py::ProductCTAFlowViewSet`
- 参考 Task: `webserver/backend/tools/llm_editor/tasks/v2.py::generate_creative_suggestions_v2_task`
