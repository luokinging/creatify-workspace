# T-001 扩展 CreatifyHostController 添加模式管理和注册机制

## 需求描述

**Feature：扩展 hostController 能力**
- 为 CreatifyHostController 添加模式管理功能（PreviewOnly / Generator）
- 实现功能注册机制，允许 iframe 向主站注册导出和更新函数
- 保持向后兼容，不影响现有 Single 模式功能

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 添加 `getMode()` 方法：返回当前模式类型（默认 Generator）
- 添加 `registerExportFn()` 方法：允许 iframe 注册 HTML 导出函数
- 添加 `registerUpdateFn()` 方法：允许 iframe 注册数据更新函数
- 更新 TypeScript 接口定义
- 保持现有方法不变，确保向后兼容

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式和接口设计

**前端Code Point:**
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - Controller 实现

**其他:**
- Comlink 文档：https://github.com/GoogleChromeLabs/comlink

## 注意点

- 模式类型为 'PreviewOnly' | 'Generator'，默认为 'Generator'
- 注册的函数需要存储在 Controller 实例中，供后续调用
- 需要考虑多个 iframe 实例的场景，每个实例独立注册
- 函数注册使用 Map 存储，key 为 iframe 标识
- 确保 Comlink 类型定义正确

## Scenario

### Scenario 1: iframe 获取当前模式

    **场景描述：**
    - **前置条件**：iframe 已与主站建立连接
    - **操作步骤**：
      1. iframe 调用 hostController.getMode()
      2. Controller 返回当前模式类型
    - **预期结果**：
      - 默认返回 'Generator'
      - 如果主站设置了 PreviewOnly 模式，则返回 'PreviewOnly'

### Scenario 2: iframe 注册导出函数

    **场景描述：**
    - **前置条件**：iframe 已加载完成
    - **操作步骤**：
      1. iframe 调用 hostController.registerExportFn(exportCallback)
      2. Controller 存储该函数引用
      3. 主站需要时调用该函数获取 HTML 内容
    - **预期结果**：
      - 函数成功注册并存储
      - 主站可以调用该函数获取 File 或 Blob

### Scenario 3: iframe 注册更新函数

    **场景描述：**
    - **前置条件**：iframe 已加载完成
    - **操作步骤**：
      1. iframe 调用 hostController.registerUpdateFn(updateCallback)
      2. Controller 存储该函数引用
      3. 主站调用该函数传递生成数据
      4. iframe 接收数据并更新视图
    - **预期结果**：
      - 函数成功注册
      - 主站传递数据后 iframe 正确更新

## Checklist

- [ ] C-001 ICreatifyHostController 接口添加新方法定义
- [ ] C-002 CreatifyHostController 实现 getMode() 方法
- [ ] C-003 CreatifyHostController 实现 registerExportFn() 方法
- [ ] C-004 CreatifyHostController 实现 registerUpdateFn() 方法
- [ ] C-005 添加函数存储的 Map 结构
- [ ] C-006 TypeScript 类型定义正确
- [ ] C-007 保持向后兼容，现有功能不受影响
- [ ] C-008 添加相关注释说明用法

---

# T-002 创建入口页面路由和卡片选择功能

## 需求描述

**Feature：模式选择入口页面**
- 创建入口页面路由 `/tool/cta-generator/test`
- 实现两个卡片：Single 模式和 Batch 模式
- 点击卡片跳转到对应页面
- 简化交互，不需要 hover 展示按钮

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 使用 TanStack Router 创建路由
- 参考 `choose-launch-new.tsx` 的卡片样式
- 页面居中显示两个卡片
- Single 模式卡片 → 跳转到 `/tool/cta-generator/generator`
- Batch 模式卡片 → 跳转到 `/tool/cta-generator/batch`

## 相关指引

