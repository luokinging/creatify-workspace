---
description: 架构设计指南 - Manager 模式、层次结构、依赖注入、生命周期管理
---

# AI 架构设计指南 (Architecture Guidelines)

## 核心哲学：Manager 模式 (The Manager Pattern)

为了保证代码的可扩展性、可测试性和可维护性，我们严格遵循 **Manager 模式**。这种模式的核心在于将**业务逻辑**、**状态管理**与**UI 展示**彻底分离。

我们不再强制要求独立的 `store` 层，状态应当作为 Manager 的内部实现细节。

### 1. 层次结构 (The Hierarchy)

1.  **Reconciler (`*.manager/service/view-controller.ts`)**：
    *   **角色：** 高级协调者 (Orchestrators)。
    *   **职责：** 协调多个 Manager，处理跨领域的复杂业务流程。Reconciler 通常不直接持有 UI 状态，而是管理 Manager 的生命周期或处理全局性的事务。
    *   *例子：* 全局服务（只有全局服务才能用Service命名） `PlatformIntegrationService` 协调 `MetaPlatformManager` 和 `TiktokPlatformManager` / `MetricViewController` 协调 各种`AdsManager` 和 `MetricPageFilterManager` 和 `MetricStateControlManager` 和 `DataControlManager` 等

2.  **Managers (`*.manager.ts`)**：
    *   **角色：** 领域大脑 (Domain Brain)。
    *   **职责：** 这是业务逻辑的核心。Manager 封装了特定领域的所有状态（State）和行为（Logic）。
        *   **数据获取：** 调用 API。
        *   **状态更新：** 内部维护 Zustand store 或其他状态容器。
        *   **业务规则：** 校验、计算、转换数据。
        *   **事件处理：** 响应用户操作或系统事件。
    *   **生命周期：** 必须实现 `bootstrap()` (初始化) 和 `dispose()` (销毁) 方法。

3.  **UI Components (`*.tsx`)**：
    *   **角色：** 纯展示层 (Pure Presentation)。
    *   **职责：** 
        *   从 Manager 获取数据（通过 Hooks）。
        *   将用户交互（点击、输入）委托给 Manager 的方法。
    *   **红线：** **严禁**在组件中编写复杂的副作用逻辑、API 调用或数据转换逻辑。

### 2. 依赖注入 (Dependency Injection)

*   **通过构造函数传入依赖：** 类（Services/Managers/ViewControllers）应当通过构造函数接收它们的依赖项。这是简单直接的依赖注入方式，不需要自动注入或 Container 等复杂概念。
*   **创建实例时传递依赖：** 在 `new` 的时候直接传递依赖实例，例如：`new MyViewController(userService, dataManager)`
*   **优点：** 简单直观、易于测试（可以注入 Mock 对象）、依赖关系清晰
*   **避免单例滥用：** 尽量避免在深层逻辑中直接 import 全局单例。应当由上层（如 Page 或 Provider）创建依赖实例并传递给下层。

### 3. 生命周期管理 (Lifecycle Management)

*   **Bootstrap & Dispose：** 所有长生命周期的对象（Services/Managers）必须拥有明确的生命周期方法。
    *   `bootstrap()`: 启动监听器、建立 WebSocket 连接、获取初始数据。
    *   `dispose()`: 清理监听器、关闭连接、取消定时器、重置状态。
*   **DisposerManager：** 推荐使用 `DisposerManager` 来统一管理和自动清理副作用。

### 4. 常见反模式 (Anti-Patterns to AVOID)

*   ❌ **上帝组件 (The "God Component")：**
    *   *症状：* 一个 `.tsx` 文件既负责 UI 布局，又负责 `fetch` 数据，还用大量的 `useState` 和 `useEffect` 处理业务逻辑。
    *   *后果：* 难以阅读，难以复用，难以测试，修改一处容易崩坏全局。
    *   *修正：* 提取逻辑到 Manager。

*   ❌ **逻辑泄露到 Store (Logic in Stores)：**
    *   *症状：* 在 Zustand 的 action 中直接进行 API 调用和复杂的流程控制。
    *   *后果：* 状态层变得不纯粹，难以追踪状态变更的源头。
    *   *修正：* Store 只负责同步的状态更新（setter），复杂的异步流程由 Manager 处理。

*   ❌ **紧耦合的 Hooks (Tightly Coupled Hooks)：**
    *   *症状：* 一个 Hook 做了太多事情（获取 + 转换 + 业务判断），导致只能在特定组件使用。
    *   *修正：* 拆分为更细粒度的 Hooks，或下沉到 Manager。

## 示例对比

### ❌ 糟糕的写法 (混合关注点)
```tsx
// BadComponent.tsx
export function BadComponent() {
  // 逻辑混杂在组件里
  const [data, setData] = useState();
  
  useEffect(() => {
    // 直接调用 API
    fetch('/api/data').then(setData);
  }, []);

  const handleSave = async () => {
    // 业务逻辑
    if (data.value > 10) {
       await saveToApi(data);
    }
  };

  return <div onClick={handleSave}>{/* ... */}</div>;
}
```

### ✅ 推荐的写法 (关注点分离)
```ts
// feature.manager.ts
class FeatureManager {
  // 状态封装在内部
  readonly store = createStore(...) 

  constructor(private queryManager: QueryManager) {}
  
  // 业务逻辑封装在方法里
  async saveData() { 
    const data = this.store.getState().data;
    if (data.value > 10) {
       await this.queryManager.fetch(data); // or direct call api function is ok
    }
  }
}
```

```tsx
// GoodComponent.tsx
export function GoodComponent() {
  // 组件只负责连接 Manager
  const manager = useManager(FeatureManager);
  const data = useStore(manager.store, s => s.data);
  
  return <div onClick={() => manager.saveData()}>{/* ... */}</div>;
}
```
