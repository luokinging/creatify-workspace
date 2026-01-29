## Context

### 当前系统状态

CTA Generator Batch Mode 前端已使用 Mock 数据完成开发：
- 批量任务列表页使用静态 `MOCK_BATCH_LIST` 数据
- 新建批量页调用 `generateProductCta` API（单个生成）
- 预览页从 URL 参数解析 `batchItems` 字符串

后端已提供完整的批量任务管理 API：
- `POST /api/llm-editor/cta/batch/` - 创建批量任务
- `GET /api/llm-editor/cta/batch/` - 获取批量任务列表
- `GET /api/llm-editor/cta/batch/{id}/` - 获取批量任务详情
- `GET /api/llm-editor/cta/previews/` - 获取预览项列表
- `PATCH /api/llm-editor/cta/previews/{id}/` - 更新预览项

### 为什么需要这个变更

1. **功能可用性**：Mock 数据无法持久化，用户创建的任务刷新后丢失
2. **真实数据**：需要显示 AI 生成的真实预览项内容
3. **状态追踪**：需要实时查看批量任务的处理进度

### 相关现有实现

- **BatchListViewController**：使用 `MOCK_BATCH_LIST` 静态数据
- **NewBatchViewController**：调用 `generateProductCta` API（单个生成）
- **BatchPreviewViewController**：从 URL 参数解析数据

## Goals / Non-Goals

### Goals

1. 批量任务列表使用真实 API 数据，支持定期刷新
2. 创建批量任务调用后端 API，返回后立即跳转
3. 预览页从后端获取真实的预览项数据

### Non-Goals

1. **HTML 文件修改**：不修改 `iframe/cta-generator-test.html`
2. **编辑功能**：不实现预览项的编辑功能
3. **删除功能**：不实现批量任务的删除功能

## Decisions

### 1. API 客户端设计

#### 1.1 API 函数定义

**决策**：在 `api/index.ts` 中添加新的 API 函数

**理由**：
- 保持 API 调用的统一管理
- 方便复用和测试

**函数签名**：
```typescript
// 创建批量任务
export async function createBulkTask(params: {
  sources: Array<{ url: string; batch_size: number }>;
}): Promise<{
  bulk_generate_task_id: string;
  task_id: string;
  status: string;
}>;

// 获取批量任务列表
export async function getBulkTaskList(params: {
  page_size?: number;
  cursor?: string;
}): Promise<{
  next: string | null;
  previous: string | null;
  results: BulkTaskItem[];
}>;

// 获取批量任务详情
export async function getBulkTaskDetail(id: string): Promise<BulkTaskDetail>;

// 获取预览项列表
export async function getPreviewList(params: {
  bulk_task_id?: string;
  product_id?: string;
  page_size?: number;
  cursor?: string;
}): Promise<{
  next: string | null;
  previous: string | null;
  results: PreviewItem[];
}>;
```

### 2. Manager 设计

#### 2.1 BatchListViewController 使用 PaginatedQueryManager

**决策**：使用 `PaginatedQueryManager` 管理批量任务列表

**理由**：
- 支持分页加载和无限滚动
- 自动处理加载状态和错误
- 支持乐观更新

**考虑的替代方案**：
- 使用 `createAutoKeyMiniQueryClient`：被拒绝，因为需要分页功能

**实现**：
```typescript
export class BatchListViewController {
  readonly bulkTaskQueryManager = new PaginatedQueryManager(getBulkTaskList);

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  constructor() {
    this.combinedStore = createCombinedStore([
      this.bulkTaskQueryManager.store,
    ] as const);
  }

  async fetchTasks() {
    await this.bulkTaskQueryManager.fetch({ page_size: 20 });
  }

  // 轮询刷新
  private pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  startPolling() {
    this.pollingIntervalId = setInterval(() => {
      this.bulkTaskQueryManager.fetch({ page_size: 20 });
    }, 3000);
  }

  stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  dispose() {
    this.stopPolling();
    this.bulkTaskQueryManager.dispose();
  }
}
```

#### 2.2 NewBatchViewController 直接调用 API

**决策**：不使用 Query Manager，直接调用 API

**理由**：
- 创建任务是一次性操作，不需要缓存
- 需要立即获取返回的 ID 并跳转

