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

#### 步骤 3：抽取后组件的存放位置

抽取后的可复用组件，根据耦合情况决定存放位置：

- **存在全局耦合关系** → 放到 `block/` 目录
  - 组件依赖全局资源（如 `useService`、模块级 Controller）
  - 虽然可复用，但仍与全局资源耦合，属于业务组件范畴

- **完全纯组件** → 放到 `feature/xxx/component/` 目录（模块级别）
  - 组件无副作用，不依赖全局资源
  - 仅通过 props 接收数据和方法
  - 可在模块内多处复用

## 复杂组件的处理

### 判断标准
组件逻辑复杂需满足以下任一条件：
- `useEffect` 超过 2 个
- 组件内发送请求并管理各种功能状态
- 各种状态管理超过 4 个

### 组件改造策略

#### 场景 1：无复杂逻辑 → 纯 UI 组件改造
**适用情况**：组件逻辑简单，不需要外部控制内部状态或方法

**处理方式**：
- 直接改造成纯 UI 组件或简单组件
- 基于 props 做解耦，将依赖通过 props 传入
- 移除内部状态管理，改为受控组件模式

**存放位置**：
- 完全纯组件 → `feature/xxx/component/` 目录（模块级别）

**示例**：
```typescript
// 改造前：内部管理状态
const MyComponent = () => {
  const [value, setValue] = useState('');
  // ...
};

// 改造后：通过 props 解耦
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
}
const MyComponent = (props: MyComponentProps) => {
  // ...
};
```

#### 场景 2：有复杂逻辑 + 外部需要控制 → Manager Interface 模式
**适用情况**：组件存在复杂逻辑，且外部需要使用内部的逻辑（如调用内部方法、控制内部状态）

**处理方式**：
使用 `forwardRef` + `useImperativeHandle` + Manager Interface

**存放位置**：
- 存在全局耦合关系 → `block/` 目录
- 完全纯组件（通过接口解耦后） → `feature/xxx/component/` 目录（模块级别）

**核心原则**：
- **基于接口设计**：所有暴露的方法和属性都通过接口定义，避免直接耦合
- **双向解耦**：
  - 组件通过 ref 暴露 Manager Interface（如 `IXxx`）
  - 组件依赖的外部逻辑实例也通过接口类型传入（如 `xxx: IYyy`）

**使用示例**：

```typescript
// 1. 定义 Manager Interface
interface IMyComponentManager {
  open: () => void;
  close: () => void;
  reset: () => void;
}

// 2. 组件内部的 ViewController 实现 Manager Interface
class MyComponentViewController implements IMyComponentManager {
  open() { /* ... */ }
  close() { /* ... */ }
  reset() { /* ... */ }
}

// 3. 组件通过 forwardRef 暴露接口
const MyComponent = forwardRef<IMyComponentManager, MyComponentProps>(
  (props, ref) => {
    const { externalManager } = props;
    // 组件内部使用 ViewController 管理复杂逻辑
    const vc = useRef(new MyComponentViewController()).current;
    
    // useImperativeHandle 直接返回 ViewController 实例
    useImperativeHandle(ref, () => vc);

    // 使用外部传入的 Manager（也是接口类型）
    externalManager?.doSomething();
  }
);

// 3. 外部使用：通过 ref 获取 Manager
<MyComponent 
  ref={mng => vc.setXxxManager(mng)} 
  externalManager={vc.xxxManager}
/>

// 4. 外部 ViewController 中通过接口调用
class MyViewController {
  private xxxMng?: IMyComponentManager;
  
  setXxxManager(mng: IMyComponentManager | null) {
    this.xxxMng = mng || undefined;
  }
  
  someMethod() {
    // 通过接口调用，避免耦合
    this.xxxMng?.open();
  }
}
```

**关键点**：
- `ref` 的类型是 Manager Interface（如 `IMyComponentManager`），不是组件实例
- 外部传入的依赖也是接口类型（如 `externalManager: IExternalManager`）
- 所有交互都基于接口，实现真正的解耦

**参考实现**：`FlexibleDropdown`（`webserver/frontend/component/ui/dropdown/flexible-dropdown/`）