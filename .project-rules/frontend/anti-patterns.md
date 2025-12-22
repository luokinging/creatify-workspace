---
description: 前端开发反模式 - 避免滥用 Hooks 和复杂组件逻辑
---

# 前端开发反模式

为了保持代码的可维护性、性能和清晰度，以下是在前端开发中必须避免的反模式。

## 1. 滥用 React Hooks

### 滥用 `useMemo` 和 `useCallback`

**反模式**：默认将所有函数和对象都包裹在 `useCallback` 或 `useMemo` 中。
**原因**：

- 增加了代码复杂度。
- 增加了内存开销。
- 在大多数情况下，重新创建函数或对象的开销微乎其微，远小于 Hook 本身的开销。
  **正确做法**：放到view controller或者manager中做

> **硬性规定**:`useMemo`、`useCallback` 在组件中应**避免使用**。如果必须使用且代码块超过 **10 行**，必须将其提取到 **ViewController** 或 **Manager** 中。组件内不应包含复杂的内联逻辑。

### `useEffect` 的使用规范

**原则**：`useEffect` 不应过度使用，但以下场景是**允许的**：

1. **管理生命周期**：在 Page 组件中管理 ViewController 的 `bootstrap` 和 `dispose`
   ```typescript
   useEffect(() => {
     vc.bootstrap();
     return () => vc.dispose();
   }, [vc]);
   ```

2. **视图层操作**：处理视图相关的副作用，如滚动到底部触发加载更多
   ```typescript
   useEffect(() => {
     const handleScroll = () => {
       if (isScrollBottom()) {
         vc.loadMore();
       }
     };
     window.addEventListener('scroll', handleScroll);
     return () => window.removeEventListener('scroll', handleScroll);
   }, [vc]);
   ```

3. **同步外部系统**：订阅事件、手动 DOM 操作等

**反模式**：在 `useEffect` 中编写复杂的业务逻辑、数据转换或多个不相关的副作用。
**原因**：

- `useEffect` 难以测试和调试。
- 容易导致闭包陷阱和无限循环。
- 逻辑分散，难以追踪。
  **正确做法**：
- 将业务逻辑移至 **Manager**。
- 数据获取应由 Manager 处理，组件只负责订阅状态。
- **遵守 10 行限制**：如果副作用逻辑超过 10 行，请封装成 ViewController 或者 Manager 的方法。

## 2. 复杂的组件逻辑

### 组件内的"上帝逻辑"

**反模式**：组件内部包含大量 `useState`、数据处理、API 调用和条件判断。
**原因**：

- 违反了 UI 与逻辑分离的原则。
- 组件变得难以阅读和维护。
- 难以复用逻辑。
  **正确做法**：
- 遵循 **Manager 模式**，在manager提供store
- 组件应当是"哑"的（Dumb Component），只负责接收数据和渲染 UI。
- 所有的状态管理、API 交互和业务规则都应封装在 `*.manager.ts` 中。

### 在组件中直接调用 API

**反模式**：在事件处理函数中直接调用 `fetch` 或 API 服务。

```typescript
// 错误示范
const handleClick = async () => {
  const res = await api.post('/data', { ... });
  setData(res.data);
};
```

**正确做法**：

- 委托给 Manager 处理。

```typescript
// 正确示范
const handleClick = () => {
  manager.submitData();
};
```

## 3. 状态管理反模式

### 在 Store 中定义 Actions

**反模式**：在 `createStore` 或 `combine` 中定义修改状态的方法（Actions）。

```typescript
// 错误示范
private readonly store = createStore(
  combine(initialState, (set) => ({
    updateName: (name: string) => set({ name }), // 禁止这样做
  }))
);
```

**原因**：

- 混合了状态定义和业务逻辑。
- 难以在类方法中复用逻辑。
- 违背了 Manager/ViewController 作为逻辑中心的原则。

**正确做法**：

- Store 只定义状态。
- 使用 `setState` 方法更新状态。
- 业务逻辑定义为类的成员方法。

```typescript
// 正确示范
class MyManager {
  private readonly store = createStore(
    immer(combine(initialState, () => ({}))) // 空的 actions 对象
  );

    setState(updater: (state: typeof initialState) => void) {
    this.store.setState(updater);
  }

  updateName(name: string) {
    this.setState((state) => {
      state.name = name;
    }); // 使用 setState
  }
}
```

### 创建独立的 Store 目录

**反模式**：在 Feature 目录下创建 `store/` 目录，并在其中定义全局或模块级的 Store。

**原因**：

- 破坏了 Manager/ViewController 的封装性。
- 导致状态管理逻辑与业务逻辑分离。
- 容易退化为全局变量滥用。

**正确做法**：

- 状态是 Manager 或 ViewController 的**私有实现细节**。
- 使用 `import { createStore } from 'zustand/vanilla';` 在类内部创建 Store。
- 外部只能通过 Manager/ViewController 的方法或属性访问状态。

### 依赖 useCombinedStore Selector 参数

**反模式**：在 `useCombinedStore` 的 selector 回调中使用参数来获取 State。

```typescript
// 错误示范
const sections = useCombinedStore(
  vc.combinedStore,
  (detailState, sectionState) => sectionState // 依赖 Store 顺序
);
```

**原因**：

- 导致代码对 `combinedStore` 中 Store 的顺序产生隐式依赖，一旦顺序调整容易引发 Bug。
- 降低了代码的可读性和可维护性。

**正确做法**：

- Selector 回调保持空参数。
- 直接通过 Manager 或者 VC 的属性访问状态。

```typescript
// 正确示范
const sections = useCombinedStore(
  vc.combinedStore,
  () => vc.sectionSizeManager.state // 直接访问 Manager 属性
);
```

