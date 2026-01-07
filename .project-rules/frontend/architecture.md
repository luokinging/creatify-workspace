---
description: 架构设计指南 - Manager 模式、层次结构、依赖注入、生命周期管理
---

# AI 架构设计指南

## 核心哲学：Manager 模式

为了保证代码的可扩展性、可测试性和可维护性，我们严格遵循 **Manager 模式**。这种模式的核心在于将**业务逻辑**、**状态管理**与**UI 展示**彻底分离。

我们不再强制要求独立的 `store` 层，状态应当作为 Manager 的内部实现细节。

### 1. 层次结构

1.  **Services (`feature/services/*`)**：
    *   **角色：** 全局基础设施服务 (Global Infrastructure Services)。
    *   **职责：** 提供跨功能模块的全局服务，如用户服务、认证服务、存储服务等。
    *   **特征：** 
        *   全局定义，整个 app 生命周期都存在。
        *   在 app 启动时通过 `registerAppService` 注册到全局容器。
        *   功能模块**不允许定义** Service，只能使用。
        *   优先通过 `useServices()` ，util函数可以通过`getService()` 获取。
    *   **生命周期：** Service 是单例，在整个 app 生命周期内存在，不需要手动管理生命周期。

2.  **Managers (`*-manager.ts`)**：
    *   **角色：** 领域大脑 (Domain Brain)。
    *   **职责：** 这是业务逻辑的核心。Manager 封装了特定领域的所有状态（State）和行为（Logic）。
        *   **数据获取：** 调用 API。
        *   **状态更新：** 内部维护 Zustand store 或其他状态容器。
        *   **业务规则：** 校验、计算、转换数据。
        *   **事件处理：** 响应用户操作或系统事件。
    *   **生命周期：** 必须实现 `bootstrap(...)` (初始化) 和 `dispose()` (销毁) 方法，从bootstrap触发的附属方法使用 `bootstrapXxx` 的命名方式而不是 `initXxx`。

3.  **Reconciler (`*.manager/view-controller.ts`)**：
    *   **角色：** 高级协调者 (Orchestrators)。
    *   **职责：** 协调多个 Manager，处理跨领域的复杂业务流程。Reconciler 通常不直接持有 UI 状态，而是管理 Manager 的生命周期或处理全局性的事务。
    *   **特征：** 命名通常以 ViewController结尾，比如 XxxViewController
    *   **依赖：** 可以通过构造函数注入 Service 和 Manager。
    *   **生命周期：** 必须实现 `bootstrap(...)` (初始化) 和 `dispose()` (销毁) 方法，从bootstrap触发的附属方法使用 `bootstrapXxx` 的命名方式而不是 `initXxx`。

4.  **UI Components (`*.tsx`)**：
    *   **角色：** 纯展示层 (Pure Presentation)。
    *   **职责：** 
        *   从 Manager 获取数据（通过 Hooks）。
        *   将用户交互（点击、输入）委托给 Manager 的方法。

### 2. 构造器注入

*   **通过构造函数传入依赖：** 类（Managers/ViewControllers）应当通过构造函数接收它们的依赖项。
*   **Service 的获取：** Service 在 Context Provider 中通过 `useServices()` 获取，然后通过构造函数注入到 ViewController 或 Manager。
*   **创建实例时传递依赖：** 在 `new` 的时候直接传递依赖实例，例如：`new MyViewController(userService, dataManager)`
*   **依赖顺序：** Service → Manager → ViewController → UI Component

### 3. 生命周期管理

*   **Bootstrap & Dispose：** 所有长生命周期的对象（Services/Managers/ViewControllers）必须拥有明确的生命周期方法。
    *   `bootstrap()`: 启动监听器、建立 WebSocket 连接、获取初始数据。
    *   `dispose()`: 清理监听器、关闭连接、取消定时器、重置状态。
*   **DisposerManager：** 推荐使用 `DisposerManager` 来统一管理和自动清理副作用。

