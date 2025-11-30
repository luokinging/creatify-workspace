---
description: 通用工具管理器使用指南 - DisposerManager、ProcessingTaskManager、SelectionManager 等工具管理器的使用方法
---

# 通用工具管理器

## DisposerManager（资源清理管理器）

**描述**：统一管理需要清理的资源（订阅、事件监听器等），在 dispose 时统一清理。

**使用模版**：

```typescript
import { DisposerManager } from "@/manager/disposer-manager";

class MyViewController {
  private readonly disposerManager = new DisposerManager();

  bootstrap() {
    const unsubscribe = this.store.subscribe(() => {});
    this.disposerManager.addDisposeFn(unsubscribe);

    const eventEmitter = new EventEmitter();
    this.disposerManager.add(eventEmitter);
  }

  dispose() {
    this.disposerManager.dispose();
  }
}
```

## ProcessingTaskManager（异步任务管理器）

**描述**：管理异步任务，支持任务取消和轮询功能。

**使用模版**：

```typescript
import { ProcessingTaskManager } from "@/manager/processing-task-manager";

class MyViewController {
  private readonly processingTaskManager = new ProcessingTaskManager();

  async startPolling() {
    const pollingWrapper = this.processingTaskManager.polling(fetchTaskStatus, {
      interval: 2000,
      isFinished: (result) => result.status === "completed",
      needInterrupt: (result) => result.status === "failed",
    });

    const result = await pollingWrapper(taskId);
  }

  dispose() {
    this.processingTaskManager.cancelAll();
  }
}
```

## MapSelectionManager（映射选择管理器）

**描述**：使用 Map 数据结构的选择管理器，适合需要频繁检查选择状态的场景。

**使用场景**：

- 高性能选择场景
- 复杂选择逻辑
- 数据源变化通知

**使用模版**：

```typescript
import { MapSelectionManager } from "@/feature/common/manager/map-selection-manager";

class MyViewController {
  private readonly selectionManager = new MapSelectionManager(
    (item) => item.id
  );

  someLogic() {
    this.selectionManager.xxxx;
  }
}
```

## StateMiddlewareManager（状态中间件管理器）

**描述**：在状态更新时执行中间件逻辑，支持状态验证、转换和拒绝。

**使用场景**：

- 状态验证
- 状态转换
- 数据清洗

**使用模版**：

```typescript
import { PartialStateMiddlewareManager } from "@/manager/state-middleware-manager";

class MyViewController {
  private readonly stateMiddleware =
    new PartialStateMiddlewareManager<MyState>();

  bootstrap() {
    const removeMiddleware = this.stateMiddleware.use(
      (newState, prevState, reject) => {
        if (newState.count !== undefined && newState.count < 0) {
          reject();
          return;
        }

        return { ...newState, count: Math.max(0, newState.count) };
      }
    );

    this.disposerManager.addDisposeFn(removeMiddleware);
  }

  updateState(newState: Partial<MyState>) {
    const processedState = this.stateMiddleware.process(
      newState,
      this.store.getState()
    );
    if (processedState) {
      this.store.setState(processedState);
    }
  }
}
```

## createAutoKeyMiniQueryClient（自动键值查询客户端）

**描述**：基于 AutoKeyQuery 创建独立的 Query Client，常用于 Manager 或 ViewController 中管理查询状态。支持动态参数、乐观更新和订阅数据变化。

**使用场景**：

- 在非 React 环境中管理查询状态
- 需要订阅数据变化并响应式更新
- 需要乐观更新操作
- 需要手动控制查询时机

**重要约束**：`fn` 参数必须是稳定的函数引用。如果函数引用发生变化，Query 缓存会被失效，可能导致意外行为。使用全局定义或静态导入的函数来确保稳定性。

**使用模版**：

```typescript
import {
  type AutoKeyMiniQueryClient,
  createAutoKeyMiniQueryClient,
} from "@/feature/common/experimental/auto-key-helper";
import { getKnowledgeRules } from "@/feature/tool.ad-max/api";

class MyViewController {
  // 创建 Mini Query Client，支持动态参数
  readonly knowledgeRulesQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getKnowledgeRules, // 必须是稳定的函数引用
    fnParams: [
      {
        account_id: this.state.selectedAdAccountId,
      },
    ] as const,
    gcTime: Infinity,
    enabled: Boolean(this.state.selectedAdAccountId),
  }));

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  constructor() {
    // 将 store 加入 combinedStore 以支持响应式更新
    this.combinedStore = createCombinedStore([
      this.store,
      this.knowledgeRulesQueryClient.store,
    ] as const);
  }

  async updateRuleOptimistically(ruleId: string, updates: Partial<Rule>) {
    // 乐观更新
    await this.knowledgeRulesQueryClient.optimisticUpdate({
      executor: async () => {
        await updateRuleApi(ruleId, updates);
      },
      optimisticUpdater: (data) => {
        if (!data) return data;
        const rule = data.rules.find((r) => r.id === ruleId);
        if (rule) {
          Object.assign(rule, updates);
        }
        return data;
      },
    });
  }

  bootstrap() {
    // 订阅数据变化
    this.disposerManager.addDisposeFn(
      this.knowledgeRulesQueryClient.store.subscribe((state) => {
        if (state.data) {
          this.handleKnowledgeRulesChange(state.data);
        }
      })
    );
  }
}
```

