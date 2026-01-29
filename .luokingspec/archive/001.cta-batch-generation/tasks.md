# T-001 创建 CTAGenerationJob 和 CTAInfo 数据模型

## 需求描述

创建批量 CTA 生成任务所需的数据模型，包括 CTAGenerationJob（批量任务）和 CTAInfo（单个 CTA 生成信息），并建立一对多的关联关系。

**需求类型**：Infrastructure

**涉及领域**：后端

**功能要求**：
- 创建 `CTAGenerationJob` 模型，包含 name、input 字段
- 创建 `CTAInfo` 模型，包含 job、url、product、suggestion、status 字段
- 建立外键关联，CTAInfo 通过外键关联到 CTAGenerationJob
- 设置级联删除，删除 Job 时自动删除关联的 CTAInfo
- 添加计算属性：success_count、failed_count、total_count、is_completed
- 添加索引优化查询性能

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解后端开发规范

**后端Code Point:**
- `webserver/backend/tools/llm_editor/models.py` - 添加新模型

**其他:**
- 参考：`webserver/backend/tools/llm_editor/models.py::ProductCTAFlow`

## 注意点

- 模型需要继承 `UUIDModelMixin`、`TimeStampModelMixin`、`UserAndWorkspaceMixin`
- `input` 字段使用 JSONField，格式为 `[{url: str, variant: number}]`
- `suggestion` 字段使用 JSONField，存储完整的 suggestion 数据
- `status` 字段使用 models.TextChoices 定义枚举类型
- 计算属性需要支持 QuerySet 注解优化（使用 `hasattr` 检查注解值）
- 为常用查询字段添加索引（job、status、created_at）

## Scenario

### Scenario 1: 创建批量任务

    **场景描述：**
    - **前置条件**：用户已登录
    - **操作步骤**：
      1. 创建 CTAGenerationJob 实例
      2. 设置 name 和 input 字段
      3. 保存到数据库
    - **预期结果**：
      - Job 成功创建，自动生成 UUID
      - created_at 和 updated_at 自动设置
      - user 和 workspace 字段正确设置

### Scenario 2: 创建关联的 CTAInfo

    **场景描述：**
    - **前置条件**：CTAGenerationJob 已创建
    - **操作步骤**：
      1. 根据输入的 URL 和 variant 数量创建多个 CTAInfo
      2. 每个 CTAInfo 关联到同一个 Job
      3. 设置初始状态为 pending
    - **预期结果**：
      - 所有 CTAInfo 成功创建
      - 通过 `job.cta_info_set.all()` 可以获取所有关联的 CTAInfo

### Scenario 3: 级联删除

    **场景描述：**
    - **前置条件**：Job 和关联的 CTAInfo 已存在
    - **操作步骤**：
      1. 删除 CTAGenerationJob
    - **预期结果**：
      - 所有关联的 CTAInfo 被自动删除
      - 数据库中不存在孤儿数据

## Checklist

- [x] C-001 CTAGenerationJob 模型创建完成，包含所有必需字段
- [x] C-002 CTAInfo 模型创建完成，包含所有必需字段
- [x] C-003 外键关联正确设置，related_name 为 'cta_info_set'
- [x] C-004 级联删除正确配置（on_delete=CASCADE）
- [x] C-005 CTAInfoStatus 枚举类型定义完整（pending/analyzing/generating_image/generating_suggestion/done/failed）
- [x] C-006 计算属性实现正确，支持注解优化
- [x] C-007 retry_count 和 error_message 字段添加完成
- [ ] C-008 数据库迁移文件生成成功
- [x] C-009 索引正确添加（job、status、created_at）
- [x] C-010 Model 的 __str__ 方法实现正确

---

# T-002 实现 CTAGenerationJob 和 CTAInfo 的 Serializer (deps: T-001)

## 需求描述

创建 CTAGenerationJob 和 CTAInfo 的序列化器，支持 API 的数据验证和序列化。