**前端规则:**
- `.project-rules/frontend/directory-structure.md` - 了解目录组织规范
- `.project-rules/frontend/architecture.md` - 了解页面组件结构

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/test.tsx` - 路由文件（待创建）
- `webserver/frontend/feature/tool.cta-generator/page/entry.tsx` - 页面组件（待创建）
- `webserver/frontend/feature/tool.ad-delivery/page/choose-launch-new.tsx` - 样式参考

**前端路由:**
- `/tool/cta-generator/test` - 入口页路由
- `/tool/cta-generator/generator` - Single 模式路由
- `/tool/cta-generator/batch` - Batch 列表页路由

**其他:**
- TanStack Router 文档

## 注意点

- 卡片需要响应式设计，适配不同屏幕尺寸
- 保持与现有页面风格一致
- 使用项目中的 UI 组件库
- 图标使用现有的 icon 组件

## Scenario

### Scenario 1: 用户访问入口页面

    **场景描述：**
    - **前置条件**：用户已登录
    - **操作步骤**：
      1. 用户访问 `/tool/cta-generator/test`
      2. 页面显示两个卡片
    - **预期结果**：
      - 页面正确加载
      - 显示 Single 模式和 Batch 模式两个卡片
      - 卡片样式美观，居中显示

### Scenario 2: 用户选择 Single 模式

    **场景描述：**
    - **前置条件**：用户在入口页面
    - **操作步骤**：
      1. 用户点击 Single 模式卡片
      2. 系统导航到 Single 模式页面
    - **预期结果**：
      - 跳转到 `/tool/cta-generator/generator`
      - URL 正确更新
      - 浏览器历史记录正确

### Scenario 3: 用户选择 Batch 模式

    **场景描述：**
    - **前置条件**：用户在入口页面
    - **操作步骤**：
      1. 用户点击 Batch 模式卡片
      2. 系统导航到 Batch 列表页面
    - **预期结果**：
      - 跳转到 `/tool/cta-generator/batch`
      - URL 正确更新
      - 浏览器历史记录正确

## Checklist

- [ ] C-001 路由文件创建完成
- [ ] C-002 页面组件创建完成
- [ ] C-003 Single 模式卡片正确显示和跳转
- [ ] C-004 Batch 模式卡片正确显示和跳转
- [ ] C-005 卡片样式与参考页面一致
- [ ] C-006 页面响应式设计正确
- [ ] C-007 浏览器前进后退功能正常

---

# T-003 创建 Batch 列表页面路由和基础布局 (deps: T-002)

## 需求描述

**Feature：Batch 任务列表页面**
- 创建 Batch 列表页面路由和基础布局
- 实现页面标题和 New 按钮
- 使用静态 mock 数据展示列表
- 实现列表项的基本结构

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 创建路由 `/tool/cta-generator/batch`
- 页面标题：**Bulk Generation**
- 右上角 **New** 按钮，点击跳转到新建页面
- 使用静态 mock 数据
- 列表项包含左侧信息区和右侧预览区

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式
- `.project-rules/frontend/directory-structure.md` - 了解目录组织

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/batch.tsx` - 路由文件
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - ViewController
- `webserver/frontend/feature/tool.cta-generator/page/batch-list.tsx` - 页面组件
- `webserver/frontend/feature/tool.creative-insight/page/competitor-tracker/index.tsx` - 样式参考（仅参考布局）

**前端路由:**
- `/tool/cta-generator/batch` - Batch 列表页路由
- `/tool/cta-generator/new-batch` - 新建 Batch 页路由

**其他:**
- `.doc/images/list-item.png` - 列表项设计参考

## 注意点

- 列表数据使用静态 mock，暂时不需要考虑数据持久化
- 页面布局需要响应式设计
- 列表项的右侧预览区先占位，后续任务实现
- 使用 HorizontalScrollArea 组件（参考 ad-delivery 页面）

## Scenario

### Scenario 1: 用户访问 Batch 列表页面

    **场景描述：**
    - **前置条件**：用户从入口页面选择 Batch 模式
    - **操作步骤**：
      1. 页面加载，显示列表布局
      2. 显示 mock 数据（2-3 个列表项）
    - **预期结果**：
      - 页面正确显示标题和 New 按钮
      - 列表项正确展示
      - 布局与设计稿一致

### Scenario 2: 用户点击 New 按钮

    **场景描述：**
    - **前置条件**：用户在 Batch 列表页面
    - **操作步骤**：
      1. 用户点击右上角 New 按钮
      2. 系统导航到新建 Batch 页面
    - **预期结果**：
      - 跳转到 `/tool/cta-generator/new-batch`
      - URL 正确更新

## Checklist