### 4. 状态访问规范

**所有带状态的 Manager 类内部必须统一提供 `state` getter 和 `setState()` 方法**，作为状态读取和更新的唯一入口。

**标准写法：**

```ts
export class MyManager {
  // 定义初始状态类型
  private readonly initialState = {
    data: [],
    filter: 'all',
    loading: false,
  };

  // 创建 Zustand store
  readonly store = createStore(
    immer(combine(this.initialState, () => ({})))
  );

  // 统一的状态读取接口
  get state() {
    return this.store.getState();
  }

  // 统一的状态更新接口
  setState(updater: (state: typeof this.initialState) => void) {
    this.store.setState(updater);
  }
}
```

**使用示例：**

```ts
// 外部访问状态
const currentData = manager.state.data;

// 更新状态
manager.setState((state) => {
  state.filter = 'active';
  state.loading = true;
});
```

**重要说明：**

1. **必须使用 immer 更新**：`setState` 内部使用 `immer`，可以直接修改 draft 对象
2. **类型安全**：`updater` 参数类型使用 `typeof this.initialState`，确保类型一致
3. **禁止直接访问 store**：外部应该通过 `manager.state` 而不是 `manager.store.getState()` 访问状态
4. **统一接口**：所有 Manager 都应该提供这个接口，保持代码一致性

### 5. 状态定义与使用原则

**什么是状态？**

状态是指**可以驱动视图更新的数据**，即当数据变化时需要触发组件重新渲染的数据。状态存储在 Zustand store 中，通过订阅机制实现响应式更新。

**什么时候使用状态（Store），什么时候使用普通成员变量？**

| 场景 | 使用方式 | 原因 |
|------|---------|------|
| 表单字段、列表数据 | **Store 状态** | 需要驱动 UI 更新，用户操作会改变数据 |
| 加载状态、错误信息 | **Store 状态** | 视图需要显示加载/错误状态 |
| 选项数据、筛选条件 | **Store 状态** | 变化后需要刷新相关 UI |
| 配置数据（只读） | **普通变量** | 不需要触发重渲染，仅供内部计算使用 |
| 一次性数据（如初始化参数） | **普通变量** | 仅在初始化时使用，不需要响应式更新 |
| 事件上报参数 | **普通变量** | 内部使用，不涉及视图显示 |

**判断标准：**

问自己：**"这个数据变化后，视图需要重新渲染吗？"**
- **是** → 使用 Store 状态
- **否** → 使用普通成员变量

**计算属性（Getter）的使用：**

计算属性不是状态，而是基于状态计算得出的派生值。当状态更新驱动视图重新渲染时，计算属性函数会被重新调用。

```ts
// ✅ 正确：计算属性基于状态计算
get filteredData() {
  return this.state.data.filter(item => item.active);
}

// ❌ 错误：不要把派生值存为状态
private filteredData: any[]; // 错误！应该用 getter
```

**常见反模式：**

```ts
// ❌ 反模式 1：把不需要驱动视图的数据放入状态（Store）
readonly store = createStore(immer(combine({
  config: {} as Config,  // 错误！配置数据是只读的，不需要放入状态
}, () => ({}))));

// ✅ 正确做法：配置数据用普通成员变量
private readonly config: Config = {};

// ================================================

// ❌ 反模式 2：把派生值存为状态（Store）
readonly store = createStore(immer(combine({
  data: [] as any[],
  totalCount: 0,  // 错误！totalCount 应该用 getter 计算
}, () => ({}))));

// ✅ 正确做法：派生值用计算属性
get totalCount() {
  return this.state.data.length;
}

// ================================================

// ❌ 反模式 3：把临时变量放入状态（Store）
readonly store = createStore(immer(combine({
  tempValue: '',  // 错误！临时变量应该用局部变量
}, () => ({}))));

function someMethod() {
  let tempValue = '';  // 正确！局部变量
}
```