**需求类型**：Infrastructure

**涉及领域**：后端

**功能要求**：
- 创建 `CTAGenerationJobSerializer`，包含输入验证
- 创建 `CTAInfoSerializer`，包含完整的 suggestion 数据
- 支持计算属性的序列化
- 支持嵌套序列化（Job 包含 CTAInfo 列表）
- 添加输入验证：URL 最多 5 个，variant 最多 10 个

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 Serializer 开发规范

**后端Code Point:**
- `webserver/backend/tools/llm_editor/serializers.py` - 添加新 Serializer

**其他:**
- 参考：`webserver/backend/tools/llm_editor/serializers.py::ProductCTAFlowSerializer`

## 注意点

- Serializer 需要处理 User 和 Workspace 的自动设置
- input 字段需要验证格式和数量限制
- 计算属性使用 `SerializerMethodField` 或直接通过 Model 的 property
- 嵌套序列化需要考虑性能，避免过度查询
- suggestion 字段包含完整的 JSON 数据，需要完整序列化

## Scenario

### Scenario 1: 序列化 Job 包含计算属性

    **场景描述：**
    - **前置条件**：CTAGenerationJob 已创建
    - **操作步骤**：
      1. 使用 CTAGenerationJobSerializer 序列化 Job
      2. 返回给前端
    - **预期结果**：
      - 包含 success_count、failed_count、total_count、is_completed 字段
      - 数值正确计算

### Scenario 2: 嵌套序列化 CTAInfo

    **场景描述：**
    - **前置条件**：Job 和关联的 CTAInfo 已存在
    - **操作步骤**：
      1. 查询 Job 时预加载关联的 CTAInfo
      2. 使用嵌套序列化返回数据
    - **预期结果**：
      - 返回的数据包含 cta_infos 字段
      - 每个 CTAInfo 包含完整的 suggestion 数据

### Scenario 3: 输入验证

    **场景描述：**
    - **前置条件**：前端提交创建任务请求
    - **操作步骤**：
      1. 前端提交超过 5 个 URL
      2. Serializer 进行验证
    - **预期结果**：
      - 返回验证错误
      - 错误信息清晰说明限制

## Checklist

- [x] C-001 CTAGenerationJobSerializer 创建完成
- [x] C-002 CTAInfoSerializer 创建完成
- [x] C-003 计算属性正确序列化
- [x] C-004 嵌套序列化正确实现
- [x] C-005 输入验证正确（URL 最多 5 个，variant 最多 10 个）
- [x] C-006 User 和 Workspace 字段正确处理
- [x] C-007 suggestion 字段完整序列化
- [x] C-008 错误信息清晰友好

---

# T-003 实现 Celery 批量处理任务 (deps: T-001, T-002)

## 需求描述

实现 Celery 任务来处理批量 CTA 生成，包括主任务（创建 Job 和 CTAInfo）和子任务（处理单个 CTAInfo）。

**需求类型**：Feature

**涉及领域**：后端

**功能要求**：
- 实现 `create_cta_batch_job_task`：创建 Job 和 CTAInfo，并启动子任务
- 实现 `process_cta_info_task`：处理单个 CTAInfo，包括 URL 分析、图片生成、suggestion 生成
- 支持状态更新：pending → analyzing → generating_image → generating_suggestion → done/failed
- 支持自动重试（最多重试 1 次）
- 支持图片循环补足机制
- 复用现有的 `generate_creative_suggestions_v2_task` 逻辑

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 Celery 任务开发规范

**后端Code Point:**
- `webserver/backend/tools/llm_editor/tasks/v2.py` - 添加批量任务

**其他:**
- 参考：`webserver/backend/tools/llm_editor/tasks/v2.py::generate_creative_suggestions_v2_task`

## 注意点

