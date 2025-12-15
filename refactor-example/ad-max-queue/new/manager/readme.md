# Queue 模块架构文档

本文档描述了 AdMax Queue 模块的架构设计，包括各个 Manager 的职责、作用以及它们之间的依赖关系。

## 📋 目录结构

```
queue/
├── queue-page-view-controller.ts       # 顶层控制器，协调所有 Managers
├── queue-navigation-manager.ts          # Tab 导航管理
├── queue-analysis-pipeline-manager.ts   # Analysis Pipeline 管理
├── queue-creation-pipeline-manager.ts   # Creation Pipeline 管理
├── queue-knowledge-base-manager.ts      # Knowledge Base 管理
└── readme.md                             # 本文档
```

## 🏗️ 架构概览

Queue 模块采用分层架构设计，遵循 MVC 模式：

- **ViewController 层**：`QueuePageViewController` 作为顶层协调器
- **Manager 层**：各个业务逻辑 Manager 负责具体功能模块的业务逻辑
- **守卫层**：`QueueAccountGuard` 提供账户状态检查和权限守卫
- **状态层**：`AdMaxPersistStateManager` 提供持久化状态管理

## 📦 核心组件详解

### 1. QueuePageViewController

**文件**: `queue-page-view-controller.ts`

**职责**:

- 作为整个 Queue 页面的顶层控制器，负责协调所有子 Manager
- 管理页面的生命周期（bootstrap/dispose）
- 组合 `combinedStore`，统一暴露给视图层
- 处理跨 Manager 的协调逻辑（账户切换、数据刷新）
- 提供向后兼容的委托属性

**依赖关系**:

- ✅ 依赖所有 Queue Managers
- ✅ 依赖 `QueueAccountGuard`（账户状态守卫）
- ✅ 依赖 `AdMaxPersistStateManager`（状态持久化）
- ✅ 依赖多个 Service（`IPlatformIntegrationService`, `ITransientDataService`, `IBrandSpaceService`）

**关键方法**:

- `bootstrap()`: 初始化页面，加载数据，设置监听器
- `dispose()`: 清理所有资源和订阅
- `setActiveTab(tab)`: 切换 Tab（带守卫检查）
- `withGuard(action, runner)`: 带守卫保护的操作执行

**作用**:
Queue 页面的"大脑"，负责整体流程控制和协调。

---

### 2. QueueNavigationManager

**文件**: `queue-navigation-manager.ts`

**职责**:

- 管理当前激活的 Tab 状态（Creation / Analysis / Knowledge）
- 与 URL search params 同步（`?tab=creation|analysis|knowledge`）
- 监听路由变化，自动更新 Tab 状态
- 提供 Tab 可用性检查（通过 QueueAccountGuard）

**依赖关系**:

- ✅ 依赖 `QueueAccountGuard`（Tab 可用性检查）

**关键方法**:

- `setActiveTab(tab)`: 设置激活的 Tab（带守卫检查）
- `isTabEnabled(tab)`: 检查 Tab 是否可用
- `bootstrap()`: 从 URL 恢复 Tab 状态，设置路由监听

**作用**:
Queue 页面的"导航系统"，负责 Tab 切换和 URL 同步。

---

### 3. QueueAnalysisPipelineManager

**文件**: `queue-analysis-pipeline-manager.ts`

**职责**:

- 管理 Analysis Pipeline 的分页查询（`PaginatedQueryManager`）
- 处理无限滚动加载
- 提供 approve/reject 操作
- 管理 Reject/Request Changes 对话框
- 提供导航到 Metric 页面的功能

**依赖关系**:

- ✅ 依赖 `AdMaxPersistStateManager`（获取选中的账户 ID）
- ✅ 依赖 `ITransientDataService`（创建导航消息）

**关键方法**:

- `fetch(isBrandMode)`: 获取 Analysis Pipeline 数据
- `approveItem(id)`: 批准分析项
- `rejectItem(id, name)`: 拒绝分析项（打开对话框）
- `setScrollElement(element, isActive)`: 设置无限滚动元素
- `navigateToAdMetric(item)`: 导航到广告指标页面

**作用**:
管理 Analysis Pipeline 的数据和操作。

---

### 4. QueueCreationPipelineManager

