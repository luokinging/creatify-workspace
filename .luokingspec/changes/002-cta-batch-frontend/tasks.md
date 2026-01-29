# T-001: 基础设施和数据类型定义

## 需求描述

建立CTA批量生成前端功能的基础设施，包括API接口定义、TypeScript类型定义、路由配置等，为后续页面和组件开发提供基础支持。

**需求类型**：Infrastructure

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端开发规范和目录结构
- `.project-rules/frontend/architecture.md` - 了解路由配置和页面组件结构

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - 添加批量任务API接口
- `webserver/frontend/feature/tool.cta-generator/type.ts` - 添加后端数据类型定义
- `webserver/frontend/routes.ts` - 路由配置（可能需要更新）

**前端路由:**
- `/tool/cta-generator/test` - 入口页
- `/tool/cta-generator/cta-list` - 列表页
- `/tool/cta-generator/new-cta` - 创建页
- `/tool/cta-generator/cta-preview` - 预览页

**后端Code Point:**
- `webserver/backend/tools/llm_editor/models.py` - 后端数据模型参考
- `webserver/backend/tools/llm_editor/views.py` - 后端API实现参考
- `webserver/backend/tools/llm_editor/serializers.py` - 后端序列化器参考

**其他:**
- TanStack Router文档 - 了解路由配置
- TypeScript文档 - 了解类型定义

## 注意点

1. **类型定义必须与后端完全一致** - 确保前后端数据结构的匹配性
2. **API接口需要处理错误情况** - 统一的错误处理机制
3. **类型定义需要考虑可为空字段** - 避免null/undefined错误
4. **路由配置需要考虑参数传递** - 预览页需要通过query参数传递jobId

## Scenario

### Scenario 1: 开发者调用API创建批量任务
    **场景描述：**
    开发者在创建页面调用API创建批量任务，传入URL列表和变体数量。

    **前置条件：**
    - 用户已登录
    - 已填写至少1个URL，最多5个
    - 每个URL的变体数量在1-10之间

    **操作步骤：**
    1. 用户填写URL和变体数量
    2. 点击Generate按钮
    3. 前端调用createCTABatchJob API
    4. 后端返回job和task_id

    **预期结果：**
    - API调用成功
    - 返回job对象和task_id
    - job包含正确的input字段
    - 导航到列表页

### Scenario 2: 开发者获取任务列表
    **场景描述：**
    列表页面需要获取所有批量任务列表。

    **前置条件：**
    - 用户已登录
    - 已有批量任务数据

    **操作步骤：**
    1. 列表页加载
    2. 调用getCTABatchJobs API
    3. 后端返回分页的任务列表

    **预期结果：**
    - API调用成功
    - 返回分页数据（count, next, previous, results）
    - results包含完整的job对象

### Scenario 3: 开发者获取任务详情和CTAInfo
    **场景描述：**
    预览页面需要获取特定任务的详情和所有CTAInfo。

    **前置条件：**
    - 用户已登录
    - 已有批量任务数据
    - URL包含jobId参数

    **操作步骤：**
    1. 预览页加载
    2. 从URL获取jobId
    3. 调用getCTABatchJob API
    4. 后端返回job详情和cta_infos

    **预期结果：**
    - API调用成功
    - 返回完整的job对象
    - cta_infos包含所有CTAInfo对象

## Checklist

- [ ] C-001 在`api/index.ts`中添加批量任务相关的API接口函数
  - [ ] createCTABatchJob - 创建批量任务
  - [ ] getCTABatchJobs - 获取任务列表（支持分页）
  - [ ] getCTABatchJob - 获取单个任务详情
  - [ ] getCTABatchJobCTAInfos - 获取任务的所有CTAInfo
  - [ ] updateCTAInfo - 更新CTAInfo的suggestion
  - [ ] deleteCTABatchJob - 删除任务
- [ ] C-002 在`type.ts`中添加后端数据类型的TypeScript定义
  - [ ] CTAGenerationJob接口
  - [ ] CTAInfo接口
  - [ ] CTAInfoStatus枚举
  - [ ] CTAJobInput接口
  - [ ] API请求和响应类型