- [ ] C-001 路由文件创建完成
- [ ] C-002 BatchListViewController 创建完成
- [ ] C-003 页面基础布局实现（标题 + New 按钮）
- [ ] C-004 静态 mock 数据创建
- [ ] C-005 列表项基础结构实现
- [ ] C-006 New 按钮跳转功能实现
- [ ] C-007 页面样式与设计稿一致

---

# T-004 实现 Batch 列表项组件 (deps: T-003)

## 需求描述

**Feature：列表项组件**
- 实现完整的列表项组件结构
- 左侧区域：图标、标题、描述、操作按钮
- 右侧区域：预览列表（使用 HorizontalScrollArea）
- 支持查看全部和下载功能

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 左侧上下布局：
  - 上方：icon + title + description
  - 下方：[View all] 和 [Download] 按钮
- 右侧：HorizontalScrollArea 包裹的预览项
- 预览项为 PreviewOnly 模式的 iframe
- View all 按钮跳转到预览页面
- Download 按钮调用 iframe 导出函数并打包成 zip

## 相关指引

**前端规则:**
- `.project-rules/frontend/directory-structure.md` - 了解 component vs block 区别
- `.project-rules/frontend/architecture.md` - 了解组件规范

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/component/batch-list-item.tsx` - 列表项组件
- `webserver/frontend/feature/tool.cta-generator/component/preview-iframe-item.tsx` - 预览项组件
- `webserver/frontend/feature/editor-v2/component/horizontal-scroll-area.tsx` - 滚动组件

**其他:**
- `.doc/images/list-item.png` - 设计参考
- JSZip 库（用于打包下载）

## 注意点

- 列表项是 block 组件，可以访问 Context
- 预览项组件需要封装，支持复用
- iframe 需要设置为 PreviewOnly 模式
- 下载功能需要等待所有 iframe 导出完成
- 考虑加载状态和错误处理

## Scenario

### Scenario 1: 列表项显示

    **场景描述：**
    - **前置条件**：列表页面已加载
    - **操作步骤**：
      1. 渲染列表项
      2. 显示左侧信息和右侧预览
    - **预期结果**：
      - 列表项正确显示所有元素
      - 预览项正确加载（显示 loading）

### Scenario 2: 用户点击 View all

    **场景描述：**
    - **前置条件**：用户在列表页面
    - **操作步骤**：
      1. 用户点击某个列表项的 View all 按钮
      2. 系统导航到预览页面
    - **预期结果**：
      - 跳转到 `/tool/cta-generator/batch-preview`
      - URL 包含必要的参数（如 batchId）

### Scenario 3: 用户点击 Download

    **场景描述：**
    - **前置条件**：用户在列表页面，预览项已加载完成
    - **操作步骤**：
      1. 用户点击 Download 按钮
      2. 系统调用每个 iframe 的导出函数
      3. 将所有 HTML 打包成 zip 下载
    - **预期结果**：
      - 显示下载进度
      - 成功下载包含所有 HTML 的 zip 文件
      - 文件命名合理

## Checklist

- [ ] C-001 BatchListItem 组件创建完成
- [ ] C-002 PreviewIframeItem 组件创建完成
- [ ] C-003 左侧信息区域正确显示
- [ ] C-004 右侧预览区域正确显示
- [ ] C-005 View all 按钮跳转功能实现
- [ ] C-006 Download 按钮功能实现
- [ ] C-007 iframe PreviewOnly 模式设置正确
- [ ] C-008 HorizontalScrollArea 正确集成
- [ ] C-009 加载状态和错误处理

---

# T-005 创建新建 Batch 页面 (deps: T-003)

## 需求描述

**Feature：创建批量任务页面**
- 创建新建 Batch 页面路由和表单
- 支持动态添加/删除 URL 输入行
- 每行包含 URL 输入框、Size 输入框、删除按钮
- 最多支持 5 个输入框
- Generate 按钮点击后跳转到预览页面

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 创建路由 `/tool/cta-generator/new-batch`
- 页面居中布局
- URL 输入框：每行一个
- Size 输入框：表示生成几个 HTML（紧邻 URL 右侧）
- 删除按钮：紧邻 Size 右侧
- Add URL 按钮：位于输入框下方
- Generate 按钮：执行生成任务后跳转

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解表单处理规范
- `.project-rules/frontend/directory-structure.md` - 了解目录组织

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/new-batch.tsx` - 路由文件
- `webserver/frontend/feature/tool.cta-generator/manager/new-batch-view-controller.ts` - ViewController
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 页面组件

