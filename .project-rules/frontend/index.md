---
description: AI Agent 规则文档索引 - 列出必须阅读的文档和可选文档
---

# AI Agent 规则文档索引

本目录包含了项目中 AI Agent 必须遵守的编程规范、架构指南和工作流程。**所有参与开发的 AI Agent 必须仔细阅读并严格遵守这些规则。**

## 📖 必须阅读的文档（Required）

以下文档是**所有 AI Agent 必须阅读**的核心文档，无论执行什么任务都需要理解：

### 1. [架构设计指南 (Architecture)](./architecture.md) ⭐

**核心架构思想 - Manager 模式**

- **核心理念：** 业务逻辑与 UI 彻底分离
- **关键原则：** UI 组件应当是"哑"的，只负责展示；复杂的业务逻辑、状态管理、数据获取必须下沉到 Manager 层
- **依赖管理：** 明确模块间的依赖关系，避免循环依赖和紧耦合
- **适用场景：** 所有开发任务的基础

### 2. [MVC 架构模式 (MVC Architecture)](./mvc-architecture.mdc) ⭐

**ViewController 和 Manager 使用标准**

- **核心内容：** ViewController 和 Manager 的实现标准、生命周期管理、依赖注入
- **关键概念：** bootstrap/dispose、CombinedStore、依赖注入模式
- **适用场景：** 所有涉及 ViewController 或 Manager 的开发任务

### 3. [开发工作流程 (Workflow)](./workflow.md) ⭐

**不同类型任务的标准开发流程**

- **核心内容：** Bugfix、Small Change、Feature Update、Complete Feature、Refactor 的标准流程
- **关键原则：** Spec 优先（功能开发必须先完成 Spec 设计）、增量验证、最小改动
- **适用场景：** 所有开发任务都需要选择对应的工作流程

### 4. [编程规范快速指引 (Convention)](./convention.md) ⭐

**开发流程指引和绝对禁止事项**

- **核心内容：** AI 开发快速指引、绝对禁止事项
- **关键原则：** 分层思考、严守边界、禁止在组件中直接调用 API
- **适用场景：** 所有开发任务的快速参考

### 5. [目录结构规范 (Directory Structure)](./directory-structure.md) ⭐

**Feature 目录结构标准定义**

- **核心内容：** api、manager、component、block、page 等目录的职责和组织方式
- **关键原则：** 每个目录的职责清晰，禁止违反目录结构规范
- **适用场景：** 所有涉及创建或修改 Feature 目录结构的任务

### 6. [实战案例与设计模式 (Examples & Patterns)](./examples.md) ⭐

**设计模式深度解析和实战案例**

- **核心内容：** 策略模式、依赖注入、多平台仪表盘架构设计、真实案例剖析
- **关键原则：** 如何识别边界、选择合适的设计模式、组织模块
- **适用场景：** 所有开发任务，特别是复杂架构设计和多平台适配场景

### 7. [反模式 (Anti-Patterns)](./anti-patterns.md) ⭐

**前端开发避坑指南**

- **核心内容：** 避免滥用 Hooks (useMemo, useCallback, useEffect)，避免组件逻辑复杂化
- **关键原则：** 保持组件简单，逻辑下沉到 Manager，不要过早优化
- **适用场景：** 所有前端开发任务，Code Review 必读

---

## 📚 可选文档（Optional）

除了上述必须阅读的文档外，`.local/rules/` 目录下还有其他文档。**AI Agent 需要自行判断是否需要阅读这些文档。**

### 如何判断是否需要阅读可选文档？

1. **阅读文档头部信息：**

   - 每个文档的前 4 行（YAML front matter）包含 `description` 字段
   - 阅读 `description` 了解文档的核心内容和适用场景

2. **根据任务需求判断：**

   - 如果文档的 `description` 描述的内容与当前任务相关，则需要阅读
   - 例如：如果任务涉及重构，且某个文档的 `description` 提到"重构"，则需要阅读

3. **主动探索：**
   - 浏览 `.local/rules/` 目录下的所有文件
   - 读取每个文件的前 4 行，查看 `description`
   - 根据 `description` 判断是否需要完整阅读该文档

**重要：** 不要只依赖文件名判断，必须阅读头部信息中的 `description` 字段来做出判断。

---

## 🎯 使用指南

### 对于 AI Agent

1. **开始任务前：**

   - ✅ 必须阅读所有"必须阅读的文档"（共 6 个）
   - ✅ 根据任务类型选择对应的工作流程（Workflow）
   - ✅ 浏览 `.local/rules/` 目录下的其他文件，阅读每个文件的前 4 行（头部信息）
   - ✅ 根据头部信息中的 `description` 判断是否需要阅读可选文档

2. **判断是否需要阅读可选文档：**

   - 读取文档头部信息（前 4 行）中的 `description` 字段
   - 根据 `description` 描述的内容判断是否与当前任务相关
   - 如果相关，则完整阅读该文档

3. **执行任务时：**
   - 遵循对应的工作流程
   - 参考架构设计指南和 MVC 架构模式
   - 遵守目录结构规范
   - 注意绝对禁止事项

### 文档阅读顺序建议

**首次使用（必须阅读）：**

1. Architecture（架构设计指南）
2. MVC Architecture（MVC 架构模式）
3. Convention（编程规范快速指引）
4. Directory Structure（目录结构规范）
5. Workflow（开发工作流程）
6. Examples & Patterns（实战案例与设计模式）

**可选文档（根据任务需要自行判断）：**

- 浏览 `.local/rules/` 目录下的其他文件
- 读取每个文件的前 4 行，查看 `description`
- 根据 `description` 判断是否需要阅读

---

## 📋 快速查找表

| 任务类型         | 必须阅读                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Bugfix           | Architecture, MVC Architecture, Workflow, Convention, Examples & Patterns                      |
| Small Change     | Architecture, MVC Architecture, Workflow, Convention, Directory Structure, Examples & Patterns |
| Feature Update   | Architecture, MVC Architecture, Workflow, Convention, Directory Structure, Examples & Patterns |
| Complete Feature | Architecture, MVC Architecture, Workflow, Convention, Directory Structure, Examples & Patterns |
| Refactor         | Architecture, MVC Architecture, Workflow, Convention, Examples & Patterns                      |

**注意：** 除了必须阅读的文档外，还需要根据任务需求浏览可选文档。通过阅读文档头部信息（前 4 行）中的 `description` 字段来判断是否需要阅读。

---

## ⚠️ 重要提醒

1. **不要跳过必须阅读的文档**：这 6 个文档包含了项目的核心架构思想和规范，必须全部阅读
2. **主动探索可选文档**：浏览 `.local/rules/` 目录下的其他文件，通过阅读头部信息中的 `description` 判断是否需要阅读
3. **根据 description 判断**：不要只依赖文件名，必须阅读头部信息中的 `description` 字段来做出判断
4. **遵循工作流程**：不同类型的任务有不同的工作流程，必须严格遵循
5. **遵守绝对禁止事项**：Convention 中列出的禁止事项必须严格遵守
