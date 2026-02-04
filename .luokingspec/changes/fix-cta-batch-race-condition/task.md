# T-001 实现两阶段流程修复竞态条件

## 需求描述

实现两阶段流程来解决同一 URL 被多次分析导致的竞态条件问题。

**Phase 1 - Scrape by URL**: 为每个唯一 URL 运行单个任务，抓取 URL，获取/创建 `ECommerceProduct`，存储 "job + URL → product" 映射到 CTAGenerationJob 的 JSONField 中。

**Phase 2 - Process CTAInfo**: 创建 CTAInfo 记录（添加 `variant_index`），仅在对应 URL 的 Phase 1 完成后启动 `process_cta_info_task`，从存储的映射中解析 product。

**需求类型**：Bugfix / Enhancement

**涉及领域**：后端

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 Django 后端开发规范
- `webserver/CLAUDE.md` - 了解项目结构、Celery 模式、测试要求

**后端Code Point:**
- `webserver/backend/tools/llm_editor/views.py:803-825` - POST create job → `create_cta_batch_job_task.delay`
- `webserver/backend/tools/llm_editor/tasks/v2.py:1068-1122` - `create_cta_batch_job_task`: bulk create CTAInfo → `process_cta_info_task.delay`
- `webserver/backend/tools/llm_editor/tasks/v2.py:1171-1274` - `process_cta_info_task`: `_find_reusable_product` → `_scrape_product` → `_get_product_image_url`
- `webserver/backend/tools/common/product_scraper_mixin.py:15,52-59,81-82` - `scrape_product_from_url_util`
- `webserver/backend/tools/llm_editor/models.py:25-89,92-137` - `CTAGenerationJob`, `CTAInfo`

**其他:**
- Celery 任务链文档 - 使用 `chain` 或 `group` 组织任务依赖

## 注意点

- **竞态条件**: 必须确保 Phase 1 完成并保存 product 映射后，才启动对应 URL 的 Phase 2 任务
- **任务链**: 使用 Celery 的 `chain` 或 `group` 来组织任务依赖关系
- **错误处理**: Phase 1 失败时，对应 URL 的所有 CTAInfo 应该标记为失败
- **向后兼容**: 现有 CTAInfo 记录没有 `variant_index`，需要设置默认值 0
- **数据库迁移**: 添加 `variant_index` 字段需要生成 migration

## Scenario

### Scenario 1: 两阶段流程正常执行

**场景描述：**
用户提交 batch job，包含 2 个 URL，每个 URL 有 3 个变体。

**前置条件：**
- CTAGenerationJob 已创建
- input 格式: `[{"url": "url1", "variant": 3}, {"url": "url2", "variant": 3}]`

**操作步骤：**
1. `create_cta_batch_job_task` 创建 6 个 CTAInfo 记录（每个 URL 3 个，variant_index 分别为 0, 1, 2）
2. 为每个唯一 URL 启动 Phase 1 任务 `scrape_url_for_cta_batch_task`
3. Phase 1 任务抓取 URL，获取/创建 product，保存映射到 job.url_product_map
4. Phase 1 完成后，启动该 URL 对应的所有 CTAInfo 的 Phase 2 任务 `process_cta_info_task`
5. Phase 2 任务从 job.url_product_map 获取 product_id，不再调用 `_scrape_product`

**预期结果：**
- 每个 URL 只被抓取一次
- 同一 URL 的所有变体共享同一个 product_id
- 不会出现 "No product images found for product <id>" 错误

## Checklist

- [x] C-001 修改 `CTAInfo` 模型，添加 `variant_index` IntegerField（默认 0）
- [x] C-002 修改 `CTAGenerationJob` 模型，添加 `url_product_map` JSONField（默认 {}）
- [x] C-003 创建 `scrape_url_for_cta_batch_task` 任务（Phase 1）
- [x] C-004 修改 `create_cta_batch_job_task` 创建 CTAInfo 时设置 `variant_index`
- [x] C-005 修改 `create_cta_batch_job_task` 使用任务链组织 Phase 1 和 Phase 2
- [x] C-006 修改 `process_cta_info_task` 从 `url_product_map` 获取 product，跳过 `_scrape_product`
- [x] C-007 生成数据库 migration 文件
- [ ] C-008 编写单元测试验证两阶段流程

---

# T-002 实现多图片排序和变体轮询 (deps: T-001)