- [ ] C-003 验证API接口调用正常
  - [ ] 测试创建任务接口
  - [ ] 测试获取列表接口
  - [ ] 测试获取详情接口
  - [ ] 测试更新接口
  - [ ] 测试删除接口
- [ ] C-004 验证类型定义正确性
  - [ ] 确保类型定义与后端一致
  - [ ] 处理可为空字段
  - [ ] 添加必要的类型注释
- [ ] C-005 代码质量检查
  - [ ] 通过TypeScript类型检查
  - [ ] 通过ESLint检查
  - [ ] 代码格式符合项目规范


---

# T-002: CTAPreview组件实现

## 需求描述

实现全新的CTAPreview组件，用于批量生成功能的CTA预览。该组件支持显示CTA预览、状态信息、Edit和View操作。保留现有的CtaPreviewOnlyIframe组件不变。新组件是批量生成功能的核心组件，将在列表页和预览页中大量使用。

**需求类型**：Feature

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端开发规范
- `.project-rules/frontend/architecture.md` - 了解组件架构

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview.tsx` - 新的CTA预览组件（创建）
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx` - 现有组件参考（不修改）
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - Host控制器

**其他:**
- `.doc/reference/preview.tsx` - UI参考

## 注意点

1. **组件必须支持多实例** - 一个页面可能有多个CTAPreview实例，每个实例需要独立的controller
2. **状态显示必须准确** - 根据CTAInfo的status字段显示正确的状态
3. **Edit和View功能必须正确实现** - 使用Dialog组件，区分Edit和View模式
4. **iframe通信必须稳定** - 使用Comlink，确保通信的可靠性
5. **性能优化** - 考虑延迟加载、虚拟化等优化手段

## Scenario

### Scenario 1: 用户查看CTA预览（pending状态）
    **场景描述：**
    用户在列表页查看一个正在处理中的CTA预览。

    **前置条件：**
    - CTAInfo状态为pending
    - 组件已挂载

    **操作步骤：**
    1. 组件加载
    2. 显示pending状态
    3. 显示loading提示

    **预期结果：**
    - 显示"Pending"状态提示
    - 显示loading图标
    - 不显示Edit和View按钮

### Scenario 2: 用户查看CTA预览（done状态）
    **场景描述：**
    用户在列表页查看一个已完成的CTA预览。

    **前置条件：**
    - CTAInfo状态为done
    - suggestion包含完整数据

    **操作步骤：**
    1. 组件加载
    2. 显示done状态
    3. 点击View按钮
    4. 查看CTA详情

    **预期结果：**
    - 显示完整的CTA预览
    - 显示Edit和View按钮
    - 点击View打开View Dialog
    - Dialog显示9:16的CTA预览

### Scenario 3: 用户编辑CTA
    **场景描述：**
    用户在预览页点击Edit按钮编辑CTA。

    **前置条件：**
    - CTAInfo状态为done
    - suggestion包含完整数据

    **操作步骤：**
    1. 点击Edit按钮
    2. 打开Edit Dialog
    3. 在iframe中编辑内容
    4. 修改自动保存（500ms debounce）

    **预期结果：**
    - 打开Edit Dialog
    - Dialog显示iframe（铺满）
    - 修改内容后自动调用hostController.updateSuggestion
    - 前端使用500ms debounce同步到后端
    - 更新成功后显示提示

## Checklist

- [ ] C-001 创建CTAPreview组件文件
  - [ ] 创建新的组件文件`cta-preview.tsx`
  - [ ] 定义组件Props接口（包括controller、prefill、status等）
  - [ ] 确保不修改现有的`cta-preview-only-iframe.tsx`组件
- [ ] C-002 实现iframe加载和通信
  - [ ] 使用Comlink连接iframe
  - [ ] 暴露CreatifyHostController实例
  - [ ] 处理iframe加载失败情况
- [ ] C-003 实现状态显示
  - [ ] 显示pending/analyzing/generating_image/generating_suggestion/done/failed状态
  - [ ] 状态显示在组件下方中间
  - [ ] failed状态显示错误信息
- [ ] C-004 实现Edit和View按钮
  - [ ] done状态时显示按钮
  - [ ] 点击按钮打开Dialog
  - [ ] 区分Edit和View模式
