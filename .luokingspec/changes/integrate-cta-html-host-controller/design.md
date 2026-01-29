# Design: CTA HTML 与 Host Controller 集成

## Context

Host 通过 Comlink 将 `CreatifyHostController` 暴露给 iframe；iframe 在收到 `CREATIFY_HOST_READY` 后通过 `Comlink.wrap(endpoint)` 得到 `window.hostController` 并派发 `hostControllerReady`。当前 HTML 未在 `hostControllerReady` 后做任何注册或模式判断，也未实现“数据变更回传”的 Host 侧接口。

## Goals / Non-Goals

### Goals

- 明确 Host 与 HTML 的契约：注册项（export、updateWithData）、模式（getMode）、数据回传（notifyDataChange）。
- 明确 PreviewOnly 的展示规则：仅右侧预览、无左侧编辑、无 phone-frame 黑色边框。
- 明确数据变更 payload 格式（与 V2CreativeSuggestions 兼容）及触发时机（防抖/字段变更）。

### Non-Goals

- Host 端具体“同步保存”实现（调用哪个 PATCH、节流策略）不在本设计内；仅约定 Host 能注册回调并收到 payload。

## Decisions

### 1. Host 侧：iframe 数据变更回传

**决策**：在 `CreatifyHostController` 上增加：
- `registerOnDataChange(fn: (data: UpdateWithDataPayload) => void): void` — Host 注册回调；
- 供 iframe 调用的方法（通过 Comlink 暴露）：`notifyDataChange(data: UpdateWithDataPayload): void`，内部调用已注册的 `fn`。

**理由**：用户在 iframe 内编辑后需通知 Host 同步保存；由 Host 注册回调、iframe 调用单一方法，与现有 `registerUpdateWithData` / `updateWithData` 方向相反、模式一致。

**考虑的替代方案**：
- iframe 通过 `postMessage` 自发通知：被拒绝，因希望统一走 Comlink 与 controller 契约。
- Host 轮询 iframe 拉取数据：被拒绝，因增加复杂度和延迟。

### 2. 数据变更 Payload 格式

**决策**：`notifyDataChange` 的 payload 与 `UpdateWithDataPayload`（即 `V2CreativeSuggestions`）兼容。iframe 在编辑后从当前表单/预览状态序列化出与 V2CreativeSuggestions 同构的对象（含 background、headline、subtitle、vibe、颜色、widget 开关等）传给 Host。

**理由**：Host 端 PATCH 预览项时可直接使用同一结构；类型与 prefill 一致，减少转换。

### 3. HTML 侧：何时触发 notifyDataChange

**决策**：在用户可编辑的字段变更后，使用防抖（例如 300–500ms）调用 `hostController.notifyDataChange(currentData)`。具体触发点包括但不限于：背景/文案/vibe/颜色/CTA/控件开关等变更。若 Host 未暴露 `notifyDataChange`（旧版或非嵌入场景），调用前做存在性判断，忽略错误或静默失败。

**理由**：避免每次按键都触发，同时保证编辑结果能在一段短时间后回传。

### 4. PreviewOnly 布局实现

**决策**：
- 左侧：整块编辑面板（`.ui-panel` 及其父级/兄弟结构）在 `getMode() === 'PreviewOnly'` 时隐藏（例如 `display: none` 或移除出布局）。
- 右侧：仅保留预览内容区域。当前预览由 `#exportArea`（带 class `phone-frame`）承载；phone-frame 的黑色边框来自 CSS `border: 12px solid #1F2937`。PreviewOnly 下：
  - 保留 `#exportArea` 内部内容（纯预览区域），
  - 去掉该容器的“手机外框”样式（即去掉 12px 黑色边框与圆角外框效果），或使用一个仅包含“内部预览”的包装节点，不应用 `.phone-frame` 的边框样式。
- 页面根布局在 PreviewOnly 下只渲染上述纯预览区域，不渲染任何其它 UI（如 DOWNLOAD 按钮、左侧表单等）。