**前端路由:**
- `/tool/cta-generator/new-batch` - 新建 Batch 页路由
- `/tool/cta-generator/batch-preview` - 预览页路由

**其他:**
- `.doc/images/new-batch.png` - 设计参考

## 注意点

- 表单状态管理使用 Manager 模式
- 输入框验证：URL 格式、Size 范围（1-10）
- 最多 5 行，达到上限时禁用 Add URL 按钮
- 至少保留一行，删除到一行时禁用删除按钮
- Generate 按钮需要验证所有输入框
- 生成过程需要显示加载状态

## Scenario

### Scenario 1: 用户访问新建页面

    **场景描述：**
    - **前置条件**：用户从列表页面点击 New 按钮
    - **操作步骤**：
      1. 页面加载，显示一个默认输入行
    - **预期结果**：
      - 页面正确显示表单
      - 默认显示一个空的输入行
      - Add URL 和 Generate 按钮可用

### Scenario 2: 用户添加输入行

    **场景描述：**
    - **前置条件**：用户在新建页面
    - **操作步骤**：
      1. 用户点击 Add URL 按钮
      2. 页面新增一个输入行
    - **预期结果**：
      - 成功添加新行
      - 新行可以正常输入
      - 达到 5 行时禁用 Add URL 按钮

### Scenario 3: 用户删除输入行

    **场景描述：**
    - **前置条件**：用户在新建页面，有多个输入行
    - **操作步骤**：
      1. 用户点击某行的删除按钮
      2. 该行被移除
    - **预期结果**：
      - 成功删除该行
      - 只剩一行时，删除按钮禁用

### Scenario 4: 用户点击 Generate

    **场景描述：**
    - **前置条件**：用户填写了至少一个 URL 和 Size
    - **操作步骤**：
      1. 用户点击 Generate 按钮
      2. 系统验证输入
      3. 显示加载状态
      4. 完成后跳转到预览页面
    - **预期结果**：
      - 输入验证正确
      - 显示生成进度
      - 跳转到预览页面，携带必要参数

## Checklist

- [ ] C-001 路由文件创建完成
- [ ] C-002 NewBatchViewController 创建完成
- [ ] C-003 页面表单布局实现
- [ ] C-004 动态添加输入行功能
- [ ] C-005 删除输入行功能
- [ ] C-006 输入验证（URL 格式、Size 范围）
- [ ] C-007 行数限制（最多 5 行、最少 1 行）
- [ ] C-008 Generate 按钮功能和跳转
- [ ] C-009 加载状态显示
- [ ] C-010 页面样式与设计稿一致

---

# T-006 创建 Batch 预览页面 (deps: T-004, T-005)

## 需求描述