- [ ] C-005 创建CTAPreviewDialog组件
  - [ ] 基于BasicDialog实现
  - [ ] View模式：显示9:16的CTA预览（居中）
  - [ ] Edit模式：显示iframe（铺满）
  - [ ] 处理Dialog关闭事件
- [ ] C-006 实现Edit功能的更新逻辑
  - [ ] 监听hostController.updateSuggestion调用
  - [ ] 使用500ms debounce同步到后端
  - [ ] 调用updateCTAInfo API
  - [ ] 处理更新成功/失败
- [ ] C-007 性能优化
  - [ ] 延迟加载iframe
  - [ ] 卸载时清理资源
  - [ ] 避免不必要的重渲染
- [ ] C-008 代码质量检查
  - [ ] 通过TypeScript类型检查
  - [ ] 通过ESLint检查
  - [ ] 组件有清晰的类型定义
  - [ ] 组件有必要的注释


---

# T-003: 创建页面实现 (deps: T-001)

## 需求描述

实现批量任务的创建页面，允许用户输入多个产品URL和对应的变体数量，调用后端API创建批量任务，成功后导航到列表页。

**需求类型**：Feature

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端开发规范
- `.project-rules/frontend/architecture.md` - 了解表单处理和验证

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 创建页实现（更新）
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - API接口（T-001中添加）

**前端路由:**
- `/tool/cta-generator/new-cta` - 创建页路由
- `/tool/cta-generator/cta-list` - 列表页路由（成功后导航）

**其他:**
- `.doc/reference/new-task.tsx` - UI参考

## 注意点

1. **表单验证必须完整** - URL格式、数量范围、最多5个URL等
2. **错误处理必须友好** - 显示清晰的错误信息
3. **加载状态必须明确** - 创建过程中显示loading
4. **UI必须与参考设计保持90%以上一致性**

## Scenario

### Scenario 1: 用户成功创建批量任务
    **场景描述：**
    用户填写URL和变体数量，成功创建批量任务。

    **前置条件：**
    - 用户已登录
    - 访问/tool/cta-generator/new-cta

    **操作步骤：**
    1. 页面加载显示创建表单
    2. 填写第一个URL
    3. 设置变体数量
    4. 点击"Add URL"添加第二个URL
    5. 填写第二个URL和变体数量
    6. 点击"Generate"按钮
    7. 等待创建完成

    **预期结果：**
    - 显示loading状态
    - 调用createCTABatchJob API
    - 成功后导航到列表页
    - 显示成功提示

### Scenario 2: 用户表单验证失败
    **场景描述：**
    用户填写了无效的URL或超出范围的变体数量。

    **前置条件：**
    - 用户已登录
    - 访问/tool/cta-generator/new-cta

    **操作步骤：**
    1. 填写无效的URL（如"not a url"）
    2. 或填写超出范围的变体数量（如100）
    3. 点击"Generate"按钮

    **预期结果：**
    - 显示错误提示
    - Generate按钮保持禁用状态
    - 不调用API

### Scenario 3: 用户添加和删除URL行
    **场景描述：**
    用户动态添加和删除URL输入行。

    **前置条件：**
    - 用户已登录
    - 访问/tool/cta-generator/new-cta

    **操作步骤：**
    1. 页面加载显示1个URL行
    2. 点击"Add URL"添加第二行
    3. 继续添加直到最多5行
    4. 点击某行的删除按钮
    5. 尝试删除最后一行（应该不允许）

    **预期结果：**
    - 最多显示5个URL行
    - 至少保留1个URL行
    - 每行显示序号
    - 每行可以独立删除（除了最后一行）

## Checklist

- [x] C-001 更新new-batch.tsx页面实现
  - [x] 移除现有的Mock数据调用
  - [x] 使用后端API
- [x] C-002 实现表单布局
  - [x] 页面标题"New Batch"
  - [x] "Add URL"按钮
  - [x] URL输入行列表
  - [x] Generate按钮
- [x] C-003 实现URL输入行
  - [x] 显示序号
  - [x] URL输入框（带验证）
  - [x] 变体数量输入框（1-10）
  - [x] 删除按钮
- [x] C-004 实现表单验证
  - [x] URL格式验证
  - [x] 变体数量范围验证
  - [x] 最多5个URL限制
  - [x] 至少1个URL限制
  - [x] 实时显示错误信息
