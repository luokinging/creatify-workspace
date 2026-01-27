# CTA Generator Batch Mode Support - Index

## Change ID

`cta-generator-batch-mode`

## 概述

为 CTA Generator 工具添加 Batch 模式支持，允许用户从多个 URL/Product 批量生成和预览 CTA HTML，同时保留现有的 Single 模式功能。

## 文档导航

### 核心文档

- **[spec.md](./spec.md)** - 需求概述和约束条件
- **[tasks.md](./tasks.md)** - 任务拆解（9个独立任务）
- **[design.md](./design.md)** - 技术设计和架构决策

### 设计资源

- **[images/list-item.png](./images/list-item.png)** - 列表项设计参考
- **[images/new-batch.png](./images/new-batch.png)** - 新建 Batch 页面设计参考
- **[images/preview.png](./images/preview.png)** - 预览页面设计参考

## 任务概览

| 任务编号 | 任务名称 | 依赖 | 状态 |
|---------|---------|------|------|
| T-001 | 扩展 CreatifyHostController 添加模式管理和注册机制 | 无 | 待开始 |
| T-002 | 创建入口页面路由和卡片选择功能 | 无 | 待开始 |
| T-003 | 创建 Batch 列表页面路由和基础布局 | T-002 | 待开始 |
| T-004 | 实现 Batch 列表项组件 | T-003 | 待开始 |
| T-005 | 创建新建 Batch 页面 | T-003 | 待开始 |
| T-006 | 创建 Batch 预览页面 | T-004, T-005 | 待开始 |
| T-007 | 实现 Single 生成页面路由 | T-002 | 待开始 |
| T-008 | 实现 iframe 批量生成数据驱动功能 | T-001, T-006 | 待开始 |
| T-009 | 实现批量下载功能 | T-001, T-004, T-006 | 待开始 |

## 路由结构

```
/tool/cta-generator/
├── / (index)          → 现有 Single 模式（保持不变）
├── /test              → 新入口页（模式选择）
├── /batch             → Batch 列表页
├── /new-batch         → 新建 Batch 页
├── /batch-preview     → Batch 预览页
├── /generator         → Single 生成页（与现有功能一致）
└── /legacy            → 现有页面（保持不变）
```

## 技术要点

- **架构模式**：MVC（Manager + ViewController）
- **通信方式**：Comlink
- **数据存储**：前端 Mock（临时方案）
- **组件库**：优先使用 `webserver/frontend/component/ui`
- **状态管理**：Zustand（Manager 内部使用）

## 依赖关系图

```
T-001 (Controller扩展)
    ├─> T-008 (批量生成数据)
    ├─> T-009 (批量下载)
    └─> T-006 (预览页面)
          └─> T-004 (列表项组件)
                └─> T-003 (列表页面)

T-002 (入口页面)
    ├─> T-003 (列表页面)
    └─> T-007 (Single生成页)
```

## 关键约束

1. 不修改 iframe HTML 文件
2. 不新增后端 API endpoint
3. 列表数据使用完全静态 mock
4. 保持现有 Single 模式功能不变
5. 使用 MVC 模式组织代码

## 下一步

等待用户审批后，按照 `tasks.md` 中的任务顺序开始实施。
