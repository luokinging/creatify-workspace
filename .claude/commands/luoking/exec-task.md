---
description: 执行开发需求 - 读取 dev.md 并执行指定的需求任务
---

读取并遵循 `.project-commands/exec-task.md` 中的完整指令来执行任务。

## 用户输入

```text
$ARGUMENTS
```

根据用户指定的需求编号（如 `T-001` 或 `T-001, T-002`），按照 `.project-commands/exec-task.md` 中定义的流程执行：
1. 读取 `.doc/dev.md` 并解析指定的需求
2. 按照需求文档中的指引执行开发任务
3. 更新 Checklist 状态

