# CTA Generator Batch Mode - Backend

## Overview

参考现有的单个 CTA Generator 实现新增批量生成模式。允许前端一次性提交多个产品 URL 和每个产品的 variant 数量，后端系统并行处理所有 CTA 的生成任务。

## Background

当前 CTA Generator 只支持单个产品的创意生成。批量模式需要后端支持：
- 一次性处理多个产品 URL（最多 5 个）
- 为每个产品指定 variant 数量（最多 10 个）
- 并行处理所有生成任务
- 提供统一的 API 接口供前端查询和管理

## Goals

### 数据模型

1. **创建 `CTAGenerationJob` 模型**
   - 表示一个批量生成任务
   - 包含 name（自动生成）、input（URL 和 variant 数量）
   - 关联 User 和 Workspace

2. **创建 `CTAInfo` 模型**
   - 表示单个 URL 对应的单个 variant 的生成任务
   - 通过外键关联到 CTAGenerationJob（级联删除）
   - 包含 url、product、suggestion、status 等字段

3. **计算属性**
   - Job 级别的统计：成功数量、失败数量、总数量、是否完成
   - 使用 QuerySet annotate 优化性能

### 批量生成流程

1. **任务创建**
   - 接收前端传入的 URL 列表和 variant 数量
   - 创建 CTAGenerationJob 和多个 CTAInfo
   - 为每个 CTAInfo 启动独立的 Celery 任务

2. **并行处理**
   - 每个 CTAInfo 使用独立的 Celery 任务
   - 支持状态跟踪：pending → analyzing → generating_image → generating_suggestion → done/failed
   - 支持失败重试（最多重试 1 次）

3. **状态更新**
   - 每个阶段更新 CTAInfo 的状态
   - 支持前端轮询查询最新状态

### API 接口

1. **批量任务管理**
   - `POST /api/cta-batch/jobs/` - 创建批量任务
   - `GET /api/cta-batch/jobs/` - 查询任务列表（分页）
   - `GET /api/cta-batch/jobs/{id}/` - 查询任务详情
   - `DELETE /api/cta-batch/jobs/{id}/` - 删除任务（级联删除 CTAInfo）

2. **CTAInfo 管理**
   - `GET /api/cta-batch/jobs/{id}/cta-infos/` - 查询任务的所有 CTAInfo
   - `GET /api/cta-batch/cta-infos/{id}/` - 查询单个 CTAInfo
   - `PUT /api/cta-batch/cta-infos/{id}/` - 更新 CTAInfo suggestion

## Non-Goals

以下内容不在本次变更范围内：

1. **不修改现有的单个 CTA Generator**
   - 保持现有的 `ProductCTAFlow` 模型不变
   - 保持现有的 `generate_creative_suggestions_v2_task` 不变
   - 批量模式是新增功能，完全独立

2. **不包含高级功能**
   - 不包含任务优先级调整
   - 不包含任务暂停/恢复功能
   - 不包含批量导出功能

3. **前端相关**
   - 前端页面、组件、路由等由前端团队负责
   - 后端只提供 API 接口

## Technical Approach

### 数据模型

```python
class CTAGenerationJob(UUIDModelMixin, TimeStampModelMixin, UserAndWorkspaceMixin):
    name = CharField(max_length=255)  # [Username]-CTA-[yyyy-mm-dd hh:ss]
    input = JSONField(default=list)  # [{url: str, variant: number}]

    @property
    def success_count(self):
        if hasattr(self, '_success_count'):
            return self._success_count
        return self.cta_info_set.filter(status='done').count()

    @property
    def failed_count(self):
        if hasattr(self, '_failed_count'):
            return self._failed_count
        return self.cta_info_set.filter(status='failed').count()

    @property
    def total_count(self):
        if hasattr(self, '_total_count'):
            return self._total_count
        return self.cta_info_set.count()

    @property
    def is_completed(self):
        return self.total_count > 0 and (self.success_count + self.failed_count) == self.total_count

class CTAInfo(UUIDModelMixin, TimeStampModelMixin):
    job = ForeignKey(CTAGenerationJob, on_delete=CASCADE, related_name='cta_info_set')
    url = URLField(max_length=2048)
    product = ForeignKey(ECommerceProduct, on_delete=SET_NULL, null=True)
    suggestion = JSONField(default=dict)
    status = CharField(max_length=30, choices=CTAInfoStatus.choices, default='pending')
    retry_count = IntegerField(default=0)
    error_message = TextField(null=True, blank=True)
```

### 并发处理

- 为每个 CTAInfo 创建独立的 Celery 任务
- 使用 `@app.task(bind=True, max_retries=1)` 实现自动重试
- 每个任务独立更新自己的状态

### 流程状态机

```
pending → analyzing → generating_image → generating_suggestion → done
                             ↓
                           failed
```

### 图片循环补足机制

当分析得到的图片数量少于 variant 数量时，从相关度高到低循环复用：

```python
images = product.images_sorted_by_relevance()
for i in range(variant_count):
    original_image = images[i % len(images)]
    cta_info.original_image = original_image
```

## Key Constraints

1. **数量限制**
   - 每个 Job 最多 5 个 URL
   - 每个 URL 最多 10 个 variant

2. **性能要求**
   - 使用 QuerySet `annotate()` 优化列表查询性能
   - 使用 `select_related` 和 `prefetch_related` 优化关联查询

3. **兼容性**
   - 不修改现有的单个 CTA Generator 代码
   - 复用现有的 Celery 任务逻辑（`generate_creative_suggestions_v2_task`）

## Success Criteria

1. API 可以成功创建批量生成任务
2. 所有 CTAInfo 能够并行处理，状态正确更新
3. 失败的任务能够自动重试 1 次
4. API 提供正确的数据格式供前端使用
5. 删除任务时级联删除关联的 CTAInfo

## Open Questions

无

## References

- 参考实现：`webserver/backend/tools/llm_editor/views.py::ProductCTAFlowViewSet`
- 参考任务：`webserver/backend/tools/llm_editor/tasks/v2.py::generate_creative_suggestions_v2_task`
- 参考模型：`webserver/backend/tools/llm_editor/models.py::ProductCTAFlow`