- [x] C-005 实现创建逻辑
  - [x] 收集表单数据
  - [x] 调用createCTABatchJob API
  - [x] 显示loading状态
  - [x] 处理成功响应
  - [x] 处理错误响应
- [x] C-006 实现导航逻辑
  - [x] 成功后导航到列表页
  - [x] 显示成功提示
  - [x] 失败时停留在当前页
- [x] C-007 样式实现
  - [x] 按照参考设计实现样式
  - [x] 保持90%以上一致性
  - [x] 响应式布局
- [x] C-008 代码质量检查
  - [x] 通过TypeScript类型检查
  - [x] 通过ESLint检查
  - [x] 表单验证逻辑完整


---

# T-004: 列表页面实现 (deps: T-001, T-002)

## 需求描述

实现批量任务的列表页面，展示所有批量任务，支持查看任务状态、进度和预览。轮询逻辑应该在ViewController中实现，页面组件只负责渲染。

**需求类型**：Feature

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端开发规范
- `.project-rules/frontend/architecture.md` - 了解MVC架构和ViewController模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch/index.tsx` - 列表页实现（更新）
- `webserver/frontend/feature/tool.cta-generator/page/batch/components/batch-list-item.tsx` - 列表项组件（更新）
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - ViewController（更新，移除Mock，实现轮询逻辑）
- `webserver/frontend/feature/tool.cta-generator/context/batch-list-view-controller-context.tsx` - Context（更新）

**前端路由:**
- `/tool/cta-generator/cta-list` - 列表页路由
- `/tool/cta-generator/new-cta` - 创建页路由（Create New Batch按钮）
- `/tool/cta-generator/cta-preview` - 预览页路由（View All按钮）

**其他:**
- `.doc/reference/cta-task-list.tsx` - UI参考
- `.doc/reference/cta-task-item.tsx` - 列表项UI参考

## 注意点

1. **必须移除Mock数据** - 完全使用后端API数据
2. **轮询逻辑在ViewController中** - 页面组件只负责渲染，不包含轮询逻辑
3. **列表item右侧显示静态图片** - 显示所有关联CTA的AI生成图片（`suggestion.background_image_url`），不使用iframe
4. **必须处理空状态** - 无任务时显示提示信息
5. **必须处理加载状态** - 初始加载时显示loading

## Scenario

### Scenario 1: 用户访问列表页（有任务数据）
    **场景描述：**
    用户访问列表页，查看已有的批量任务。

    **前置条件：**
    - 用户已登录
    - 已有批量任务数据
    - 访问/tool/cta-generator/cta-list

    **操作步骤：**
    1. 页面加载
    2. 显示loading状态
    3. 调用getCTABatchJobs API
    4. 显示任务列表
    5. 自动轮询更新状态

    **预期结果：**
    - 初始显示loading
    - 显示任务列表
    - 每个任务显示：标题、描述、状态、失败数量、预览图
    - 显示"Create New Batch"按钮
    - 自动轮询更新任务状态

### Scenario 2: 用户访问列表页（无任务数据）
    **场景描述：**
    用户首次访问列表页，还没有任何批量任务。

    **前置条件：**
    - 用户已登录
    - 没有批量任务数据
    - 访问/tool/cta-generator/cta-list

    **操作步骤：**
    1. 页面加载
    2. 显示loading状态
    3. 调用getCTABatchJobs API
    4. 返回空列表

    **预期结果：**
    - 初始显示loading
    - 显示提示信息"No bulk tasks yet. Create your first batch to get started."
    - 显示"Create New Batch"按钮
    - 不显示任务列表

### Scenario 3: 用户点击View All按钮
    **场景描述：**
    用户点击某个任务的View All按钮，查看该任务的所有CTA预览。

    **前置条件：**
    - 用户已登录
    - 列表页显示任务数据
    - 某个任务有CTA预览

    **操作步骤：**
    1. 点击某个任务的View All按钮

    **预期结果：**
    - 导航到/tool/cta-generator/cta-preview
    - URL包含jobId参数
    - 预览页显示该任务的所有CTA

### Scenario 4: 用户点击Create New Batch按钮
    **场景描述：**
    用户点击Create New Batch按钮，创建新的批量任务。

    **前置条件：**
    - 用户已登录
    - 列表页已加载

    **操作步骤：**
    1. 点击Create New Batch按钮

    **预期结果：**
    - 导航到/tool/cta-generator/new-cta
    - 进入创建页面

## Checklist

- [x] C-001 更新batch/index.tsx页面实现
  - [x] 移除Mock数据调用
  - [x] 使用ViewController提供的数据和方法
  - [x] 不在页面组件中实现轮询逻辑
- [x] C-002 更新BatchListViewController
  - [x] 移除getMockList等Mock方法
  - [x] 实现fetchJobs方法
  - [x] 在ViewController中实现轮询逻辑
  - [x] 提供startPolling和stopPolling方法
  - [x] 处理loading和error状态
- [x] C-003 更新batch-list-item.tsx组件
  - [x] 使用CTAGenerationJob数据类型
  - [x] 显示任务信息
  - [x] 显示状态和进度
  - [x] 右侧显示所有CTA的AI生成图片（静态img标签，不使用iframe）
  - [x] 图片来自`cta_infos[].suggestion.background_image_url`
  - [x] 使用grid或flex布局显示多张图片
  - [x] 实现View All按钮
  - [x] 实现Download按钮（可选）
- [x] C-004 实现列表页布局
  - [x] 顶部固定栏：标题 + 任务数量 + Create New Batch按钮
  - [x] 任务列表区域
  - [x] 空状态提示
  - [x] Loading状态
- [x] C-005 实现ViewController轮询逻辑
  - [x] 轮询间隔2-3秒
  - [x] 所有任务完成时停止轮询
  - [x] 提供清理方法供页面卸载时调用
  - [x] 暴露轮询状态给页面组件
- [x] C-006 实现预览图显示
  - [x] 每个任务右侧显示所有CTA的AI生成图片
  - [x] 使用静态img标签显示图片（不使用iframe）
  - [x] 图片来源于`cta_infos[].suggestion.background_image_url`
  - [x] 使用grid或flex布局排列图片
  - [x] 横向滚动支持（图片较多时）
  - [x] 显示失败的CTA（显示占位图或错误状态）
- [x] C-007 样式实现
  - [x] 按照参考设计实现样式
  - [x] 保持90%以上一致性
  - [x] 响应式布局
- [x] C-008 代码质量检查
  - [x] 通过TypeScript类型检查
  - [x] 通过ESLint检查
  - [x] 轮询逻辑在ViewController中正确实现


---

# T-005: 预览页面实现 (deps: T-001, T-002, T-004)

## 需求描述

实现批量任务的预览页面，展示特定任务的所有CTA预览，支持View和Edit操作。轮询逻辑应该在ViewController中实现，页面组件只负责渲染。

**需求类型**：Feature

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` - 了解前端开发规范
- `.project-rules/frontend/architecture.md` - 了解MVC架构和ViewController模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 预览页实现（更新）
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview.tsx` - CTAPreview组件（T-002中实现）
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-dialog.tsx` - Dialog组件（T-002中实现）
- `webserver/frontend/feature/tool.cta-generator/manager/batch-preview-view-controller.ts` - ViewController（新增，实现轮询逻辑）