- 子任务使用 `@app.task(bind=True, max_retries=1)` 实现自动重试
- 每个状态更新需要保存到数据库
- 图片循环补足：使用 `i % len(images)` 实现循环
- 错误处理：捕获异常并更新状态为 failed，记录 error_message
- 复用现有逻辑：参考 `generate_creative_suggestions_v2_task` 的实现
- 并行处理：为每个 CTAInfo 启动独立的子任务

## Scenario

### Scenario 1: 创建批量任务

    **场景描述：**
    - **前置条件**：前端提交创建请求
    - **操作步骤**：
      1. 主任务创建 CTAGenerationJob
      2. 根据 input 创建多个 CTAInfo
      3. 为每个 CTAInfo 启动子任务
    - **预期结果**：
      - Job 成功创建
      - 所有 CTAInfo 创建完成，状态为 pending
      - 所有子任务启动成功

### Scenario 2: 处理单个 CTAInfo

    **场景描述：**
    - **前置条件**：CTAInfo 已创建，状态为 pending
    - **操作步骤**：
      1. 更新状态为 analyzing
      2. 分析 URL 获取 Product
      3. 设置 original image（循环补足）
      4. 更新状态为 generating_image
      5. 生成 AI 背景图
      6. 更新状态为 generating_suggestion
      7. 生成完整的 suggestion
      8. 更新状态为 done
    - **预期结果**：
      - 每个阶段状态正确更新
      - suggestion 包含完整的生成数据
      - 最终状态为 done

### Scenario 3: 失败重试

    **场景描述：**
    - **前置条件**：子任务执行失败
    - **操作步骤**：
      1. 捕获异常
      2. 检查 retry_count
      3. 如果小于 1，则重试
      4. 否则标记为 failed
    - **预期结果**：
      - 失败的任务自动重试 1 次
      - 重试失败后状态标记为 failed
      - error_message 记录失败原因

## Checklist

- [x] C-001 `create_cta_batch_job_task` 主任务实现完成
- [x] C-002 `process_cta_info_task` 子任务实现完成
- [x] C-003 状态更新逻辑正确实现
- [x] C-004 自动重试机制正确实现（max_retries=1）
- [x] C-005 图片循环补足机制正确实现
- [x] C-006 错误处理和重试逻辑正确
- [x] C-007 复用现有逻辑（URL 分析、图片生成、suggestion 生成）
- [x] C-008 并行处理正确实现（每个 CTAInfo 独立任务）
- [x] C-009 error_message 正确记录
- [ ] C-010 所有状态转换正确测试

---

# T-004 实现 CTAGenerationJob 和 CTAInfo 的 ViewSet (deps: T-002, T-003)

## 需求描述

创建 CTAGenerationJobViewSet 和 CTAInfoViewSet，提供批量任务的 CRUD API 接口。

**需求类型**：Feature

**涉及领域**：后端

**功能要求**：
- 创建 `CTAGenerationJobViewSet`，提供列表、创建、详情、删除接口
- 创建 `CTAInfoViewSet`，提供详情、更新接口
- 支持分页查询（PageNumberPagination）
- 支持权限验证（只查询当前用户当前 workspace 的数据）
- 支持计算属性的 QuerySet 优化（使用 annotate）
- 支持更新 CTAInfo 的 suggestion

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解 ViewSet 开发规范

**后端Code Point:**
- `webserver/backend/tools/llm_editor/views.py` - 添加新 ViewSet
- `webserver/backend/tools/llm_editor/urls.py` - 添加路由

**其他:**
- 参考：`webserver/backend/tools/llm_editor/views.py::ProductCTAFlowViewSet`

## 注意点

- 权限验证：使用 `IsAuthenticated` 和 workspace 过滤
- 分页配置：使用 `PageNumberPagination`
- QuerySet 优化：使用 `annotate()` 预计算计算属性
- 删除操作：使用 `perform_destroy` 确保级联删除
- 更新 CTAInfo：只允许更新 suggestion 字段
- 启动任务：创建 Job 后立即启动 Celery 任务