**Feature：批量预览页面**
- 创建 Batch 预览页面路由
- 支持单个 URL 和多个 URL 的 batch HTML 预览
- 所有预览项为 PreviewOnly 模式
- 基于 iframe 封装预览组件
- 支持下载功能

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 创建路由 `/tool/cta-generator/batch-preview`
- 从 URL 参数获取预览数据
- 网格布局展示多个预览项
- 所有 iframe 设置为 PreviewOnly 模式
- 支持单个和多个 URL 的场景
- 提供批量下载功能

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式
- `.project-rules/frontend/directory-structure.md` - 了解目录组织

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/batch-preview.tsx` - 路由文件
- `webserver/frontend/feature/tool.cta-generator/manager/batch-preview-view-controller.ts` - ViewController
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 页面组件
- `webserver/frontend/feature/tool.cta-generator/component/preview-iframe-item.tsx` - 复用预览项组件

**前端路由:**
- `/tool/cta-generator/batch-preview` - 预览页路由

**其他:**
- `.doc/images/preview.png` - 设计参考

## 注意点

- URL 参数设计：传递 URL 列表和对应的 Size
- 预览项数量不限制，根据用户填写的 Size 决定
- 响应式网格布局，适配不同屏幕
- 需要管理多个 CreatifyHostController 实例
- 使用 Map 管理 Controller，key 为 url 或 index
- 下载功能需要收集所有 iframe 的导出结果

## Scenario

### Scenario 1: 用户从新建页面跳转到预览页面

    **场景描述：**
    - **前置条件**：用户在新建页面点击 Generate
    - **操作步骤**：
      1. 页面接收 URL 参数
      2. 解析参数，初始化预览数据
      3. 创建对应数量的预览项
    - **预期结果**：
      - 正确解析参数
      - 显示正确数量的预览项
      - 所有预览项为 PreviewOnly 模式

### Scenario 2: 用户从列表页面跳转到预览页面

    **场景描述：**
    - **前置条件**：用户在列表页面点击 View all
    - **操作步骤**：
      1. 页面接收 batchId 参数
      2. 从 mock 数据中获取对应的预览信息
      3. 显示所有预览项
    - **预期结果**：
      - 正确加载 mock 数据
      - 显示该批次的所有预览项

### Scenario 3: 用户点击批量下载

    **场景描述：**
    - **前置条件**：预览页面已加载，预览项已就绪
    - **操作步骤**：
      1. 用户点击下载按钮
      2. 系统调用所有 iframe 的导出函数
      3. 打包成 zip 下载
    - **预期结果**：
      - 显示下载进度
      - 成功下载包含所有 HTML 的 zip 文件

## Checklist

- [ ] C-001 路由文件创建完成
- [ ] C-002 BatchPreviewViewController 创建完成
- [ ] C-003 URL 参数解析正确
- [ ] C-004 预览项网格布局实现
- [ ] C-005 多个 CreatifyHostController 实例管理
- [ ] C-006 PreviewOnly 模式设置正确
- [ ] C-007 批量下载功能实现
- [ ] C-008 加载状态和错误处理
- [ ] C-009 页面响应式设计
- [ ] C-010 页面样式与设计稿一致

---

# T-007 实现 Single 生成页面路由 (deps: T-002)

## 需求描述

**Infrastructure：Single 模式路由**
- 创建 Single 生成页面路由
- 与现有 test.tsx 功能保持一致
- 使用现有的 iframe 集成方式

**需求类型**：Infrastructure

**涉及领域**：前端

**功能要求**：
- 创建路由 `/tool/cta-generator/generator`
- 复用现有 test.tsx 的功能
- 保持 Generator 模式（非 PreviewOnly）

## 相关指引

**前端规则:**
- `.project-rules/frontend/directory-structure.md` - 了解目录组织

**前端Code Point:**
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/generator.tsx` - 路由文件
- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` - 现有实现参考

**前端路由:**
- `/tool/cta-generator/generator` - Single 生成页路由

## 注意点

- 与现有功能保持完全一致
- 可以直接复用 test.tsx 的代码或创建新组件
- 确保为 Generator 模式

## Scenario

### Scenario 1: 用户选择 Single 模式

    **场景描述：**
    - **前置条件**：用户在入口页面
    - **操作步骤**：
      1. 用户点击 Single 模式卡片
      2. 跳转到生成页面
    - **预期结果**：
      - 正确跳转到 `/tool/cta-generator/generator`
      - 页面功能与现有 test.tsx 一致

## Checklist

- [ ] C-001 路由文件创建完成
- [ ] C-002 页面功能与现有 test.tsx 一致
- [ ] C-003 Generator 模式设置正确
- [ ] C-004 页面跳转功能正常

---

# T-008 实现 iframe 批量生成数据驱动功能 (deps: T-001, T-006)

## 需求描述

**Feature：批量生成数据传递**
- 实现从 Product/URL 生成背景图片和 prefill 信息
- 通过 hostController 传递数据给 iframe
- iframe 接收数据后更新视图
- 支持多个 iframe 并行处理

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 调用后端 API 获取生成数据
- 通过 hostController 的注册函数传递数据
- 每个 iframe 独立接收和处理数据
- 使用现有 API（generateCreativeSuggestionsV2）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - API 定义
- `webserver/frontend/feature/tool.cta-generator/type.ts` - 类型定义
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - Controller

**其他:**
- Comlink 文档

## 注意点

- 使用现有的 generateCreativeSuggestionsV2 API
- 数据传递通过 Comlink 的 proxy 机制
- 需要处理异步加载状态
- 错误处理：单个 iframe 失败不影响其他

## Scenario

### Scenario 1: 用户从 Product 生成

    **场景描述：**
    - **前置条件**：用户在新建页面填写了 Product URL
    - **操作步骤**：
      1. 系统调用 API 分析 Product
      2. 获取背景图片和 prefill 信息
      3. 通过 hostController 传递给对应 iframe
      4. iframe 更新视图
    - **预期结果**：
      - 数据正确获取
      - iframe 正确更新
      - 显示生成进度

### Scenario 2: 用户从普通 URL 生成

    **场景描述：**
    - **前置条件**：用户在新建页面填写了普通 URL
    - **操作步骤**：
      1. 系统调用 API 分析 URL
      2. 获取背景图片和 prefill 信息
      3. 通过 hostController 传递给对应 iframe
      4. iframe 更新视图
    - **预期结果**：
      - 数据正确获取
      - iframe 正确更新

### Scenario 3: 批量并行生成

    **场景描述：**
    - **前置条件**：用户填写了多个 URL
    - **操作步骤**：
      1. 系统并行处理所有 URL
      2. 每个 URL 生成指定数量的 HTML
      3. 所有 iframe 独立更新
    - **预期结果**：
      - 并行处理正确
      - 所有 iframe 都能收到正确数据
      - 显示总体进度

## Checklist

- [ ] C-001 从 Product 生成数据功能实现
- [ ] C-002 从 URL 生成数据功能实现
- [ ] C-003 数据传递给 iframe 功能实现
- [ ] C-004 并行处理多个 URL 功能实现
- [ ] C-005 加载状态显示
- [ ] C-006 错误处理和重试机制
- [ ] C-007 进度反馈

---

# T-009 实现批量下载功能 (deps: T-001, T-004, T-006)

## 需求描述

**Feature：批量下载打包**
- 实现从多个 iframe 收集导出的 HTML
- 打包成 zip 文件下载
- 支持列表页和预览页的下载
- 处理下载过程中的错误和进度

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 调用 iframe 注册的导出函数
- 收集所有 File 或 Blob
- 使用 JSZip 打包成 zip
- 触发浏览器下载
- 显示下载进度

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/util/zip-downloader.ts` - 下载工具（待创建）

