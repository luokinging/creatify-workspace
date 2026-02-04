# Proposal: Fix CTA Batch Job Race Condition and Add Multi-Image Support

## 需求摘要

修复 CTA Batch Job 中同一 URL 被多次分析导致生成多个 product IDs 的竞态条件问题，并添加多图片排序和变体轮询功能，同时增强 Admin 显示和前端 URL 状态管理。

## 背景与动机

### 问题 1：同一 URL 被多次分析（不同 product IDs）

**症状**：在 batch-preview 时，一个产品（一个 URL）有多个预览；第一个成功，第 2/3 个显示 `No product images found for product <product-id-2>`，且**不同的 product IDs**。

**根本原因**：
- `create_cta_batch_job_task` 创建所有 CTAInfo 记录后，立即为每个 CTAInfo 启动 `process_cta_info_task`，没有"先分析 URL 再启动 CTAInfo"的保证
- 同一 URL 的多个任务并行运行，都调用 `_find_reusable_product`，由于竞态条件，都看到"无可用 product"，都调用 `_scrape_product`
- `scrape_product_from_url_util` 按 `(url, slug, workspace, brand, user)` 查找 product，多个任务同时运行时会创建多个 `ECommerceProduct`

### 问题 2：所有变体使用相同图片

**当前行为**：给定 URL 的每个 CTAInfo（每个变体）使用相同图片，`_get_product_image_url(product)` 返回 `primary_image_url` 或第一张图片。

**期望行为**：
- 获取所有产品图片并按与产品的相关性排序
- 对于 m 个变体和 n 个排序后的图片：变体索引 mi 应使用图片索引 `mi % n`（轮询）

### 问题 3：Admin 显示和前端 URL 状态

- Admin 需要显示 `product_background_url` 和 `generated_background_url`（存储在 CTAInfo.suggestion JSONField 中）
- 前端 batch-preview 页面需要在用户点击 Edit 时添加 `cta_id` 到 URL

## 目标与成功标准

1. **修复竞态条件**：每个 URL 只被分析一次，所有变体共享同一个 product 和 product id
2. **多图片支持**：实现图片按相关性排序，变体按轮询方式使用不同图片
3. **Admin 增强**：在 Admin 中显示 background URLs，无需数据库迁移
4. **前端 URL 状态**：点击 Edit 时更新 URL 添加 `cta_id` 参数

**成功标准**：
- 同一 URL 的多个变体不再出现 对应不同 product id的情况
- 同一 URL 的不同变体可以使用不同的产品图片
- Admin 中可以查看每个 CTAInfo 的 background URLs
- 前端 Edit 操作后 URL 包含 `cta_id` 参数

## 范围与边界

### In Scope（本次包含）

- 两阶段流程实现（Phase 1: URL 抓取，Phase 2: CTAInfo 处理）
- CTAInfo 模型添加 `variant_index` 字段
- 图片相关性排序功能
- Admin 显示 background URLs
- 前端 batch-preview 页面 URL 状态管理

### Out of Scope（本次不包含）

- 修改 `scrape_product_from_url_util` 的核心逻辑 — 仅使用现有功能
- 修改 content filter 的 AI 调用方式 — 复用现有 `select_primary_image` 逻辑
- 大规模重构 CTA 生成流程 — 仅修复特定问题

## 用户/系统场景

### 场景 1：Batch CTA 生成成功

- **谁**：使用 CTA Generator 批量生成功能的用户
- **何时/条件**：用户提交包含多个 URL 和变体数的 batch job
- **做什么**：系统按 URL 抓取产品，然后为每个变体生成 CTA
- **得到什么**：每个 URL 的所有变体成功生成，使用不同图片（如有多个）

### 场景 2：Admin 查看 CTA 详情

- **谁**：内部运营/开发人员
- **何时/条件**：需要调试或查看 CTA 生成结果
- **做什么**：在 Django Admin 中查看 CTAGenerationJob 和 CTAInfo
- **得到什么**：可以直接看到 product_background_url 和 generated_background_url 链接

### 场景 3：前端 Edit CTA

- **谁**：使用 batch-preview 页面的用户
- **何时/条件**：用户点击某个 CTA 的 Edit 按钮
- **做什么**：系统打开 Edit 对话框并更新 URL
- **得到什么**：URL 包含 `cta_id` 参数，可以分享或刷新后保持状态

## 约束与假设

### 约束

- 不能修改 `scrape_product_from_url_util` 的核心逻辑（避免影响其他功能）
- Admin 显示不能添加新的模型字段（避免数据库迁移）
- 需要保持向后兼容（现有 CTAInfo 记录没有 `variant_index`）

### 假设

- `select_primary_image` 使用的 `aget_content_filter_result` 可以为所有图片打分
- CTAGenerationJob 的 `input` JSONField 可以扩展存储 URL 到 product 的映射
- 前端路由使用 TanStack Router，支持 `validateSearch`

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| CTAGenerationJob | 批量 CTA 生成任务 | 包含多个 URL 和变体配置 |
| CTAInfo | 单个 CTA 生成信息 | 关联到 job 和 product |
| variant_index | 变体索引 | 同一 URL 下的变体序号（0, 1, 2...） |
| Phase 1 / Phase 2 | 两阶段流程 | Phase 1 抓取 URL，Phase 2 处理 CTAInfo |
| sorted_image_urls | 排序后的图片 URL 列表 | 按相关性从高到低排序 |

## 参考与链接

- Code Points 见 task.md