**实现**：
```typescript
export class NewBatchViewController {
  async handleGenerate(sources: Array<{ url: string; batch_size: number }>) {
    try {
      const result = await createBulkTask({ sources });
      // 立即跳转到预览页面
      router.navigate({
        to: '/tool/cta-generator/batch-preview',
        search: { bulk_task_id: result.bulk_generate_task_id },
      });
    } catch (error) {
      // 显示错误提示
      Toast.error('创建批量任务失败');
    }
  }
}
```

#### 2.3 BatchPreviewViewController 使用 createAutoKeyMiniQueryClient

**决策**：使用 `createAutoKeyMiniQueryClient` 管理预览项查询

**理由**：
- 需要根据 `bulk_task_id` 动态查询
- 支持自动缓存和重新获取

**实现**：
```typescript
export class BatchPreviewViewController {
  private bulkTaskId: string | undefined;

  readonly previewQueryClient = createAutoKeyMiniQueryClient(() => ({
    fn: getPreviewList,
    fnParams: [
      {
        bulk_task_id: this.bulkTaskId,
        page_size: 100,
      },
    ] as const,
    enabled: Boolean(this.bulkTaskId),
  }));

  readonly combinedStore: CombinedStore<ReadonlyStoreApi<unknown>[]>;

  constructor() {
    this.combinedStore = createCombinedStore([
      this.previewQueryClient.store,
    ] as const);
  }

  setBulkTaskId(id: string) {
    this.bulkTaskId = id;
    // 触发重新查询
  }
}
```

### 3. 轮询策略

#### 3.1 批量任务列表轮询

**决策**：在列表页面使用 `setInterval` 每 3 秒刷新一次

**理由**：
- 实时显示任务状态和进度
- 实现简单，不需要复杂的轮询管理

**考虑的替代方案**：
- 使用 `ProcessingTaskManager`：被拒绝，因为这是简单的定时刷新，不是异步任务轮询

**状态管理**：
- 在 `bootstrap()` 时启动轮询
- 在 `dispose()` 时停止轮询

### 4. 数据结构设计

#### 4.1 批量任务类型定义

```typescript
export interface BulkTaskItem {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  created_at: string;
  updated_at: string;
  error_message: string | null;
  progress: {
    total: number;
    queued: number;
    running: number;
    done: number;
    failed: number;
  };
  sources: Array<{
    url: string;
    product_id: string;
    batch_size: number;
    items_summary: {
      total: number;
      queued: number;
      running: number;
      done: number;
      failed: number;
    };
  }>;
}

export interface BulkTaskDetail extends BulkTaskItem {
  // 详情包含更多信息
}
```

#### 4.2 预览项类型定义

```typescript
export interface PreviewItem {
  id: string;
  product_id: string;
  bulk_generate_task_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  prefill: {
    original_background_url: string;
    generated_background_url: string;
    background_prompt: string;
    headline: string;
    headline_color: string;
    subtitle: string;
    subtitle_color: string;
    cta_button_text: string;
    cta_button_color: string;
    cta_text_color: string;
    cta_button_link: string;
    social_proof: V2ConversionWidget | null;
    discount_badge: V2ConversionWidget | null;
    special_offer_timer: V2ConversionWidget | null;
    top_banner: V2ConversionWidget | null;
    visual_vibe: string;
    logo_url?: string;
  };
  error_message: string | null;
}
```

## Data Model

### API Response Format

#### 创建批量任务
```
POST /api/llm-editor/cta/batch/

Request:
{
  "sources": [
    {"url": "https://example.com/product1", "batch_size": 5},
    {"url": "https://example.com/product2", "batch_size": 3}
  ]
}

Response (201):
{
  "bulk_generate_task_id": "uuid-xxx",
  "task_id": "celery-task-id",
  "status": "pending"
}
```

#### 获取批量任务列表
```
GET /api/llm-editor/cta/batch/?page_size=20

Response (200):
{
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid-xxx",
      "name": "Batch Task - Jan 28, 10:30 AM",
      "status": "running",
      "created_at": "2025-01-28T10:00:00Z",
      "updated_at": "2025-01-28T10:05:00Z",
      "error_message": null,
      "progress": {
        "total": 8,
        "queued": 2,
        "running": 3,
        "done": 2,
        "failed": 1
      }
    }
  ]
}
```