**其他:**
- JSZip 文档：https://stuk.github.io/jszip/

## 注意点

- 需要等待所有 iframe 导出完成
- 文件命名要有规律（如 preview-1.html, preview-2.html）
- 处理单个 iframe 失败的情况
- 显示下载进度
- 大文件需要考虑内存占用

## Scenario

### Scenario 1: 列表页下载

    **场景描述：**
    - **前置条件**：用户在列表页面
    - **操作步骤**：
      1. 用户点击某个列表项的 Download 按钮
      2. 系统调用该列表项所有 iframe 的导出函数
      3. 收集所有 HTML
      4. 打包下载
    - **预期结果**：
      - 显示下载进度
      - 成功下载 zip 文件
      - 文件命名合理

### Scenario 2: 预览页批量下载

    **场景描述：**
    - **前置条件**：用户在预览页面
    - **操作步骤**：
      1. 用户点击下载按钮
      2. 系统调用页面所有 iframe 的导出函数
      3. 收集所有 HTML
      4. 打包下载
    - **预期结果**：
      - 显示下载进度
      - 成功下载 zip 文件

### Scenario 3: 部分导出失败

    **场景描述：**
    - **前置条件**：某个 iframe 导出失败
    - **操作步骤**：
      1. 系统调用所有导出函数
      2. 部分成功，部分失败
    - **预期结果**：
      - 显示错误提示
      - 下载成功的部分
      - 记录失败信息

## Checklist

- [ ] C-001 iframe 导出函数调用实现
- [ ] C-002 HTML 内容收集实现
- [ ] C-003 JSZip 打包功能实现
- [ ] C-004 浏览器下载触发实现
- [ ] C-005 文件命名规则实现
- [ ] C-006 下载进度显示
- [ ] C-007 错误处理和降级
- [ ] C-008 内存优化（大文件）
