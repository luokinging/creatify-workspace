## Context

当前 CTA Batch Job 实现存在竞态条件问题。`create_cta_batch_job_task` 创建所有 CTAInfo 记录后立即启动每个 CTAInfo 的独立处理任务。当同一 URL 有多个变体时，多个 `process_cta_info_task` 并行运行，都尝试查找可复用的 product，由于没有一个任务完成保存 product，所有任务都看到"无可用 product"，于是都调用 `_scrape_product` 创建新的 product 记录。

此外，当前实现中每个变体使用相同的图片（`primary_image_url` 或第一张图片），没有利用产品的多张图片来生成多样化的 CTA。

## Goals / Non-Goals

### Goals

- 修复同一 URL 被多次分析导致的竞态条件
- 实现每个 URL 只被抓取一次，所有变体共享同一个 product
- 实现多图片按相关性排序
- 实现变体按轮询方式使用不同图片
- 在 Admin 中显示 background URLs
- 在前端 batch-preview 页面添加 cta_id URL 参数

### Non-Goals

- 修改 `scrape_product_from_url_util` 的核心抓取逻辑 — 仅使用现有功能，避免影响其他模块
- 修改 content filter 的 AI 调用接口 — 复用现有的 `aget_content_filter_result`
- 添加 CTA 编辑状态的持久化 — 仅添加 URL 参数，不实现状态恢复
- 大规模重构 CTA 生成流程 — 仅修复特定问题，保持现有架构

## Decisions

### 1. 两阶段流程架构

**决策**：采用 Phase 1（按 URL 抓取）+ Phase 2（处理 CTAInfo）的两阶段流程

**理由**：
- 清晰分离"抓取 product"和"生成 CTA"两个关注点
- Phase 1 按 URL 串行执行，避免竞态条件
- Phase 2 可以并行执行，提高吞吐量
- 利用 Celery 的任务链（chain/group）表达依赖关系

**考虑的替代方案**：
- 使用数据库锁：被拒绝，因为会增加复杂度和死锁风险
- 在 `_find_reusable_product` 中使用分布式锁：被拒绝，因为锁粒度难以控制，且不能解决"所有变体使用相同图片"的问题

### 2. 数据存储位置

**决策**：将 URL 到 product 的映射和排序后的图片列表存储在 `CTAGenerationJob.url_product_map` JSONField 中

**理由**：
- 不需要创建新的数据库表
- 数据生命周期与 Job 绑定，Job 删除时数据自动清理
- 便于调试和查看（Admin 可以直接查看 JSON）

**考虑的替代方案**：
- 使用单独的 key-value 表：被拒绝，因为增加复杂度，且需要额外清理逻辑
- 使用 Redis 缓存：被拒绝，因为数据需要持久化，且与 Job 生命周期绑定

### 3. variant_index 存储

**决策**：在 `CTAInfo` 模型中添加 `variant_index` IntegerField

**理由**：
- 明确标识每个 CTAInfo 在其 URL 下的序号
- 便于按轮询方式选择图片
- 默认值 0 保持向后兼容

**考虑的替代方案**：
- 动态计算 variant_index：被拒绝，因为需要查询同一 job+url 下的所有 CTAInfo，性能差且复杂

### 4. 图片排序实现

**决策**：创建 `get_product_images_sorted_by_relevance` 函数，复用 `select_primary_image` 的 content filter 逻辑

**理由**：
- 复用现有 AI 调用，不增加新的 API 依赖
- 批量处理图片，性能较好
- 返回排序后的完整列表，而不是只返回最佳图片

**考虑的替代方案**：
- 为每张图片单独调用 content filter：被拒绝，因为性能差，API 调用次数多

### 5. Admin 显示方式

**决策**：使用 Admin 的只读显示方法，从 `suggestion` JSONField 中读取数据

**理由**：
- 不需要数据库迁移
- 实现简单，不影响现有数据
- 使用 `format_html` 可以渲染可点击链接

**考虑的替代方案**：
- 添加新的模型字段：被拒绝，因为需要迁移，且数据已经在 suggestion 中

## Data Model

### Modified Model

**CTAInfo**:
```python
class CTAInfo(UUIDModelMixin, TimeStampModelMixin):
    # ... existing fields ...
    variant_index = models.IntegerField(default=0)  # NEW: per-URL variant index
    # ...
```

**CTAGenerationJob**:
```python
class CTAGenerationJob(UUIDModelMixin, TimeStampModelMixin, UserAndWorkspaceMixin):
    # ... existing fields ...
    url_product_map = models.JSONField(default=dict)  # NEW: {url: {product_id, sorted_image_urls}}
    # ...
```