#### 获取预览项列表
```
GET /api/llm-editor/cta/previews/?bulk_task_id=xxx&page_size=100

Response (200):
{
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "item-uuid-1",
      "product_id": "product-uuid-1",
      "status": "done",
      "prefill": {
        "original_background_url": "https://...",
        "generated_background_url": "https://...",
        "headline": "Amazing Product",
        ...
      },
      "error_message": null
    }
  ]
}
```

## Component Structure

### 前端模块结构
```
webserver/frontend/feature/tool.cta-generator/
├── api/
│   └── index.ts                          # 修改：添加批量任务和预览项 API
├── type.ts                               # 修改：添加类型定义
├── manager/
│   ├── batch-list-view-controller.ts     # 修改：使用 PaginatedQueryManager
│   └── batch-preview-view-controller.ts  # 修改：使用 createAutoKeyMiniQueryClient
├── context/
│   └── batch-list-view-controller-context.tsx  # 保持不变
├── page/
│   ├── batch/index.tsx                   # 修改：从 combinedStore 获取数据
│   ├── new-batch.tsx                     # 修改：调用真实 API
│   └── batch-preview.tsx                 # 修改：从 combinedStore 获取数据
└── util/
    └── zip-downloader.ts                 # 新建：批量下载工具
```

## Architecture Patterns

### Manager-ViewController 模式

- **BatchListViewController**：
  - 使用 `PaginatedQueryManager` 管理任务列表
  - 添加轮询机制（`setInterval`）
  - 提供 `startPolling()` 和 `stopPolling()` 方法

- **NewBatchViewController**：
  - 直接调用 `createBulkTask` API
  - 成功后立即跳转
  - 使用 Toast 显示错误

- **BatchPreviewViewController**：
  - 使用 `createAutoKeyMiniQueryClient` 管理预览项查询
  - 根据 `bulk_task_id` 动态查询
  - 管理多个 CreatifyHostController 实例

### 状态管理

- 使用 `combinedStore` 组合多个 store
- 使用 `useCombinedStore` 在组件中获取状态
- Query Manager 自动管理加载状态和错误

## Risks / Trade-offs

### Risk: 轮询可能增加服务器负载

**风险**：每 3 秒刷新一次可能增加服务器压力

**缓解措施**：
- 使用分页限制返回数据量
- 考虑添加缓存机制
- 后端可以添加速率限制

### Risk: CreatifyHostController 实例管理复杂

**风险**：预览页需要管理多个 Controller 实例，可能导致内存泄漏

**缓解措施**：
- 在 `dispose()` 时清理所有 Controller
- 使用 Map 管理，key 为预览项 ID
- 定期清理不再使用的 Controller

### Trade-off: 立即跳转 vs 等待完成

**决策**：API 返回后立即跳转，不等待任务完成

**影响**：
- 用户可能看到空的预览项
- 需要在预览页显示加载状态

**评估**：
- 用户体验更好，立即看到反馈
- 预览页可以通过轮询显示进度

## Open Questions

无（所有关键问题已在讨论中确认）

## Migration Plan

### Steps

1. 添加 API 客户端函数和类型定义
2. 修改 `BatchListViewController` 使用 `PaginatedQueryManager`
3. 修改批量列表页使用真实数据
4. 修改 `NewBatchViewController` 调用真实 API
5. 修改 `BatchPreviewViewController` 使用真实 API
6. 实现批量下载功能
7. 测试完整流程

### Rollback

- 恢复 `BatchListViewController` 的 Mock 数据
- 恢复 `NewBatchViewController` 的旧 API 调用
- 恢复 `BatchPreviewViewController` 的 URL 参数解析

## References

### 现有代码参考
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - 当前 Mock 实现
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 当前 API 调用

### 后端 API 文档
- `.luokingspec/archive/add-cta-batch-backend/design.md` - 后端设计文档
- `.luokingspec/archive/add-cta-batch-backend/proposal.md` - 后端需求文档

### 相关文档
- `.project-rules/frontend/architecture.md` - 前端架构规范
- `.project-rules/frontend/utility-managers.md` - 工具管理器使用
