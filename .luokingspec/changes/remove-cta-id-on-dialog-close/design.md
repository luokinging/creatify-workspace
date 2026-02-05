## Context

在 CTA 批量预览页面中，用户可以点击 Edit 按钮打开预览对话框编辑单个 CTA。为了标识当前正在编辑的 CTA，系统会在 URL 中添加 `cta_id` 参数。

当前实现中，打开 Dialog 时会添加 `cta_id` 参数，但关闭时没有移除该参数，导致 URL 状态与实际页面状态不一致。

## Goals / Non-Goals

### Goals

- 关闭 Dialog 时从 URL 中移除 `cta_id` 参数
- 保留其他 URL 参数（如 `jobId`）
- 避免产生额外的浏览器历史记录
- 保持 URL 与页面状态的一致性

### Non-Goals

- 处理浏览器后退按钮的场景（用户明确表示仅处理 Dialog 关闭）
- 处理通过 URL 直接访问带 `cta_id` 参数的场景
- 修改路由定义或参数验证逻辑

## Decisions

### 1. 在 CTAPreviewDialog 组件中处理 URL 更新

**决策**：在 `CTAPreviewDialog` 组件的 `handleOpenChange` 函数中处理 URL 参数的移除。

**理由**：
- `CTAPreviewDialog` 组件已经处理了 Dialog 的打开/关闭逻辑
- 在组件内部处理 URL 更新可以保持逻辑的内聚性
- 不需要修改调用方（`batch-preview.tsx`）的代码

**考虑的替代方案**：
- **在 `batch-preview.tsx` 中处理**：被拒绝，因为这样会将逻辑分散在多个文件中，增加维护成本
- **使用 React Router 的监听器**：被拒绝，因为用户明确表示只处理 Dialog 关闭场景，不需要监听路由变化

### 2. 使用 `replace: true` 避免产生历史记录

**决策**：使用 `router.navigate` 的 `replace: true` 选项更新 URL。

**理由**：
- 关闭 Dialog 不应该产生新的浏览器历史记录
- 用户点击后退按钮应该返回到上一个页面，而不是在当前页面和不同参数之间切换

**考虑的替代方案**：
- **使用 `push` 模式**：被拒绝，因为会产生额外的历史记录，影响用户体验

### 3. 条件性更新 URL

**决策**：只在 URL 中确实存在 `cta_id` 参数时才执行更新操作。

**理由**：
- 避免不必要的路由更新
- 提高性能和用户体验

## Data Model

### Existing Model (No Changes Required)

使用现有的 URL 参数结构：
```typescript
{
  jobId?: string;
  cta_id?: string;
}
```

## Component Structure

```
webserver/frontend/feature/tool.cta-generator/
├── component/
│   └── cta-preview-dialog.tsx    # 需要修改：添加 URL 参数移除逻辑
└── page/
    └── batch-preview.tsx         # 无需修改
```

## Architecture Patterns

### Router Navigation Pattern

使用 TanStack Router 的导航 API：
```typescript
router.navigate({
  to: '/tool/cta-generator/batch-preview',
  search: { ...search, cta_id: undefined },
  replace: true,
});
```

**为什么使用这个模式**：
- 项目已经使用 `@tanstack/react-router`
- 与现有的路由管理方式一致
- 类型安全且支持参数验证

## Risks / Trade-offs

### Risk: Dialog 关闭时机与 URL 更新的同步问题

**风险**：如果 Dialog 关闭和 URL 更新不同步，可能导致短暂的状态不一致。

**缓解措施**：
- 在 `handleOpenChange` 中同步处理 URL 更新
- 使用 `replace: true` 确保不会产生中间状态

### Trade-off: 在组件内部直接操作 Router

**决策**：在 `CTAPreviewDialog` 组件内部直接调用 `router.navigate`。

**影响**：
- 优点：逻辑集中，易于理解和维护
- 缺点：组件与路由的耦合度增加

**为什么可以接受**：
- 该组件专门用于在特定路由下使用
- 项目中已有类似的模式（如 `batch-preview.tsx` 中的路由导航）

## Open Questions

无

## Migration Plan

### Steps

1. 修改 `CTAPreviewDialog` 组件的 `handleOpenChange` 函数
2. 添加 URL 参数移除逻辑
3. 测试各种关闭场景
4. 提交代码审查

### Rollback

- 如果出现问题，可以直接回滚代码更改
- 不涉及数据库变更或 API 变更，回滚风险低

## References

- 相关代码文件：
  - `webserver/frontend/feature/tool.cta-generator/component/cta-preview-dialog.tsx`
  - `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx`
  - `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/batch-preview.tsx`
- TanStack Router 文档：https://tanstack.com/router/latest/docs/framework/react/guide/navigation