**前端路由:**
- `/tool/cta-generator/cta-preview?jobId={jobId}` - 预览页路由

**其他:**
- `.doc/reference/preview.tsx` - UI参考

## 注意点

1. **必须正确处理jobId参数** - 从URL获取jobId，处理缺失或无效的情况
2. **轮询逻辑在ViewController中** - 页面组件只负责渲染，不包含轮询逻辑
3. **必须按Product分组显示** - 同一Product的CTA显示在一起
4. **必须处理空状态** - 无CTA时显示提示信息
5. **必须处理加载状态** - 初始加载时显示loading

## Scenario

### Scenario 1: 用户访问预览页（有CTA数据）
    **场景描述：**
    用户从列表页点击View All，访问预览页查看任务的所有CTA。

    **前置条件：**
    - 用户已登录
    - 列表页点击View All
    - URL包含jobId参数
    - 任务有CTA数据

    **操作步骤：**
    1. 页面加载
    2. 从URL获取jobId
    3. 显示loading状态
    4. 调用getCTABatchJob API
    5. 显示CTA预览列表
    6. 自动轮询更新状态

    **预期结果：**
    - 初始显示loading
    - 显示任务标题和进度
    - 按Product分组显示CTA
    - 每个CTA使用CTAPreview组件
    - 显示处理进度（X/Y completed）
    - 自动轮询更新状态