### 6. 是一种组织方式
Manager模式是一种基于面向对象的逻辑组织方式，不仅限于页面
* 对于纯组件，内部逻辑如果比较重（大量useCallback、useMemo或复杂的业务逻辑），也都可以使用Manager模式，只不过对外表现的和普通纯组件一样
* 对于业务复用组件，比如内部去获取网络数据（比如用户信息这类通用的），都应该使用Manager 模式组织（有自己的ViewController），但是对外表现的和普通组件一样，通过props传入参数


### 常见写法

#### ViewController 协调多个 Manager 的完整示例

以下示例展示了一个 ViewController 如何协调多个 Manager，包含完整的文件结构和实现：

**文件树结构：**
```
feature/example/
├── manager/
│   ├── data-manager.ts              # 数据管理 Manager
│   ├── filter-manager.ts            # 过滤逻辑 Manager
│   ├── selection-manager.ts         # 选择状态 Manager
│   ├── other-manager.ts             # 依赖其他 Manager 的 Manager
│   └── example-view-controller.ts  # ViewController 协调多个 Manager
├── context/
│   └── example-view-controller-context.tsx  # Context Provider
└── page/
    ├── example-page.tsx             # Page 组件（创建 ViewController、管理生命周期）
    └── example-page-content.tsx     # PageContent 组件（实际内容）
```

Manager定义省略

**ViewController 定义：**

```ts
// manager/example-view-controller.ts

export class ExampleViewController {
  private readonly disposerManager = new DisposerManager();
  
  // 通过构造函数注入 Service 和多个 Manager
  private readonly userService: IUserService;
  public readonly dataManager: DataManager;
  public readonly filterManager: FilterManager;
  public readonly selectionManager: SelectionManager;
  // 依赖其他 Manager 的 Manager，需要在 constructor 中构造
  public readonly computedDataManager: OtherManager;
  
  // 组合所有 Manager 的 store 为 combinedStore
  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;
  
  constructor(
    userService: IUserService,
    dataManager: DataManager,
    filterManager: FilterManager,
    selectionManager: SelectionManager,
  ) {
    // Service 通过构造函数注入，功能模块只能使用，不能定义
    this.userService = userService;
    this.dataManager = dataManager;
    this.filterManager = filterManager;
    this.selectionManager = selectionManager;
    
    // 依赖其他 Manager 的 Manager，需要在 constructor 中构造
    // 注意：必须在基础 Manager 创建之后才能创建
    this.otherManager = new OtherManager(
      this.dataManager,
      this.filterManager
    );
    
    // 创建 combinedStore，组合所有 Manager 的 store
    // 注意：必须使用 as const 来保证类型推断正确
    this.combinedStore = createCombinedStore([
      this.dataManager.store,
      this.filterManager.store,
      this.selectionManager.store,
      this.otherManager.store,
    ] as const);
  }
  
  // 生命周期：初始化
  async bootstrap(options?: { projectId?: string; initialFilter?: Filter }) {
    // 可以使用 Service 获取全局数据
    // const userInfo = await this.userService.waitUserInfoLoaded();
    
    // 初始化各个 Manager（注意顺序：基础 Manager 先初始化）
    await this.dataManager.bootstrap();
    await this.filterManager.bootstrap(options?.initialFilter);
    await this.selectionManager.bootstrap();
    // 依赖其他 Manager 的 Manager 后初始化
    await this.otherManager.bootstrap();
    
    // 协调 Manager 之间的交互
    this.bootstrapManagerInteractions();
    // bootstrap保持简洁，可以定义bootstrapXxx来处理不同独立的部分
  }
  
  // 协调 Manager 之间的交互逻辑
  private bootstrapManagerInteractions() {
    // 订阅 filterManager 的变化，当过滤器变化时重新获取数据
    // 先获取 dispose 函数，避免嵌套
    const disposeFilterSubscription = this.filterManager.store.subscribe(() => {
      this.dataManager.fetchData();
    });
    // 将 dispose 函数添加到 DisposerManager 中统一管理
    this.disposerManager.addDisposeFn(disposeFilterSubscription);
  }
  
  // 生命周期：清理
  dispose() {
    this.disposerManager.dispose();
    // 注意清理顺序：依赖其他 Manager 的 Manager 先清理
    this.otherManager.dispose();
    this.dataManager.dispose();
    this.filterManager.dispose();
    this.selectionManager.dispose();
  }
  
  // 业务方法：协调多个 Manager 的交互
  async handleFilterChange(filter: Filter) {
    this.filterManager.setFilter(filter);
    // filterManager 的变化会触发 dataManager 的自动更新（通过 subscribe）
  }
  
  // 计算属性：从多个 Manager 的状态计算衍生值
  get filteredData() {
    const data = this.dataManager.store.getState().data;
    const filter = this.filterManager.store.getState().filter;
    return data.filter(item => item.category === filter.category);
  }
  
  get hasSelection() {
    const selectedIds = this.selectionManager.store.getState().selectedIds;
    return selectedIds.length > 0;
  }
  
  // 计算函数：从多个 Manager 的状态计算衍生值（带参数）
  getTotalCount(category?: string): number {
    const data = this.dataManager.store.getState().data;
    if (category) {
      return data.filter(item => item.category === category).length;
    }
    return data.length;
  }
  
  // 禁止套壳函数：不要创建只是简单调用 Manager 方法的包装函数
  // 错误示例（禁止）：
  // handleItemSelect(id: string) {
  //   this.selectionManager.selectItem(id);
  // }
  // 正确做法：直接使用 vc.selectionManager.selectItem(id)
  // 原因：不必要的嵌套调用会增加代码复杂度，没有实际价值，应该直接暴露 Manager 的方法

}
```