## 需求描述

实现多图片按相关性排序和变体轮询功能。

**图片排序**: 添加函数 `get_product_images_sorted_by_relevance(product_name, product_description, image_urls)`，复用 `select_primary_image` 使用的 `aget_content_filter_result` 逻辑，为所有图片打分并排序。

**变体轮询**: 在 Phase 1 中计算 `sorted_image_urls` 并存储在 job 级别。在 Phase 2 中，CTAInfo 根据 `variant_index % len(sorted_image_urls)` 选择图片。

**需求类型**：Enhancement

**涉及领域**：后端

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 Django 后端开发规范
- `webserver/CLAUDE.md` - 了解异步操作模式

**后端Code Point:**
- `webserver/backend/products/tasks/preprocessing.py:772-876` - `select_primary_image`: `aget_content_filter_result` 打 match_score，只返回一张最佳
- `webserver/backend/tools/llm_editor/tasks/v2.py:1263-1274` - `_get_product_image_url`: 当前返回 `primary_image_url` 或第一张图片

**其他:**
- Content Filter API 文档

## 注意点

- **复用现有逻辑**: 不要重新实现 content filter 调用，复用 `select_primary_image` 的逻辑
- **性能考虑**: 图片排序在 Phase 1 执行一次，不要在每个 CTAInfo 处理时重复计算
- **向后兼容**: 如果 `sorted_image_urls` 不存在或为空，回退到当前行为（使用 `primary_image_url` 或第一张图片）
- **图片过滤**: 只考虑 `.jpg`, `.jpeg`, `.png`, `.webp` 格式的图片

## Scenario

### Scenario 1: 多图片排序和轮询

**场景描述：**
一个产品有 5 张图片，URL 配置了 3 个变体。

**前置条件：**
- Phase 1 已完成，product 已保存
- product 有 5 张图片
- 该 URL 有 3 个 CTAInfo，variant_index 分别为 0, 1, 2

**操作步骤：**
1. Phase 1 任务调用 `get_product_images_sorted_by_relevance` 为 5 张图片打分
2. 按 match_score 降序排序，得到 `sorted_image_urls`（长度 5）
3. 将 `sorted_image_urls` 保存到 job.url_product_map[url].sorted_image_urls
4. Phase 2 任务处理每个 CTAInfo：
   - variant_index=0: 使用 sorted_image_urls[0 % 5] = sorted_image_urls[0]
   - variant_index=1: 使用 sorted_image_urls[1 % 5] = sorted_image_urls[1]
   - variant_index=2: 使用 sorted_image_urls[2 % 5] = sorted_image_urls[2]

**预期结果：**
- 3 个变体使用 3 张不同的图片（相关性最高的前 3 张）
- 如果变体数 > 图片数，图片按轮询方式重用

## Checklist

- [x] C-001 创建 `get_product_images_sorted_by_relevance` 函数（复用 `select_primary_image` 逻辑）
- [x] C-002 修改 `scrape_url_for_cta_batch_task`（Phase 1）计算并保存 `sorted_image_urls`
- [x] C-003 修改 `_get_product_image_url` 或添加新函数 `_get_product_image_url_for_variant`，支持按 variant_index 选择图片
- [x] C-004 修改 `process_cta_info_task` 使用新的图片选择逻辑
- [ ] C-005 编写单元测试验证图片排序和轮询逻辑

---

# T-003 Admin 显示 background URLs (Independent)

## 需求描述

在 Django Admin 中显示 `product_background_url` 和 `generated_background_url`。

**数据来源**: 这两个 URL 存储在 `CTAInfo.suggestion`（JSONField）中，由 `_save_suggestion` 写入。

**实现方式**: 在 Admin 中添加只读"显示"方法，从 `obj.suggestion.get(...)` 读取，渲染为可点击链接。不需要添加新的模型字段或迁移。

**需求类型**：Enhancement

**涉及领域**：后端

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 Django Admin 配置

**后端Code Point:**
- `webserver/backend/tools/llm_editor/admin.py` - 现有 Admin 配置
- `webserver/backend/tools/llm_editor/tasks/v2.py:1346,1363` - `_save_suggestion` 写入 background URLs

## 注意点

- **防御性编程**: 在显示方法中防护 `suggestion` 为 `None` 或非字典的情况
- **只读显示**: 这些字段是只读的，不需要编辑功能
- **链接格式**: 使用 `format_html` 渲染可点击链接，新窗口打开
- **空值处理**: URL 不存在时显示 "-" 或空字符串

