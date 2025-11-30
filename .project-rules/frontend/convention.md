---
description: AI 编程规范快速指引 - 开发流程指引和绝对禁止事项
---

# AI 编程规范快速指引

本目录包含了本项目中 AI Agent 必须遵守的编程规范和最佳实践。**所有参与开发的 AI Agent 必须仔细阅读并严格遵守这些规则。**

## 📚 规则手册

### 1. [架构设计与模式 (Architecture)](./architecture.md)

**必读核心文档。** 阐述了本项目的核心架构思想——**Manager 模式**。

- **核心理念：** 业务逻辑与 UI 彻底分离。
- **关键原则：** UI 组件应当是"哑"的，只负责展示；复杂的业务逻辑、状态管理、数据获取必须下沉到 Manager 层。
- **依赖管理：** 明确模块间的依赖关系，避免循环依赖和紧耦合。

### 2. [设计模式与实战 (Examples & Patterns)](./examples.md)

如何识别边界、选择合适的设计模式以及组织模块。

- **核心内容：** 什么时候该拆分模块？什么时候用 Manager？如何处理复杂的跨模块交互？
- **实战指导：** 通过具体场景（如"复杂仪表盘"）演示如何进行职责划分。

### 3. [开发工作流程 (Workflow)](./workflow.md)

**不同类型任务的标准开发流程。**

- **Bugfix 流程：** 快速定位、最小改动、充分验证
- **Small Change 流程：** 理解架构、遵循模式、保持一致性
- **Feature Update 流程：** 先设计后实现、分阶段迭代
- **Complete Feature 流程：** 规划先行、架构优先、质量保障

### 4. [重构指南 (Refactoring)](./refactoring.md)

如何处理"脏乱差"的代码和遗留系统。

- **核心策略：** "切分与隔离" (Slice and Dice)。
- **红线：** 单文件组件超过 300 行、Manager/Controller 等逻辑块超过 500 行，必须引起警惕；禁止在 UI 组件中堆砌逻辑，Manager 等需要职责清晰。

### 5. [目录结构规范 (Directory Structure)](./directory-structure.md)

Feature 目录结构标准定义。

- **核心内容：** api、manager、component、block、page 等目录的职责和组织方式。

### 6. 包管理器与脚本 (Package Manager & Scripts)

**统一开发环境与命令执行标准。**

- **包管理器：** 必须使用 `bun`。禁止使用 `npm`, `yarn`, `pnpm`。
- **脚本执行：** 优先使用 `package.json` 中定义的脚本。
  - 例如：运行 `bun run lint` 而不是直接运行 `eslint`。
  - 例如：运行 `bun run type-check` 而不是直接运行 `tsc`。

### 7. UI 组件使用规范 (UI Component Usage)

**优先复用，避免重复造轮子。**

- **优先使用公共组件：** 在创建新 UI 组件之前，必须先检查 `main-web-ui/component/ui` 目录。
- **禁止重复定义：** 如果公共库中已存在类似组件（如 Button, Input, Modal, Card 等），必须直接使用，禁止在 Feature 内部重新实现。
- **统一风格：** 使用公共组件可以确保应用风格的一致性。

## 🚀 AI 开发快速指引

1.  **先看目录：** 拿到需求，先看现有的 `api`, `manager`, `block` 是否有可复用的。
2.  **选择工作流程：** 根据任务类型（Bugfix/Small Change/Feature Update/Complete Feature）选择对应的工作流程（详见 [workflow.md](./workflow.md)）。
3.  **分层思考：**
    - 数据怎么拿？ -> `api/`
    - 状态怎么管？ -> `manager/`
    - UI 怎么画？ -> `component/` (纯 UI) 或 `block/` (带业务)
    - 页面怎么组？ -> `page/`
4.  **严守边界：** 不要把 API 定义写在 Manager 里，不要把业务逻辑写在 Component 里。

## 🚫 绝对禁止 (Absolute No-Go's)

- ❌ **禁止** 在 `component/` 中直接使用 Manager 或 API。
- ❌ **禁止** `api/` 目录中只有一个巨大的 `index.ts`，请按领域拆分。
- ❌ **禁止** 页面组件 (`page/`) 包含几千行代码，请拆分成 Section。
- ❌ **禁止** 在组件中直接 `fetch` 数据，必须通过 Manager。
- ❌ **禁止** 在 Bugfix 中进行大规模重构。