在视图中使用

```jsx
function Component(...){

  const { data, isLoading, ... } = useCombinedStore(vc.combinedStore, ()=>vc.knowledgeRulesQueryClient.store.getState())

  return <...>
}

```

**在 Manager 中使用**：

```typescript
export class AdsLaunchDataManager {
  private readonly adsLaunchQueryClient: AutoKeyMiniQueryClient<AdsLaunchType>;

  constructor(private readonly filterManager: ReportFilterManager) {
    this.adsLaunchQueryClient = createAutoKeyMiniQueryClient(() => ({
      fn: getAdsLaunch,
      fnParams: [
        this.filterManager.state.platform,
        this.filterManager.state.adsLaunchId,
      ] as const,
      enabled: Boolean(this.filterManager.state.adsLaunchId),
      gcTime: Infinity,
    }));
  }
}
```

## PaginatedQueryManager（分页查询管理器）

**描述**：用于管理分页查询的 Manager，支持自动缓存、加载下一页、乐观更新等功能。基于 AutoKeyQuery 和 ProcessingTaskManager 实现。

**使用场景**：

- 管理分页列表数据（如广告列表、推荐列表等）
- 需要支持无限滚动或分页加载
- 需要乐观更新列表项
- 需要缓存和自动刷新

**使用模版**：

```typescript
import { PaginatedQueryManager } from "@/feature/my-ads/manager/common/paginated-query-manager";
import { getRecommendation } from "@/feature/my-ads/api/ads-strategy";

class MyViewController {
  // 创建分页查询管理器
  readonly recommendationQueryManager = new PaginatedQueryManager(
    getRecommendation
  );

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  constructor() {
    // 将 store 加入 combinedStore
    this.combinedStore = createCombinedStore([
      this.store,
      this.recommendationQueryManager.store,
    ] as const);
  }

  async fetchRecommendations() {
    // 获取第一页数据
    await this.recommendationQueryManager.fetch({
      platform: this.state.selectedPlatform,
      advertiser_id: this.state.selectedAccountId || "",
    });
  }

  async updateRecommendationOptimistically(
    recommendationId: string,
    updates: Partial<Recommendation>
  ) {
    // 乐观更新列表项
    await this.recommendationQueryManager.optimisticUpdate({
      executor: async () => {
        await updateRecommendationApi(recommendationId, updates);
      },
      optimisticUpdater: (state) => {
        const item = state.data.find((item) => item.id === recommendationId);
        if (item) {
          Object.assign(item, updates);
        }
      },
    });
  }

  dispose() {
    // 清理资源
    this.recommendationQueryManager.dispose();
  }
}
```

**在 Manager 中使用多个 PaginatedQueryManager**：

```typescript
export class MetaAdsManager {
  readonly creativePaginatedQueryManager = new PaginatedQueryManager(
    getTopCreatives
  );
  readonly campaignLevelPaginatedQueryManager = new PaginatedQueryManager(
    getCampaignsMetric
  );
  readonly adLevelPaginatedQueryManager = new PaginatedQueryManager(
    getAdsMetric
  );

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  constructor() {
    this.combinedStore = createCombinedStore([
      this.creativePaginatedQueryManager.store,
      this.campaignLevelPaginatedQueryManager.store,
      this.adLevelPaginatedQueryManager.store,
    ] as const);
  }

  async updateAdsStatus(params: {
    adId: string;
    adAccountId: string;
    status: "ACTIVE" | "PAUSED";
  }) {
    // 使用乐观更新修改广告状态
    await this.adLevelPaginatedQueryManager.optimisticUpdate({
      executor: async () => {
        await updateAdsStatusApi({
          platform: AdsPlatformEnum.Meta,
          advertiser_id: params.adAccountId,
          ad_id: params.adId,
          status: params.status,
        });
      },
      optimisticUpdater: (state) => {
        const item = state.data.find((item) => item.ad_id === params.adId);
        if (item) {
          item.is_active = params.status === "ACTIVE";
        }
      },
    });
  }

  dispose() {
    this.creativePaginatedQueryManager.dispose();
    this.campaignLevelPaginatedQueryManager.dispose();
    this.adLevelPaginatedQueryManager.dispose();
  }
}
```