**Context 定义：**

```tsx
// context/example-view-controller-context.tsx
// 创建 Context
const ExampleViewControllerContext = createContext<ExampleViewController | null>(null);

// Provider 组件：只负责提供 ViewController，接收 vc 作为 prop
export function ExampleViewControllerProvider({ 
  children, 
  vc 
}: PropsWithChildren<{ vc: ExampleViewController }>) {
  return (
    <ExampleViewControllerContext.Provider value={vc}>
      {children}
    </ExampleViewControllerContext.Provider>
  );
}

// Hook 用于获取 ViewController
export function useExampleViewController(): ExampleViewController {
  const vc = useContext(ExampleViewControllerContext);
  if (!vc) {
    throw new Error('useExampleViewController must be used within ExampleViewControllerProvider');
  }
  return vc;
}
```

**View 组件定义：**

```tsx
// page/example-page.tsx

// Page 组件：负责创建 ViewController、管理生命周期、包裹 Provider
export function ExamplePage() {
  // 从全局 Service 容器获取 Service（功能模块只能使用，不能定义）
  const userService = useServices(IUserService);
  
  // 如果 Page 需要接收参数（从 props 或 URL），可以在这里获取
  // 例如：const { projectId, initialFilter } = props; 或从 URL searchParams 获取
  // const searchParams = useSearchParams();
  // const projectId = searchParams.get('projectId') || undefined;
  
  // 使用 useState 分别创建各个 Manager 实例，确保只创建一次
  const [dataManager] = useState(() => new DataManager());
  const [filterManager] = useState(() => new FilterManager());
  const [selectionManager] = useState(() => new SelectionManager());
  
  // 使用 useState 创建 ViewController 实例，确保只创建一次
  // 通过构造函数注入 Service 和 Managers
  const [vc] = useState(() => new ExampleViewController(
      userService,
      dataManager,
      filterManager,
      selectionManager
    ));

  // 生命周期管理
  // 如果 Page 有参数，需要将参数传递给 bootstrap，并将参数添加到依赖数组中
  // 例如：vc.bootstrap({ projectId, initialFilter }); 和 [vc, projectId, initialFilter]
  useEffect(() => {
    vc.bootstrap();
    
    return () => {
      vc.dispose();
    };
  }, [vc]);

  return (
    <ExampleViewControllerProvider vc={vc}>
      <ExamplePageContent />
    </ExampleViewControllerProvider>
  );
}
```