**文件**: `queue-creation-pipeline-manager.ts`

**职责**:

- 管理 Creation Pipeline 的分页查询
- 处理无限滚动加载
- 管理 concept generation 轮询（通过 `ProcessingTaskManager`）
- 管理 Testing Budget 数据
- 提供 approve/reject 操作
- 管理 Request Creatives / Insufficient Budget 对话框

**依赖关系**:

- ✅ 依赖 `AdMaxPersistStateManager`
- ✅ 依赖 `IPlatformIntegrationService`（获取账户和 Campaign 信息）
- ✅ 依赖 `ITransientDataService`
- ✅ 依赖 `ProcessingTaskManager`（轮询任务管理）

**关键方法**:

- `fetch(isBrandMode)`: 获取 Creation Pipeline 数据
- `fetchAndMaybeGenerateConcepts(isBrandMode, isAccountReady, isCreationTabActive)`: 获取数据并在需要时触发概念生成
- `approveItem(id, selectedJobIds)`: 批准创作项
- `openRequestCreativesDialog(...)`: 打开请求创意对话框
- `checkAndHandleConceptGeneration(...)`: 检查并处理概念生成（数据加载完成后调用）
- `fetchTestingBudget()`: 获取测试预算
- `resetConceptGenerationState()`: 重置概念生成状态（切换账户时使用）

**作用**:
管理 Creation Pipeline 的数据、概念生成和创意请求。这是最复杂的 Manager，包含异步轮询逻辑。

---

### 5. QueueKnowledgeBaseManager

**文件**: `queue-knowledge-base-manager.ts`

**职责**:

- 管理 Knowledge Rules 的查询（通过 `createAutoKeyMiniQueryClient`）
- 提供 rules CRUD 操作（create, approve, decline, update）
- 提供规则导出功能
- 管理 Rule Detail / Add Override Rule / Review All Rules 对话框
- 实现 `IRuleDataProvider` 接口

**依赖关系**:

- ✅ 依赖 `AdMaxPersistStateManager`
- ✅ 依赖 `IBrandSpaceService`（获取品牌信息）

**关键方法**:

- `fetch()`: 获取 Knowledge Rules
- `createNewRule(data)`: 创建新规则
- `approveRule(ruleId)`: 批准规则
- `declineRule(ruleId)`: 拒绝规则
- `openRuleDetailDialog(rule)`: 打开规则详情对话框
- `exportKnowledge()`: 导出规则为 CSV

**作用**:
管理 Knowledge Base 的规则数据和操作。

---

## 🔗 依赖关系图

```
QueuePageViewController (顶层控制器)
│
├── QueueNavigationManager
│   └── QueueAccountGuard
│
├── QueueAnalysisPipelineManager
│   ├── AdMaxPersistStateManager
│   └── ITransientDataService
│
├── QueueCreationPipelineManager
│   ├── AdMaxPersistStateManager
│   ├── IPlatformIntegrationService
│   ├── ITransientDataService
│   └── ProcessingTaskManager
│
├── QueueKnowledgeBaseManager
│   ├── AdMaxPersistStateManager
│   └── IBrandSpaceService
│
├── QueueAccountGuard (外部 Manager)
│   ├── IPlatformIntegrationService
│   ├── AdMaxPersistStateManager
│   └── brandAdmaxSetupQueryClient
│
└── AdMaxPersistStateManager (外部 Manager)
```

## 📊 数据流向

### 1. 初始化流程

```
QueuePageViewController.bootstrap()
  ├── QueueNavigationManager.bootstrap()
  │   └── 从 URL 恢复 Tab 状态
  ├── 等待 PlatformIntegrationService 就绪
  ├── 检查 Setup 完成状态
  ├── bootstrapAdAccountSync()
  │   └── 同步账户选择
  ├── bootstrapData()
  │   ├── analysisManager.fetch()
  │   ├── creationManager.fetchAndMaybeGenerateConcepts()
  │   │   ├── fetch() - 获取 pipeline 数据
  │   │   └── checkAndHandleConceptGeneration() - 数据加载后触发生成
  │   ├── knowledgeBaseManager.fetch()
  │   ├── accountStatsQueryClient.fetch()
  │   └── fetchTestingBudget()
  └── bootstrapRefreshListener()
      └── 监听账户切换，自动刷新数据
```

