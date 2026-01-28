## Context

当前 CTA Generator 工具仅支持 Single 模式，用户每次只能生成一个 CTA HTML。为了提高效率，需要添加 Batch 模式，允许用户从多个 URL/Product 批量生成和预览 CTA HTML。

现有的实现使用 iframe 加载 HTML，通过 Comlink 与主站通信。主站提供 `CreatifyHostController` 供 iframe 调用，实现产品选择、图片生成等功能。

本次变更需要：
1. 扩展 `CreatifyHostController` 的能力，支持模式管理和功能注册
2. 创建新的页面和路由来支持 Batch 工作流
3. 实现批量生成和预览功能
4. 保持与现有 Single 模式的兼容性

## Goals / Non-Goals

### Goals

- 支持从多个 URL/Product 批量生成 CTA HTML
- 提供批量预览和管理界面
- 支持批量下载打包功能
- 保持现有 Single 模式功能不变
- 使用 MVC 模式组织代码，确保可维护性

### Non-Goals

- 不修改 iframe HTML 文件（假定 HTML 已支持所需功能）
- 不新增后端 API endpoint（使用现有 API）
- 不实现数据持久化（使用前端 mock 数据）
- 不实现用户权限管理

## Decisions

### 1. 模式管理方案

**决策**：在 `CreatifyHostController` 中添加 `getMode()` 方法，返回当前模式类型（'PreviewOnly' | 'Generator'）

**理由**：
- iframe 需要根据模式决定是否显示操作部分
- PreviewOnly 模式下只展示预览，不展示生成操作
- 通过方法调用而不是初始化参数，更灵活

**考虑的替代方案**：
- 通过初始化参数传递模式：被拒绝，因为需要在运行时可能需要切换模式
- 通过 URL 参数传递：被拒绝，因为 iframe 不应该依赖外部 URL

### 2. 功能注册机制

**决策**：使用 Map 存储注册的函数，key 为 iframe 标识，value 为函数引用

**理由**：
- 支持多个 iframe 实例同时注册
- 每个 iframe 独立管理自己的函数
- 便于查找和调用

**考虑的替代方案**：
- 使用单个函数引用：被拒绝，因为不支持多实例场景
- 使用数组存储：被拒绝，因为查找效率低

### 3. Controller 管理策略

**决策**：在 Batch 预览页面的 ViewController 中使用 Map 管理多个 `CreatifyHostController` 实例

**理由**：
- 每个 iframe 需要独立的 Controller 实例
- Map 提供高效的查找和管理
- 使用 index 或 url 作为 key，便于定位

**考虑的替代方案**：
- 使用数组存储：被拒绝，因为查找和管理不便
- 使用单个 Controller 实例：被拒绝，因为无法区分不同 iframe 的注册函数

### 4. 数据存储方案

**决策**：Batch 列表页面使用完全静态的 mock 数据，不进行数据持久化

**理由**：
- 需求明确说明"暂时前端 mock就好"
- 简化实现，聚焦核心功能
- 后续可以轻松替换为真实 API

**考虑的替代方案**：
- 使用 localStorage：被拒绝，因为用户确认使用"完全静态 mock"
- 使用 sessionStorage：被拒绝，理由同上

## Data Model

### Existing Model (No Changes Required)

使用现有的类型定义：
- `AnalyzeProductParams`
- `V2CreativeSuggestions`
- `TransferProductInfo`

### New/Modified Model

```typescript
// 模式类型
type HostMode = 'PreviewOnly' | 'Generator';

// Batch 任务信息（mock 数据）
interface BatchTask {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  createdAt: string;
  previewCount: number;
  sources: BatchSource[];
}

// Batch 来源
interface BatchSource {
  type: 'product' | 'url';
  value: string;
  size: number;
  name?: string;
  thumbnail?: string;
}

// 预览项数据
interface PreviewItemData {
  url: string;
  mode: HostMode;
  index: number;
}
```

### API Response Format

使用现有 API，无需新增：
- `generateCreativeSuggestionsV2` - 生成创意建议
- `generateProductCta` - 分析产品

## Component Structure

```
webserver/frontend/feature/tool.cta-generator/
├── api/
│   └── index.ts (现有，无需修改)
├── manager/
│   ├── batch-list-view-controller.ts (新建)
│   ├── new-batch-view-controller.ts (新建)
│   └── batch-preview-view-controller.ts (新建)
├── component/
│   ├── batch-list-item.tsx (新建)
│   ├── preview-iframe-item.tsx (新建)
│   └── cta-preview.tsx (现有)
├── page/
│   ├── entry.tsx (新建)
│   ├── batch-list.tsx (新建)
│   ├── batch-list-content.tsx (新建)
│   ├── new-batch.tsx (新建)
│   ├── new-batch-content.tsx (新建)
│   ├── batch-preview.tsx (新建)
│   ├── batch-preview-content.tsx (新建)
│   ├── generator.tsx (新建，复用现有功能)
│   ├── test.tsx (现有)
│   ├── prod.tsx (现有)
│   └── legacy.tsx (现有)
├── util/
│   ├── zip-downloader.ts (新建)
│   └── ... (现有工具)
└── type.ts (现有，可能需要扩展)
```

路由结构：
```
.vite/routes/(desktop)/tool/cta-generator/
├── index.tsx (现有)
├── test.tsx (新建 - 入口页)
├── batch.tsx (新建 - Batch 列表)
├── new-batch.tsx (新建 - 新建 Batch)
├── batch-preview.tsx (新建 - Batch 预览)
├── generator.tsx (新建 - Single 生成)
└── legacy.tsx (现有)
```

## Architecture Patterns

- **Manager 模式**：所有页面使用 ViewController + Manager 模式管理业务逻辑
- **Context 模式**：每个页面创建对应的 Context 和 Provider
- **组件复用**：`PreviewIframeItem` 组件在列表页和预览页复用
- **Controller 管理**：使用 Map 管理多个 CreatifyHostController 实例

## Risks / Trade-offs

### Risk: 多 iframe 并行加载性能

**风险**：同时加载多个 iframe 可能导致性能问题

**缓解措施**：
- 使用懒加载，只加载可视区域的 iframe
- 限制同时加载的 iframe 数量
- 使用 loading 状态优化用户体验

### Trade-off: Mock 数据 vs 真实 API

**决策**：使用 Mock 数据

**影响**：
- 无法真实体验完整流程
- 后续需要替换为真实 API

## Open Questions

无

## Migration Plan

### Steps

1. 扩展 `CreatifyHostController` (T-001)
2. 创建入口页面和路由 (T-002)
3. 创建 Batch 列表页面 (T-003, T-004)
4. 创建新建 Batch 页面 (T-005)
5. 创建 Batch 预览页面 (T-006)
6. 创建 Single 生成页面 (T-007)
7. 实现批量生成数据驱动 (T-008)
8. 实现批量下载功能 (T-009)

### Rollback

- 所有新功能都是独立的页面和路由
- 不影响现有 Single 模式功能
- 可以通过删除新路由回滚

## References

- `.doc/images/list-item.png` - 列表项设计
- `.doc/images/new-batch.png` - 新建页面设计
- `.doc/images/preview.png` - 预览页面设计
- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` - 现有实现
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - Controller 实现
- `webserver/frontend/feature/tool.ad-delivery/page/choose-launch-new.tsx` - 入口页样式参考
