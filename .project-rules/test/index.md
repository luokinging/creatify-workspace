---
description: AI Agent 规则文档索引 - 列出必须阅读的文档和可选文档
---

* 虚拟环境已经配置好，使用Anaconda的base环境
* 有专门的Playwrihgt测试项目，路径在 playwright-test
* 使用 Playwright、pytest、pytest-playwright
* 请使用 Page Object Model (POM) 设计模式
* 优先使用React选择器进行元素选择
* 源代码侵入原则：
    * 对于难以精确选择的，你可以在外层包裹父容器，增加data-testid进行链式定位
    * 对于vc/managet等逻辑块，你可以挂载到window，比如 (window as any).xx = xx，观察内部状态等
    * 必须在不影响功能的情况下，在源代码测试注入信息，但是注意非必要不要这么做
    * 测试完成必须帮我清除测试信息
* 测试代码应该简洁、健壮且正确
* 从前端作为测试入口

## 功能测试需要注意的地方
* 接口是否成功发出且正确响应
* 对于和接口相关的功能，如果有不同case的处理，你可能需要编写mock请求