**url_product_map 结构**:
```json
{
  "https://example.com/product1": {
    "product_id": "uuid-1",
    "sorted_image_urls": [
      "https://cdn.../image1.jpg",
      "https://cdn.../image2.jpg",
      "https://cdn.../image3.jpg"
    ]
  },
  "https://example.com/product2": {
    "product_id": "uuid-2",
    "sorted_image_urls": [...]
  }
}
```

### API Response Format

无需修改 API 响应格式，所有变更在内部实现。

## Component Structure

### Backend Module Structure

```
tools/llm_editor/
├── models.py              # Add variant_index to CTAInfo, url_product_map to CTAGenerationJob
├── admin.py               # Add background_url display methods
├── tasks/
│   └── v2.py
│       ├── create_cta_batch_job_task()      # Modified: use two-phase flow
│       ├── scrape_url_for_cta_batch_task()  # NEW: Phase 1 task
│       └── process_cta_info_task()          # Modified: skip scrape, use url_product_map
└── utils.py               # NEW: get_product_images_sorted_by_relevance()

products/tasks/
└── preprocessing.py       # Add get_product_images_sorted_by_relevance()
```

### Frontend Component Structure

```
.vite/routes/(desktop)/tool/cta-generator/
└── batch-preview.tsx      # Modified: add cta_id to validateSearch

feature/tool.cta-generator/page/
└── batch-preview.tsx      # Modified: update handleEditClick to set cta_id in URL
```

## Architecture Patterns

### 1. Two-Phase Processing Pattern

- **说明**：将"数据准备"和"数据处理"分离为两个阶段
- **应用**：Phase 1 准备 product 数据，Phase 2 处理每个 CTAInfo
- **好处**：避免竞态条件，提高代码清晰度

### 2. Task Chain Pattern

- **说明**：使用 Celery 的 chain/group 表达任务依赖
- **应用**：`chain(scrape_url_task.si(), group(process_cta_tasks))`
- **好处**：明确表达任务依赖，自动处理失败传播

### 3. JSONField for Flexible Data

- **说明**：使用 JSONField 存储结构灵活的数据
- **应用**：`url_product_map` 存储 URL 到 product 的映射
- **好处**：避免复杂的关系表，数据与 Job 生命周期绑定

### 4. Admin Display Methods

- **说明**：使用 Admin 的只读方法来显示计算或派生数据
- **应用**：从 `suggestion` JSONField 中读取并显示 background URLs
- **好处**：不需要数据库迁移，实现简单

## Risks / Trade-offs

### Risk: Phase 1 任务失败影响所有变体

**风险**：如果 Phase 1 任务失败，对应 URL 的所有 CTAInfo 都无法处理

**缓解措施**：
- Phase 1 任务有重试机制（Celery 的 retry）
- Phase 1 失败时，将对应 URL 的所有 CTAInfo 标记为失败，并记录错误信息
- 监控和告警，及时发现处理失败的 job

### Risk: url_product_map 数据过大

**风险**：如果 job 包含大量 URL，url_product_map 可能很大

**缓解措施**：
- 每个 URL 只存储 product_id 和 sorted_image_urls（图片 URL 列表）
- 假设平均 URL 长度 200 字符，product_id 36 字符，每张图片 URL 200 字符，平均 5 张图片
- 1000 个 URL 的 job：约 1.2MB 数据，在 JSONField 可接受范围内

### Trade-off: 图片排序增加 Phase 1 处理时间

**决策**：在 Phase 1 中执行图片排序

**影响**：
- Phase 1 处理时间增加（需要调用 content filter API）
- Phase 2 可以并行执行，整体吞吐量不受影响
- 如果产品图片很多（>20 张），API 调用次数增加

## Migration Plan

### Steps

1. **数据库迁移**：
   - 生成 migration 添加 `CTAInfo.variant_index` 字段
   - 生成 migration 添加 `CTAGenerationJob.url_product_map` 字段
   - 运行 migration

2. **代码部署**：
   - 部署新代码（包含两阶段流程、图片排序、Admin 显示、前端 URL 参数）
   - 新创建的 job 使用新流程
   - 正在处理的旧 job 不受影响（使用旧代码逻辑）

3. **验证**：
   - 创建测试 job，验证同一 URL 的多个变体共享同一个 product
   - 验证不同变体使用不同图片
   - 验证 Admin 显示 background URLs
   - 验证前端 URL 参数更新

### Rollback

- 代码回滚：部署旧版本代码
- 数据库回滚：不需要，新增的字段有默认值，不影响旧代码
- 数据修复：如果新流程产生问题，可以删除 job 重新创建

## References

- `webserver/backend/tools/llm_editor/tasks/v2.py` - 主要修改文件
- `webserver/backend/tools/llm_editor/models.py` - 模型修改
- `webserver/backend/tools/llm_editor/admin.py` - Admin 显示修改
- `webserver/backend/products/tasks/preprocessing.py` - 图片排序函数
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 前端修改
