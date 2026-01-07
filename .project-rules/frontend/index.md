---
description: AI Agent 规则文档索引 - 列出必须阅读的文档和可选文档
---

# AI Agent 规则文档索引

本目录包含了项目中 AI Agent 必须遵守的编程规范、架构指南和工作流程。**所有参与开发的 AI Agent 必须仔细阅读并严格遵守这些规则。**

## ⚠️ 重要：规则文件优先级

**必须忽略各自项目中的规则文件（如 `webserver/frontend/.cursor/rules/` 等），以 `.project-rules` 目录下的规则文件为准。**

- `.project-rules/` 目录下的规则文件是**唯一权威**的规则来源
- 项目子目录中的规则文件（如 `.cursor/rules/`）应被忽略
- 如果发现规则冲突，始终以 `.project-rules/` 下的规则为准

---

## 必须阅读的文档（Required）

以下文档是**所有 AI Agent 必须阅读**的核心文档，无论执行什么任务都需要理解：

### 1. [架构设计指南](./architecture.md)

**使用场景：** 涉及创建 Manager、ViewController、Service 或理解业务逻辑与 UI 分离的架构设计

---

## 可选文档（Optional）

除了上述必须阅读的文档外，`.project-rules/frontend` 目录下还有其他文档。**AI Agent 需要自行判断是否需要阅读这些文档。**

### 可选文档列表

以下是一些常见的可选文档：

- **[目录结构规范](./directory-structure.md)** - 创建或修改 Feature 目录结构，需要了解 api、manager、component、block、page 等目录的职责

- **[反模式](./anti-patterns.md)** - Code Review、避免常见错误，需要了解不应该做什么

- **[组件使用规范](./component-usage.md)** - 优先使用项目内部组件库（`webserver/frontend/component/ui`），其次使用 shadcn 提供的组件

- **[编码规范](./coding-conventions.md)** - 组件 Props 解构、函数签名等代码风格约定

- **[请求相关注意事项](./request-notes.md)** - 使用 `createAutoKeyMiniClient`、`PaginatedQueryManager`、`useAutoKeyQuery` 等 API 时的注意事项和常见陷阱

- **[实战案例与设计模式](./examples.md)** - 增加 feature 和大 feature 更新时，需要参考真实案例和设计模式

- **工作流程文档** - 执行不同类型开发任务时的标准流程：
  - **[工作流程通用原则](./workflow-principles.md)** - 代码分析、工具验证、增量修改、ESM 模块化等通用执行原则
  - **[工作流程指南](./workflow-guide.md)** - 工作流程分类、决策树和常见问题处理
  - **[Bugfix 工作流程](./workflow-bugfix.md)** - 修复现有功能缺陷的标准流程
  - **[Small Change 工作流程](./workflow-small-change.md)** - 小型功能调整或优化的标准流程
  - **[Feature Update 工作流程](./workflow-feature-update.md)** - 现有功能增强或扩展的标准流程
  - **[Complete Feature 工作流程](./workflow-complete-feature.md)** - 全新功能模块开发的标准流程，包含 Spec 编写和分阶段实现
  - **[Refactor 工作流程](./workflow-refactor.md)** - 代码重构和优化的标准流程

### 如何判断是否需要阅读可选文档？

1. **阅读文档头部信息：**

   - 每个文档的前 4 行包含 `description` 字段
   - 阅读 `description` 了解文档的核心内容和适用场景

2. **根据任务需求判断：**

   - 如果文档的 `description` 描述的内容与当前任务相关，则需要阅读
   - 例如：如果任务涉及重构，且某个文档的 `description` 提到"重构"，则需要阅读

3. **主动探索：**
   - 浏览 `.project-rules/frontend` 目录下的所有文件
   - 读取每个文件的前 4 行，查看 `description`
   - 根据 `description` 判断是否需要完整阅读该文档

**重要：** 不要只依赖文件名判断，必须阅读头部信息中的 `description` 字段来做出判断。

---

## 使用指南

### 对于 AI Agent

1. **开始任务前：**

   - 必须阅读所有"必须阅读的文档"（共 1 个）
   - 根据任务类型选择对应的工作流程（Workflow），参考可选文档中的工作流程文档
   - 浏览 `.project-rules/frontend` 目录下的其他文件，阅读每个文件的前 4 行（头部信息）
   - 根据头部信息中的 `description` 判断是否需要阅读可选文档

2. **判断是否需要阅读可选文档：**

   - 读取文档头部信息（前 4 行）中的 `description` 字段
   - 根据 `description` 描述的内容判断是否与当前任务相关
   - 如果相关，则完整阅读该文档

3. **执行任务时：**
   - 遵循对应的工作流程
   - 参考架构设计指南
   - 根据任务需要参考可选文档（如目录结构规范、反模式等）
   - 代码格式化统一进入前端目录使用 bun biome:fix
   - 代码修改完成需要执行bun precommit进行typescript检查
---