## Scenario

### Scenario 1: Admin 查看 CTAInfo 列表

**场景描述：**
运营人员在 Admin 中查看 CTAInfo 列表。

**前置条件：**
- CTAInfo 已生成，suggestion 中包含 background URLs

**操作步骤：**
1. 进入 Django Admin
2. 打开 CTAInfo 列表页面
3. 查看 product_background_url 和 generated_background_url 列

**预期结果：**
- 列表显示两个 URL 列
- URL 以可点击链接形式显示
- 点击链接在新窗口打开图片

### Scenario 2: Admin 查看 Job 详情

**场景描述：**
运营人员在 Admin 中查看 CTAGenerationJob 详情，查看内联的 CTAInfo。

**预期结果：**
- CTAInfoInline 中显示两个 URL 列
- 每个 CTAInfo 行显示对应的 background URLs

## Checklist

- [x] C-001 在 `CTAInfoAdmin` 中添加 `product_background_url_display` 方法
- [x] C-002 在 `CTAInfoAdmin` 中添加 `generated_background_url_display` 方法
- [x] C-003 将两个显示方法添加到 `CTAInfoAdmin.readonly_fields` 和 `list_display`
- [x] C-004 在 `CTAInfoAdmin.fieldsets` 中添加 Background URLs 区块
- [x] C-005 在 `CTAInfoInline` 中添加两个显示方法
- [x] C-006 验证空值和异常情况的显示

---

# T-004 前端 batch-preview 添加 cta_id URL 参数 (Independent)

## 需求描述

在前端 batch-preview 页面，当用户点击 Edit 时，更新当前 URL 添加搜索参数 `cta_id=xxx`。

**路由修改**: 在 batch-preview 路由的 `validateSearch` 中添加可选搜索参数 `cta_id: z.string().optional()`。

**Edit 点击**: 在 `handleEditClick` 中调用 router 导航到相同路径并设置 `cta_id`。

**需求类型**：Enhancement

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端架构和开发规范
- `.project-rules/frontend/workflow-small-change.md` - 小型功能更改流程

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/batch-preview.tsx` - 路由定义
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - batch-preview 页面，`handleEditClick` 函数

**其他:**
- TanStack Router 文档 - `validateSearch`, `router.navigate`

## 注意点

- **URL 更新方式**: 使用 `router.navigate` 更新 URL，不离开当前页面
- **参数保留**: 保留现有的 `jobId` 参数，只添加 `cta_id`
- **可选参数**: `cta_id` 是可选的，不影响现有功能
- **重复点击**: 用户连续点击不同 CTA 的 Edit 时，URL 应该更新为最新的 `cta_id`

## Scenario

### Scenario 1: 用户点击 Edit 更新 URL

**场景描述：**
用户在 batch-preview 页面点击某个 CTA 的 Edit 按钮。

**前置条件：**
- 用户已打开 batch-preview 页面，URL 为 `/tool/cta-generator/batch-preview?jobId=xxx`
- 页面已加载完成，显示 CTA 预览列表

**操作步骤：**
1. 用户点击某个 CTA 的 Edit 按钮
2. 系统打开 Edit 对话框
3. 系统更新 URL 为 `/tool/cta-generator/batch-preview?jobId=xxx&cta_id=yyy`

**预期结果：**
- URL 包含 `cta_id` 参数
- 页面不刷新，对话框正常显示
- 用户可以分享该 URL，其他人打开后能看到相同的 CTA Edit 状态（如果后续实现该功能）

### Scenario 2: 用户切换 Edit 目标

**场景描述：**
用户先点击 CTA A 的 Edit，然后关闭对话框，再点击 CTA B 的 Edit。

**预期结果：**
- 第一次点击后 URL: `?jobId=xxx&cta_id=A`
- 第二次点击后 URL: `?jobId=xxx&cta_id=B`
- URL 正确更新为最新的 cta_id

## Checklist

- [x] C-001 修改路由 `validateSearch`，添加 `cta_id: z.string().optional()`
- [x] C-002 修改 `handleEditClick`，调用 `router.navigate` 更新 URL
- [x] C-003 确保 `jobId` 参数在导航时保留
- [x] C-004 验证 URL 更新不触发页面刷新