### Scenario 2: 用户访问预览页（无CTA数据）
    **场景描述：**
    用户访问预览页，但任务还没有CTA数据（可能正在处理中）。

    **前置条件：**
    - 用户已登录
    - URL包含jobId参数
    - 任务没有CTA数据或正在处理

    **操作步骤：**
    1. 页面加载
    2. 从URL获取jobId
    3. 调用getCTABatchJob API
    4. 返回空CTA列表或pending状态

    **预期结果：**
    - 显示loading状态
    - 或显示提示信息"No previews available yet. The task may still be processing."
    - 继续轮询更新

### Scenario 3: 用户点击View按钮查看CTA
    **场景描述：**
    用户点击某个CTA的View按钮，查看CTA详情。

    **前置条件：**
    - 用户已登录
    - 预览页显示CTA数据
    - 某个CTA状态为done

    **操作步骤：**
    1. 点击某个CTA的View按钮

    **预期结果：**
    - 打开View Dialog
    - Dialog显示9:16的CTA预览（居中）
    - 显示CTA的完整内容

### Scenario 4: 用户点击Edit按钮编辑CTA
    **场景描述：**
    用户点击某个CTA的Edit按钮，编辑CTA内容。

    **前置条件：**
    - 用户已登录
    - 预览页显示CTA数据
    - 某个CTA状态为done

    **操作步骤：**
    1. 点击某个CTA的Edit按钮
    2. 打开Edit Dialog
    3. 在iframe中编辑内容
    4. 修改自动保存

    **预期结果：**
    - 打开Edit Dialog
    - Dialog显示iframe（铺满）
    - 修改内容后自动保存
    - 更新成功后显示提示

## Checklist

- [ ] C-001 更新batch-preview.tsx页面实现
  - [ ] 移除Mock数据调用
  - [ ] 使用ViewController提供的数据和方法
  - [ ] 不在页面组件中实现轮询逻辑
- [ ] C-002 创建BatchPreviewViewController
  - [ ] 创建新的ViewController文件
  - [ ] 实现fetchJobDetail方法
  - [ ] 在ViewController中实现轮询逻辑
  - [ ] 提供startPolling和stopPolling方法
  - [ ] 处理jobId参数
  - [ ] 处理loading和error状态
- [ ] C-003 实现jobId参数处理
  - [ ] 从URL获取jobId
  - [ ] 处理缺失或无效的jobId
  - [ ] 显示错误提示
- [ ] C-004 实现页面布局
  - [ ] 顶部栏：标题 + 进度提示
  - [ ] CTA预览列表
  - [ ] 按Product分组显示
  - [ ] 空状态提示
  - [ ] Loading状态
- [ ] C-005 实现CTA预览显示
  - [ ] 使用CTAPreview组件
  - [ ] 传入正确的controller和prefill数据
  - [ ] 处理View和Edit点击事件
  - [ ] 显示失败的CTA（带错误状态）
- [ ] C-006 实现ViewController轮询逻辑
  - [ ] 轮询间隔2-3秒
  - [ ] 任务完成时停止轮询
  - [ ] 提供清理方法供页面卸载时调用
  - [ ] 暴露轮询状态给页面组件
- [ ] C-007 实现进度显示
  - [ ] 显示处理进度（X/Y completed）
  - [ ] 显示轮询指示器
  - [ ] 完成后隐藏轮询指示器
- [ ] C-008 样式实现
  - [ ] 按照参考设计实现样式
  - [ ] 保持90%以上一致性
  - [ ] 响应式布局
  - [ ] 横向滚动支持（多CTA时）
- [ ] C-009 代码质量检查
  - [ ] 通过TypeScript类型检查
  - [ ] 通过ESLint检查
  - [ ] 轮询逻辑在ViewController中正确实现
  - [ ] 错误处理完整
