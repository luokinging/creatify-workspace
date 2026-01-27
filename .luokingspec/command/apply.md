# 执行开发需求

## 前提条件

- 读取 `.luokingspec/changes` 目录下的直接子目录，每一个子目录都是一个change，目录名为 change-id
- 用户必须指定 change-id，用户可选指定 Task 序号
- 如果用户没有指定 change-id，需要列出所有change，提醒用户选择，在确定change-id之前不能继续
- 用户可以在指定 change-id 的同时指定需要完成的Task编号（如 `T-001`、`T-001, T-002`），如果不指定则是全部任务

## 执行流程

### 第一步：读取并解析需求

1. **读取任务文件**
   - 读取 `.luokingspec/changes/<change-id>` 下的 `task.md` 和 `design.md` （如果存在）
   - 如果文件不存在，提示用户先使用 `apply` 命令创建需求文档

2. **解析用户指定的需求**
   - 识别用户输入的需求编号（T-XXX）
   - 支持单个需求（如 `T-001`）或多个需求（如 `T-001, T-002` 或 `T-001 T-002`）
   - 在文档中查找对应的需求部分

3. **提取需求信息**
   - 识别依赖关系，不同的需求之间如果存在依赖关系，需要保证执行顺序不违背依赖关系
   - 读取具体需求提到的所有指引文件（前端规则、后端规则、Code Point、路由等）和注意点

### 第二步：执行开发任务

1. **阅读相关指引**
   - 读取需求提到的相关指引文档、图片、PR（如果给的是链接，请使用gh cli）等
   - 理解相关代码模块和架构
   - 如果需要额外的约定或说明，请参考 `.luokingspec/project.md`（位于 `.luokingspec/` 目录内——如果看不到，请运行 `ls .luokingspec`）。

2. **按照工作流程执行**
   - 根据需求类型选择对应的工作流程：
     - Bugfix → `.project-rules/frontend/workflow-bugfix.md`
     - Small Change → `.project-rules/frontend/workflow-small-change.md`
     - Feature Update → `.project-rules/frontend/workflow-feature-update.md`
     - Complete Feature → `.project-rules/frontend/workflow-complete-feature.md`
     - Refactor → `.project-rules/frontend/workflow-refactor.md`

3. **实现功能**
   - 按照需求描述和 Checklist 逐项实现
   - 遵循项目架构和代码规范

### 第三步：检查任务完成情况

1. **检查 Scenarios**

- 从代码层面检查Task的全部 `Scenario` 是否没问题

2. **完成 Checklist 项**
   - 每完成一个 Checklist 项，在 `.luokingspec/changes/<change-id>/task.md` 中更新状态：`- [x]`
   - 保持未完成项为：`- [ ]`

3. **确认完成**
   - 所有 Checklist 项完成后，标记需求已完成