## Scenario

### Scenario 1: 创建批量任务

    **场景描述：**
    - **前置条件**：前端已登录
    - **操作步骤**：
      1. POST /api/cta-batch/jobs/
      2. 传入 input 参数
    - **预期结果**：
      - Job 创建成功
      - Celery 任务启动
      - 返回 Job 数据

### Scenario 2: 查询任务列表（分页）

    **场景描述：**
    - **前置条件**：多个 Job 已存在
    - **操作步骤**：
      1. GET /api/cta-batch/jobs/?page=1&page_size=10
    - **预期结果**：
      - 返回分页数据
      - 包含 count、next、previous、results
      - 计算属性正确返回

### Scenario 3: 查询任务详情（包含 CTAInfo）

    **场景描述：**
    - **前置条件**：Job 和关联的 CTAInfo 已存在
    - **操作步骤**：
      1. GET /api/cta-batch/jobs/{id}/
    - **预期结果**：
      - 返回 Job 完整数据
      - 包含关联的 CTAInfo 列表
      - 使用 `select_related` 和 `prefetch_related` 优化查询

### Scenario 4: 更新 CTAInfo suggestion

    **场景描述：**
    - **前置条件**：CTAInfo 已存在，前端编辑了 suggestion
    - **操作步骤**：
      1. PUT /api/cta-batch/cta-infos/{id}/
      2. 传入更新后的 suggestion
    - **预期结果**：
      - CTAInfo 更新成功
      - suggestion 保存到数据库
      - 返回更新后的数据

### Scenario 5: 删除任务

    **场景描述：**
    - **前置条件**：Job 已存在
    - **操作步骤**：
      1. DELETE /api/cta-batch/jobs/{id}/
    - **预期结果**：
      - Job 删除成功
      - 关联的 CTAInfo 级联删除
      - 返回 204 状态码

## Checklist

- [x] C-001 CTAGenerationJobViewSet 创建完成
- [x] C-002 CTAInfoViewSet 创建完成
- [x] C-003 列表接口实现，支持分页
- [x] C-004 创建接口实现，启动 Celery 任务
- [x] C-005 详情接口实现，支持嵌套 CTAInfo
- [x] C-006 删除接口实现，级联删除
- [x] C-007 更新 CTAInfo 接口实现
- [x] C-008 权限验证正确（workspace 过滤）
- [x] C-009 QuerySet 优化（annotate + select_related + prefetch_related）
- [x] C-010 URL 配置正确添加

---

# T-005 后端集成测试和优化 (deps: T-001, T-002, T-003, T-004)

## 需求描述

进行后端的集成测试，发现并修复问题，优化性能。

**需求类型**：Enhancement

**涉及领域**：后端

**功能要求**：
- 完整的 API 流程测试
- 性能优化
- 错误处理完善
- 并发处理测试

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` - 了解测试规范

## 注意点

- 测试完整的 API 流程
- 测试边界情况和错误处理
- 测试并发处理
- 测试重试机制
- 性能优化（查询优化）

## Scenario

### Scenario 1: 完整 API 流程测试

    **场景描述：**
    - **前置条件**：后端服务已启动
    - **操作步骤**：
      1. 创建批量任务
      2. 查询任务列表
      3. 查询任务详情
      4. 等待任务完成
      5. 更新 CTAInfo
      6. 删除任务
    - **预期结果**：
      - 整个流程顺畅
      - 没有错误

## Checklist

- [ ] C-001 完整 API 流程测试通过
- [ ] C-002 边界情况测试通过
- [ ] C-003 错误处理测试通过
- [ ] C-004 并发处理测试通过
- [ ] C-005 重试机制测试通过
- [ ] C-006 性能优化完成
- [ ] C-007 代码 review 完成
- [ ] C-008 单元测试编写完成
- [ ] C-009 准备部署