**理由**：需求明确为“只展示原来 html 内部右侧的预览区域（不包含边框）、纯预览区域、除此之外不能渲染任何内容”。

### 5. 导出 HTML 的注册实现

**决策**：在 `hostControllerReady` 后，用现有 `serializePreviewToHTML()` 得到 HTML 字符串，转为 Blob（`new Blob([html], { type: 'text/html' })`），在异步函数中返回该 Blob，并将该函数通过 `hostController.registerExportHtml(fn)` 注册。若已有“DOWNLOAD”本地逻辑，可复用同一序列化路径，仅增加“返回 Blob 给 Host”的出口。

**理由**：Host 已提供 `registerExportHtml` 与 `getExportedHtml()`，只需 iframe 提供实现；与现有导出逻辑一致，避免重复实现。

### 6. Prefill 应用（registerUpdateWithData）

**决策**：iframe 向 Host 注册 `registerUpdateWithData(callback)`，在 callback 内接收 `UpdateWithDataPayload`（V2CreativeSuggestions），并据此更新：
- 背景图（original / AI remix 若有）、背景模式；
- 文案：headline、subtitle、CTA 文案与链接；
- 颜色、vibe（visual_vibe）、控件开关（social_proof、discount_badge、special_offer_timer、top_banner 等）；
- logo_url 若有则设置 logo。
更新方式为设置表单控件与预览 DOM 状态，并触发已有渲染/同步逻辑，使预览区域与 prefill 一致。

**理由**：仅使用“Host 主动推送”的 `registerUpdateWithData` 机制，不在 iframe 内拉取 prefill；与既有约定一致。

### 7. Host 端 CtaPreviewOnlyIframe 在 iframe 就绪后推送 prefill

**决策**：`CtaPreviewOnlyIframe` 组件增加可选 prop `prefill`（类型与 `PreviewItemPrefill` / `UpdateWithDataPayload` 兼容）。在 iframe 的 `load` 事件后，Host 已 `postMessage(CREATIFY_HOST_READY)` 且 iframe 会同步注册 `registerUpdateWithData`；Host 在 `postMessage` 之后延迟一短时间（例如 100–200ms）调用 `controller.updateWithData(prefill)`，将服务端下发的 prefill 推入 iframe。若 `prefill` 未传或为空，则不调用 `updateWithData`。

**理由**：iframe 注册是异步的（在 message 处理中执行），短延迟可保证 iframe 已注册 callback 后再推送，避免漏推。`PreviewItemPrefill` 与 iframe 内 `applyPrefillFromHost` 已兼容（如 `generated_background_url` / `background_image_url` 双字段支持），无需额外适配层。

### 8. batch 页每个 item 右侧展示真实 preview 列表（与现有不一致）

**决策**：每个 `BatchListItem` 对应一个 bulk task（`item.id`）。不再使用按 `task.sources` 与 `batch_size` 合成的假 key（如 `task.id-p0-0`）；改为对该 task 拉取 `getPreviewList({ bulk_task_id: item.id })`，右侧按 `results`（`PreviewItem[]`）渲染，每个 preview 一个 `CtaPreviewOnlyIframe`，`key=previewItem.id`，`controller=vc.getControllerForKey(previewItem.id, previewItem.prefill)`，并传入 `prefill=previewItem.prefill`（由 T-005 的 iframe 就绪后推送逻辑生效）。preview 列表可为每 task 独立 query（如 `useQuery` / 或 VC 内按 task 维度的 cache），加载中可显示占位或骨架。

**理由**：用户要求“展示当前 task 下面所有 preview 的 ai generated image”，与现有“按 source 合成若干占位”行为不一致；必须改为真实 preview 列表与 prefill，才能显示 AI 生成图与文案。

### 9. batch 页每个 item 的 Download 真实生效