### 2. Tab 切换流程

```
用户点击 Tab
  ↓
QueuePageViewController.setActiveTab(tab)
  ↓
QueueNavigationManager.setActiveTab(tab)
  ↓
检查 Tab 是否可用（QueueAccountGuard）
  ↓
更新状态并同步 URL
```

### 3. 账户切换流程

```
用户选择新账户
  ↓
persistStateManager.setSelectedAccountId(id)
  ↓
bootstrapRefreshListener 监听到变化
  ↓
重置 concept generation 状态
  ↓
重新获取所有数据
```

## 🎯 关键设计模式

### 1. 组合模式（CombinedStore）

使用 `CombinedStore` 组合多个 Store，统一管理状态更新，方便视图使用 `useCombinedStore` 触发更新：

```typescript
this.combinedStore = createCombinedStore([
  this.store,
  this.navigationManager.combinedStore,
  this.analysisManager.combinedStore,
  this.creationManager.combinedStore,
  this.knowledgeBaseManager.combinedStore,
  this.accountStatsQueryClient.store,
  this.brandAdmaxSetupQueryClient.store,
] as const);
```

### 2. 依赖注入模式

所有 Manager 通过构造函数接收依赖，便于测试和替换：

```typescript
constructor(
  private readonly persistStateManager: AdMaxPersistStateManager,
  private readonly transientDataService: ITransientDataService
) {}
```

### 3. 守卫模式

使用 `QueueAccountGuard` 进行权限检查：

```typescript
async withGuard(action: QueueGuardAction, runner: () => Promise<void>) {
  const guardResult = this.getGuardResult(action);
  if (!guardResult.canProceed) {
    await this.presentGuardDialog(guardResult);
    return;
  }
  await runner();
}
```

### 4. 委托模式（向后兼容）

VC 提供委托属性，保持视图层向后兼容：

```typescript
get analysisPipelineQueryManager() {
  return this.analysisManager.queryManager;
}
```

## 🔄 状态管理

### 1. 本地状态（Manager Store）

每个 Manager 使用 Zustand Store 管理本地状态：

- `QueueNavigationManager`: `activeTab`
- `QueueCreationPipelineManager`: `isGeneratingConcept`, `testingBudget`

### 2. 查询状态（Query Clients）

使用 `PaginatedQueryManager` 和 `createAutoKeyMiniQueryClient` 管理查询状态：

- `analysisManager.queryManager`: Analysis Pipeline 分页数据
- `creationManager.queryManager`: Creation Pipeline 分页数据
- `knowledgeBaseManager.knowledgeRulesQueryClient`: Knowledge Rules 数据

### 3. 持久化状态（PersistStateManager）

`AdMaxPersistStateManager` 管理需要持久化的状态：

- `selectedAccountId`: 选中的账户 ID

## 🚀 使用示例

### 在视图中使用

```typescript
function QueuePageContent() {
  const vc = useQueuePageViewController();

  // 使用 useCombinedStore 获取状态
  const { activeTab, creationCount } = useCombinedStore(vc.combinedStore, () => ({
    activeTab: vc.activeTab,
    creationCount: vc.creationCount,
  }));

  // 调用 VC 方法
  const handleTabChange = (tab: QueuePageTabEnum) => {
    vc.setActiveTab(tab);
  };

  return (/* ... */);
}
```

### 创建 ViewController

```typescript
const [vc] = useState(
  () =>
    new QueuePageViewController(
      platformIntegrationService,
      transientDataService,
      brandSpaceService,
    ),
);

useEffect(() => {
  vc.bootstrap();
  return () => vc.dispose();
}, []);
```

## 📝 注意事项

1. **CombinedStore 聚合**: 所有 Manager 的 store 都被聚合到 VC 的 `combinedStore` 中
2. **向后兼容**: 通过委托属性保持视图层代码不变
3. **生命周期管理**: 每个 Manager 都有 `bootstrap` 和 `dispose` 方法
4. **异步轮询**: `QueueCreationPipelineManager` 使用 `ProcessingTaskManager` 处理概念生成轮询
5. **守卫检查**: 敏感操作通过 `withGuard` 方法进行权限检查
