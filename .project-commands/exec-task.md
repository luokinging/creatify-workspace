# Exec Task Command - 执行开发需求

## 命令用途

`exec-task` 命令用于读取 `.doc/dev.md` 中的结构化需求文档，并根据用户指定的需求编号（T-XXX）执行开发任务。

## 使用场景

- 用户指定要执行的需求编号（如 `T-001`、`T-001, T-002`）
- AI 需要按照需求文档中的指引完成开发工作
- 完成后更新 Checklist 状态

## 执行流程

### 第一步：读取并解析需求

1. **读取 `.doc/dev.md` 文件**
   - 如果文件不存在，提示用户先使用 `task` 命令创建需求文档

2. **解析用户指定的需求**
   - 识别用户输入的需求编号（T-XXX）
   - 支持单个需求（如 `T-001`）或多个需求（如 `T-001, T-002` 或 `T-001 T-002`）
   - 在文档中查找对应的需求部分

3. **提取需求信息**
   - 需求描述
   - 相关指引（前端规则、后端规则、Code Point、路由等）
   - 注意点
   - Checklist

### 第二步：执行开发任务

1. **阅读相关指引**
   - 根据需求类型（前端/后端/全栈），阅读对应的规则文档
   - 参考 `.project-rules/frontend/index.md` 或 `.project-rules/backend/index.md` 确定需要阅读的文档
   - 理解相关代码模块和架构

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
   - 注意文档中提到的注意点

### 第三步：更新 Checklist

1. **完成 Checklist 项**
   - 每完成一个 Checklist 项，在 `.doc/dev.md` 中更新状态：`- [x]`
   - 保持未完成项为：`- [ ]`

2. **确认完成**
   - 所有 Checklist 项完成后，标记需求已完成

## 注意事项

1. **需求编号格式**：支持 `T-001`、`T-001, T-002`、`T-001 T-002` 等格式
2. **顺序执行**：如果指定多个需求，按编号顺序执行
3. **依赖检查**：虽然需求之间应该独立，但执行时仍需注意可能的代码冲突
4. **更新文档**：完成 Checklist 项后及时更新 `.doc/dev.md`

## 执行检查清单

- [ ] 读取 `.doc/dev.md` 文件
- [ ] 解析用户指定的需求编号（T-XXX）
- [ ] 找到对应的需求部分
- [ ] 阅读相关指引文档
- [ ] 按照对应的工作流程执行开发任务
- [ ] 完成 Checklist 中的各项任务
- [ ] 更新 `.doc/dev.md` 中的 Checklist 状态
- [ ] 确认所有 Checklist 项已完成