**决策**：Download 使用的 key 列表与该 task 的 preview 列表一致（即 `previewItem.id` 的数组）。`BatchListViewController` 暴露类型安全的下载接口，例如 `downloadBatchForKeys(keys: string[], options?: DownloadOptions): Promise<DownloadResult>`，内部使用现有 `controllerMap` 与 `zip-downloader.downloadFromControllerMap`。`BatchListItem` 的 handleDownload 传入当前 task 的 preview id 列表并调用该接口，不再使用 `(vc as any).controllerMap`。

**理由**：controller 与 iframe 一一对应且 key 为 preview id 时，每个 controller 已由对应 iframe 注册 `registerExportHtml`，`getExportedHtml()` 才能返回有效 Blob；Download 与右侧展示使用同一批 key，保证一致性。

## Data Model

### Existing Model (No Changes Required)

- `V2CreativeSuggestions` / `UpdateWithDataPayload`：见 `webserver/frontend/feature/tool.cta-generator/type.ts`。用于 prefill 与 notifyDataChange payload。

### New/Modified (Host Controller)

- `CreatifyHostController` 新增：
  - 私有：`onDataChangeFn: ((data: UpdateWithDataPayload) => void) | null`
  - 公开：`registerOnDataChange(fn)`、`notifyDataChange(data)`（后者供 iframe 通过 Comlink 调用）。

## Component Structure

### Host

- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts`：在现有 `registerExportHtml` / `registerUpdateWithData` 旁增加 `registerOnDataChange` 与 `notifyDataChange`。
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx`：增加可选 `prefill` prop；iframe load 且 postMessage CREATIFY_HOST_READY 后，短延迟调用 `controller.updateWithData(prefill)`。
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx`：向 `CtaPreviewOnlyIframe` 传入 `prefill={item.prefill}`（已有 controller 与 item.id）。
- `webserver/frontend/feature/tool.cta-generator/page/batch/components/batch-list-item.tsx`：拉取 `getPreviewList({ bulk_task_id: item.id })`，右侧按 `results` 渲染 `CtaPreviewOnlyIframe`，key=previewItem.id，传入 prefill；Download 使用该 task 的 preview id 列表调用 VC 暴露的下载接口。
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts`：暴露 `downloadBatchForKeys(keys, options)`，内部使用 controllerMap 与 zip-downloader。

### HTML

- `webserver/frontend/public/iframe/cta-generator-test.html`：
  - 在 `hostControllerReady` 监听中：调用 `getMode()`，注册 `registerExportHtml`、`registerUpdateWithData`，若为 PreviewOnly 则应用布局切换（隐藏左侧、仅右侧预览、去掉 phone-frame 边框）。
  - 在编辑相关逻辑中：防抖后调用 `hostController.notifyDataChange(currentData)`（若存在）。

## Architecture Patterns

- **双向契约**：Host 暴露 controller；iframe 注册“导出”与“接收 prefill”回调，并调用“数据变更”方法。与现有 Comlink + 注册模式一致。
- **模式驱动布局**：通过 `getMode()` 在 HTML 内切换 Generator / PreviewOnly 两套布局，避免两套 HTML 文件。

## Risks / Trade-offs

- **notifyDataChange 调用频率**：若防抖时间过短仍可能较频繁；可由 Host 端对 PATCH 做节流/合并缓解。
- **PreviewOnly 与导出**：PreviewOnly 下不显示 DOWNLOAD 按钮，但 Host 仍可通过 `getExportedHtml()` 拉取导出；若需“仅预览不可导出”可由 Host 不调用 `getExportedHtml()` 实现。

## References

- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts`
- `webserver/frontend/feature/tool.cta-generator/type.ts`（V2CreativeSuggestions、PreviewItemPrefill）
- `webserver/frontend/public/iframe/cta-generator-test.html`
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx`
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx`、`batch/index.tsx`、`batch/components/batch-list-item.tsx`
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts`、`batch-preview-view-controller.ts`
- `webserver/frontend/feature/tool.cta-generator/util/zip-downloader.ts`
- `.luokingspec/archive/002.integrate-cta-batch-backend-api`
- `.luokingspec/archive/cta-generator-batch-mode`