```tsx
// page/example-page-content.tsx

// PageContent 组件：实际的内容组件，使用 Context 获取 ViewController
export function ExamplePageContent() {
  // 从 Context 获取 ViewController
  const vc = useExampleViewController();
  
  // 使用 useCombinedStore 从 combinedStore 中获取状态
  // 最佳实践：selector 函数应该是无参数的，直接从 vc 或 manager 获取值
  // 严格禁止：useCombinedStore 的第二个参数（selector）严格禁止使用入参
  // 错误示例：useCombinedStore(vc.combinedStore, (dataState, filterState) => ...)
  // 一次性取值：selector 返回一个对象，然后解构获取需要的值
  const { data, filter, selectedIds, filteredData, hasSelection, totalCount } = useCombinedStore(
    vc.combinedStore,
    () => ({
      // 直接从 manager store 获取状态
      data: vc.dataManager.state.data,
      filter: vc.filterManager.state.filter,
      selectedIds: vc.selectionManager.state.selectedIds,
      // 使用计算属性 getXxx 获取衍生值
      filteredData: vc.filteredData,
      hasSelection: vc.hasSelection,
      // 使用计算函数 getXxx() 获取衍生值
      totalCount: vc.getTotalCount(),
    })
  );
  
  // 将用户交互直接委托给 ViewController 的方法
  // 不需要创建包装函数，直接在 JSX 中使用箭头函数调用 vc 的方法即可
  // 原因：避免不必要的函数包装，保持代码简洁，直接调用 vc 的方法更清晰
  return (
    <div>
      <FilterComponent 
        filter={filter} 
        onChange={(newFilter) => vc.handleFilterChange(newFilter)} 
      />
      <DataList 
        data={data} 
        selectedIds={selectedIds}
        onItemClick={(id) => vc.handleItemSelect(id)}
      />
    </div>
  );
}
```

#### ViewController 中使用 Ref 的规范

**对于 ViewController，需要使用 ref 的地方（DOM element、组件实例等），应该使用 `vc.setXxxEl` / `vc.setXxxRef` 的方式来接收组件的 ref。**

**基本用法：**

```ts
// manager/example-view-controller.ts
export class ExampleViewController {
  private containerRef: HTMLElement | null = null;
  
  setContainerEl(el: HTMLElement | null) {
    this.containerRef = el;
    if (el) {
      // ref 设置后可以立即执行操作，不需要等待 useEffect
      el.scrollTo({ top: 0 });
    }
  }
}
```

```tsx
// 组件中使用
<div ref={(el) => vc.setContainerEl(el)} />
```

**事件监听场景：**

当需要添加事件监听器时，为每个 ref 单独定义 DisposerManager，在 `setXxxEl` 中先清除旧的监听，再添加新的监听：

```ts
// manager/example-view-controller.ts
import { DisposerManager } from "@/manager/disposer-manager";

export class ExampleViewController {
  private readonly disposerManager = new DisposerManager();
  private readonly containerElDisposerManager = new DisposerManager();
  private containerRef: HTMLElement | null = null;
  
  setContainerEl(el: HTMLElement | null) {
    // 先清除旧的监听
    this.containerElDisposerManager.dispose();
    
    this.containerRef = el;
    
    if (el) {
      const handleScroll = () => this.handleContainerEl(el);
      el.addEventListener('scroll', handleScroll);
      
      this.containerElDisposerManager.addDisposeFn(() => {
        el.removeEventListener('scroll', handleScroll);
      });
    }
  }
  
  private handleContainerEl(el: HTMLElement) {
    // 处理逻辑
  }
  
  dispose() {
    this.containerElDisposerManager.dispose();
    this.disposerManager.dispose();
  }
}
```

**关键点：**

