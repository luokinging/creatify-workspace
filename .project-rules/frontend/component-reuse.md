---
description: 组件复用规范 - 复用现有业务组件的基本原则和决策流程
---

# 组件复用规范

## 组件分类

### 通用组件
- **位置**：`component/ui/` 或 `feature/xxx/component/`
- **特点**：纯 UI 组件，无副作用，可跨模块复用
- **通用范围**：`component/ui/` 为全局通用，`feature/xxx/component/` 为模块内通用

### 业务组件
- **位置**：`block/` 或 `page/` 目录下
- **特点**：包含业务逻辑，可能耦合状态管理、API 调用等

## 复用决策流程

### 1. 通用组件
**直接复用** - 通用组件可直接使用，无需额外处理

### 2. 业务组件
需要检查组件内部耦合情况，按以下步骤判断：

#### 步骤 1：检查耦合类型

**全局耦合**（可直接复用）
- 依赖可在整个 app 或整个模块生命周期内获取的资源
- **判断标准**：
  - 使用 `useService`（Service 在全局定义，整个 app 都可获取）
  - 使用模块级 Controller（如 `useMushroomController`，在整个模块启动到消失期间一直存在）
- **本质**：组件移动到其他地方时，依赖仍然可用，不影响复用性

**局部耦合**（需要抽取后复用）
- 依赖只在特定组件树/页面下存在的资源
- **判断标准**：
  - 使用页面级 Provider 的 context（如 `preview` 页面定义的 `AProvider`）
  - 使用只在特定组件树下可用的 hook（如 `useAxxx`）
- **本质**：组件移动到其他地方时，依赖不可用，会导致问题

#### 步骤 2：处理方案

- **全局耦合**：直接复用
- **局部耦合**：先解除局部耦合（将耦合部分抽离出去，通过 props 传入等方式），然后再在多个地方复用

## 复杂组件的处理

### 判断标准
组件逻辑复杂需满足以下任一条件：
- `useEffect` 超过 2 个
- 组件内发送请求并管理各种功能状态
- 各种状态管理超过 4 个

### 处理方式
使用 ViewController 管理复杂逻辑，但**不能直接暴露 ViewController**，应使用：
- `forwardRef` + `useImperativeHandle` + Manager Interface
- **参考实现**：`FlexibleDropdown`（`webserver/frontend/component/ui/dropdown/flexible-dropdown/`）