1. 避免 `useRef + useEffect` 的时序问题，ref 设置后可以立即使用
2. 事件监听：为每个 ref 单独定义 DisposerManager，先清除旧监听再添加新监听
3. 在 `dispose()` 中统一清理

**反模式：**

```tsx
// ❌ 错误：使用 useRef + useEffect，存在时序问题
const containerRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (containerRef.current) {
    containerRef.current.scrollTo({ top: 0 });
  }
}, []);
```

### 4. 模块间交互原则

**核心原则：** 如果涉及不同模块之间（不管大小）的交互，应该保持不同模块之间的相对独立，应该以某个模块提供"通用能力"的方式去思考，而不是写 hack if。

*   **提供通用能力：** 模块应该提供通用的能力或接口，而不是针对特定调用方的特殊逻辑。
*   **保持模块独立：** 通过清晰的接口（方法、事件、状态订阅）与其他模块交互。
*   **通过 ViewController 协调：** 跨模块的复杂交互应该通过 ViewController 来协调，而不是在模块内部添加针对特定调用方的条件判断（如 `if (source === 'xxx')`）。

### 5. 常见反模式

*   **上帝组件 (The "God Component")：**
    *   *症状：* 一个 `.tsx` 文件既负责 UI 布局，又负责 `fetch` 数据，还用大量的 `useState` 和 `useEffect` 处理业务逻辑。
    *   *后果：* 难以阅读，难以复用，难以测试，修改一处容易崩坏全局。
    *   *修正：* 提取逻辑到 Manager。

*   **逻辑泄露到 Store (Logic in Stores)：**
    *   *症状：* 在 Zustand 的 action 中直接进行 API 调用和复杂的流程控制。
    *   *后果：* 状态层变得不纯粹，难以追踪状态变更的源头。
    *   *修正：* Store 只负责同步的维持，设置和操作流程由manager等的成员函数去做。

*   **紧耦合的 Hooks (Tightly Coupled Hooks)：**
    *   *症状：* 一个 Hook 做了太多事情（获取 + 转换 + 业务判断），导致只能在特定组件使用。
    *   *修正：* 拆分为更细粒度的 Hooks，或下沉到 Manager。

*   **过度使用 useCallback 和 useMemo (Overusing useCallback/useMemo)：**
    *   *症状：* 在组件中大量使用 `useCallback` 和 `useMemo` 来优化函数和值的创建。
    *   *后果：* 增加代码复杂度，难以维护，且往往是不必要的优化。在 Manager 模式下，状态都在特定的 Manager 中管理，组件通常是纯展示层，不需要这些优化。
    *   *修正：* 在组件中应**避免使用** `useCallback` 和 `useMemo`。如果必须使用且代码块超过 10 行，必须将其提取到 ViewController 或 Manager 中。

*   **模块间交互使用 hack if (Hack If for Module Interaction)：**
    *   *症状：* 在模块内部使用类似 `if (source === 'xxx')` 这样的条件判断来处理不同调用方的特殊逻辑。
    *   *后果：* 破坏了模块的独立性，导致模块与特定调用方紧耦合，难以维护和扩展。
    *   *修正：* 应该将模块设计为提供通用的能力，通过参数、配置或接口来支持不同场景。跨模块的复杂交互应该通过 ViewController 来协调。

## 示例对比

### 糟糕的写法
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

### 推荐的写法
```ts
// feature.manager.ts
class FeatureManager {
  // 状态封装在内部
  readonly store = createStore(...) 

  readonly queryManager = new QueryManager() // 这里只是示例，实际上可能要用 PaginatedQueryManager 或者 createAutoKeyMiniQueryClient
  
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
  const manager = useXxx(FeatureManager); // 实际可能是 useXxxViewController()
  const data = useXxx(manager.store, s => s.data); // 实际可能是 useZustand 或者 useCombinedStore
  
  return <div onClick={() => manager.saveData()}>{/* ... */}</div>;
}
```
