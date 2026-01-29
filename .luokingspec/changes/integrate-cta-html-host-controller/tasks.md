# Tasks: CTA HTML 与 Host Controller 集成

---

# T-001 Host：扩展 CreatifyHostController 支持 iframe 数据变更回传

## 需求描述

在 `CreatifyHostController` 上增加“iframe 通知数据变更”的能力：Host 注册回调，iframe 调用 `notifyDataChange(payload)` 时触发该回调，便于 Host 端执行同步保存（如 PATCH 预览项）。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 新增 `registerOnDataChange(fn: (data: UpdateWithDataPayload) => void): void`，用于 Host 注册回调。
- 新增供 iframe 通过 Comlink 调用的方法 `notifyDataChange(data: UpdateWithDataPayload): void`，内部调用已注册的回调（若已注册）。
- 在 `ICreatifyHostController` 接口中声明上述方法。
- payload 类型与现有 `UpdateWithDataPayload`（V2CreativeSuggestions）一致。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口与规范

**前端Code Point:**
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` — Controller 实现
- `webserver/frontend/feature/tool.cta-generator/type.ts` — V2CreativeSuggestions / UpdateWithDataPayload

**其他:**
- 本变更 `design.md` — 决策与契约
- Comlink：controller 暴露给 iframe 的方法均可被 iframe 调用

## 注意点

- 未注册回调时 `notifyDataChange` 调用应为 no-op，不抛错。
- 保持与现有 `registerExportHtml` / `registerUpdateWithData` 的命名与风格一致。

## Scenario

### Scenario 1: Host 注册数据变更回调

    **场景描述：**
    - **前置条件**：Host 已创建 CreatifyHostController 并 expose 给 iframe。
    - **操作步骤**：Host 调用 `controller.registerOnDataChange((data) => { /* 保存逻辑 */ })`。
    - **预期结果**：回调被存储，后续 iframe 调用 `notifyDataChange(payload)` 时该回调被调用并收到 payload。

### Scenario 2: iframe 调用 notifyDataChange

    **场景描述：**
    - **前置条件**：Host 已注册 `registerOnDataChange` 回调。
    - **操作步骤**：iframe 调用 `hostController.notifyDataChange(data)`（data 与 V2CreativeSuggestions 同构）。
    - **预期结果**：Host 侧注册的回调被调用，参数为传入的 data。

## Checklist

- [x] C-001 `ICreatifyHostController` 增加 `registerOnDataChange` 与 `notifyDataChange` 声明
- [x] C-002 `CreatifyHostController` 实现 `registerOnDataChange` 存储回调
- [x] C-003 `CreatifyHostController` 实现 `notifyDataChange` 调用已注册回调（未注册时 no-op）
- [x] C-004 类型使用 `UpdateWithDataPayload`，与现有 prefill 一致
- [x] C-005 现有方法（getMode、registerExportHtml、registerUpdateWithData 等）行为不变

---

# T-002 HTML：注册 registerExportHtml、registerUpdateWithData 并消费 getMode / updateWithData

## 需求描述

在 `hostControllerReady` 后，向 Host 注册 `registerExportHtml`（导出函数返回 Blob）和 `registerUpdateWithData`（接收 Host 推送的 prefill 并应用到表单与预览）；调用 `getMode()` 并根据结果在后续任务中支持 PreviewOnly 布局（本任务仅完成注册与 prefill 应用，布局切换见 T-003）。

**需求类型**：Feature

**涉及领域**：前端（HTML 文件）

**功能要求**：
- 监听 `hostControllerReady`，在回调中：调用 `hostController.getMode()` 并保存结果（供 T-003 使用）；调用 `hostController.registerExportHtml(fn)`，其中 `fn` 为异步函数，内部使用现有 `serializePreviewToHTML()` 得到 HTML 字符串，转为 Blob 后返回。
- 调用 `hostController.registerUpdateWithData(callback)`，在 callback 内接收 `UpdateWithDataPayload`（与 V2CreativeSuggestions 同构），并更新：背景图/模式、headline、subtitle、CTA 文案与链接、颜色、vibe、控件开关、logo 等，使预览与 prefill 一致。
- 若 `hostController` 或上述方法不存在（非嵌入或旧版），做存在性判断，避免报错。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/public/iframe/cta-generator-test.html` — 需修改的 HTML
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` — 接口约定
- `webserver/frontend/feature/tool.cta-generator/type.ts` — V2CreativeSuggestions 字段

**其他:**
- 本变更 `design.md` — prefill 应用与导出契约
- 指引：`.luokingspec/archive/002.integrate-cta-batch-backend-api`、`.luokingspec/archive/cta-generator-batch-mode`

## 注意点

- 导出函数需返回 `Promise<Blob>`（或 `Promise<File>`），与 `registerExportHtml` 签名一致。
- prefill 应用需覆盖 V2CreativeSuggestions 中与当前 HTML 表单/预览对应的字段，并触发已有渲染逻辑。
- 不在此任务内改布局；仅注册与消费数据、保存 getMode 结果。

## Scenario

### Scenario 1: Host 拉取导出 HTML

    **场景描述：**
    - **前置条件**：iframe 已触发 hostControllerReady 并完成 registerExportHtml 注册。
    - **操作步骤**：Host 调用 `getExportedHtml()`（即触发已注册的导出函数）。
    - **预期结果**：iframe 内导出函数执行，返回由当前预览序列化得到的 HTML 的 Blob。

### Scenario 2: Host 推送 prefill

    **场景描述：**
    - **前置条件**：iframe 已注册 registerUpdateWithData，Host 持有 V2CreativeSuggestions 数据。
    - **操作步骤**：Host 调用 `updateWithData(data)`。
    - **预期结果**：iframe 内 callback 被调用，表单与预览区域更新为 data 中的背景、文案、vibe、颜色、控件等。

### Scenario 3: 获取模式

    **场景描述：**
    - **前置条件**：iframe 已连接 hostController。
    - **操作步骤**：在 hostControllerReady 回调中调用 `hostController.getMode()`。
    - **预期结果**：得到 `'PreviewOnly'` 或 `'Generator'`，结果可被 T-003 用于布局切换。

## Checklist

- [x] C-001 在 hostControllerReady 中调用 getMode() 并保存结果
- [x] C-002 注册 registerExportHtml，导出函数使用 serializePreviewToHTML 并返回 Blob
- [x] C-003 注册 registerUpdateWithData，callback 内根据 V2CreativeSuggestions 更新背景/文案/vibe/颜色/控件/logo
- [x] C-004 对 hostController 及方法做存在性判断，避免非嵌入场景报错
- [x] C-005 Host 调用 updateWithData 后预览区域与 data 一致

---

# T-003 HTML：PreviewOnly 模式下仅展示右侧纯预览区域（无左侧、无手机边框）(deps: T-002)

## 需求描述

当 `getMode() === 'PreviewOnly'` 时，完全隐藏左侧编辑面板，整个页面只渲染右侧的预览区域；且不渲染 phone-frame 的黑色边框（纯预览内容，无手机外框）。

**需求类型**：Feature

**涉及领域**：前端（HTML 文件）

**功能要求**：
- 在 hostControllerReady 中已取得 mode（T-002）；若为 `PreviewOnly`：隐藏左侧编辑面板（如 `.ui-panel` 及其所在布局区域）；仅保留右侧预览内容；对承载预览的容器（当前为 `#exportArea` / `.phone-frame`）去掉“手机边框”样式（如 12px 黑色边框与圆角外框），仅保留内部预览区域。
- 除上述纯预览区域外，不渲染任何其它内容（无 DOWNLOAD 按钮、无左侧表单、无 ambient glow 等，按需求可保留必要根布局以承载预览）。
- Generator 模式下行为与改动前一致，不隐藏、不去边框。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/public/iframe/cta-generator-test.html` — 需修改的 HTML；左侧为 `.ui-panel`，右侧预览为 `#exportArea`（class 含 `phone-frame`），边框来自 `.phone-frame` 的 CSS。

**其他:**
- 本变更 `design.md` — PreviewOnly 布局决策
- 需求：desc.md — “PreviewOnly 模式下 iframe 只展示原来 html 内部右侧的预览区域（不包含边框），纯预览区域，除此之外不能渲染任何内容”

## 注意点

- 仅根据 getMode() 为 `PreviewOnly'` 时切换布局；Generator 模式保持原样。
- “不包含边框”指不渲染 phone-frame 的黑色外框，不是去掉预览内部元素的边框。
- 若需保留根节点以承载预览，可保留最小化布局（如单列居中），但不显示编辑 UI 与下载按钮。

## Scenario

### Scenario 1: PreviewOnly 模式加载

    **场景描述：**
    - **前置条件**：Host 以 mode `'PreviewOnly'` 创建 controller 并加载 iframe，iframe 已完成 T-002 注册并取得 mode。
    - **操作步骤**：页面根据 mode 应用布局：隐藏左侧、仅显示右侧预览、去掉 phone-frame 边框。
    - **预期结果**：用户仅看到纯预览内容，无左侧编辑、无手机外框、无 DOWNLOAD 等其它 UI。

### Scenario 2: Generator 模式不变

    **场景描述：**
    - **前置条件**：getMode() 返回 `'Generator'`（或非 PreviewOnly）。
    - **操作步骤**：不应用 PreviewOnly 布局。
    - **预期结果**：布局与改动前一致，左侧编辑与右侧带边框预览均正常显示。

## Checklist

- [x] C-001 getMode() === 'PreviewOnly' 时隐藏左侧编辑面板
- [x] C-002 PreviewOnly 下仅渲染右侧预览区域，不渲染其它内容（如 DOWNLOAD、左侧表单）
- [x] C-003 PreviewOnly 下去掉 phone-frame 黑色边框，仅保留内部预览
- [x] C-004 Generator 模式下布局与原有行为一致

---

# T-004 HTML：用户编辑后调用 hostController.notifyDataChange 通知 Host (deps: T-001, T-002)

## 需求描述

用户在 iframe 内修改数据（文案、vibe、颜色、背景、控件开关等）后，在合适时机（如防抖）调用 `hostController.notifyDataChange(payload)`，payload 与 V2CreativeSuggestions 同构，以便 Host 端同步保存。

**需求类型**：Feature

**涉及领域**：前端（HTML 文件）

**功能要求**：
- 在可编辑字段变更时（如 headline、subtitle、CTA、vibe、颜色、背景、控件开关等），使用防抖（例如 300–500ms）收集当前预览/表单状态，序列化为与 V2CreativeSuggestions 同构的对象，调用 `hostController.notifyDataChange(payload)`（若 hostController 存在且存在该方法）。
- 若调用失败或方法不存在，静默忽略或 catch，不打断用户操作。
- 不在本任务内实现 Host 端“同步保存”具体逻辑（如 PATCH）；仅保证 iframe 侧在编辑后能发出数据变更通知。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/public/iframe/cta-generator-test.html` — 需修改的 HTML；编辑逻辑与表单/预览状态分散在现有脚本中
- `webserver/frontend/feature/tool.cta-generator/type.ts` — V2CreativeSuggestions 字段定义
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` — notifyDataChange 由 T-001 提供

**其他:**
- 本变更 `design.md` — 数据变更 payload 格式与触发时机

## 注意点

- payload 必须与 V2CreativeSuggestions 字段兼容，便于 Host 直接用于 PATCH 或持久化。
- 防抖间隔需在“及时回传”与“避免过于频繁”之间权衡；建议 300–500ms。
- 仅在嵌入且 Host 暴露 notifyDataChange 时调用，避免独立打开 HTML 时报错。

## Scenario

### Scenario 1: 用户编辑后 Host 收到回调

    **场景描述：**
    - **前置条件**：Host 已注册 registerOnDataChange，iframe 已实现防抖与 notifyDataChange 调用。
    - **操作步骤**：用户在 iframe 内修改 headline 或 vibe 等，等待防抖时间后触发 notifyDataChange。
    - **预期结果**：Host 侧注册的回调被调用，参数为当前预览数据（V2CreativeSuggestions 同构）。

### Scenario 2: 非嵌入或旧版 Host

    **场景描述：**
    - **前置条件**：页面独立打开或 Host 未暴露 notifyDataChange。
    - **操作步骤**：用户照常编辑，脚本尝试调用 hostController.notifyDataChange。
    - **预期结果**：不抛错，可静默忽略；用户编辑与预览正常。

## Checklist

- [x] C-001 在可编辑字段变更后通过防抖触发 notifyDataChange
- [x] C-002 payload 与 V2CreativeSuggestions 同构（背景、文案、vibe、颜色、控件等）
- [x] C-003 调用前判断 hostController 及 notifyDataChange 存在，不存在则不调用或 catch
- [x] C-004 防抖间隔合理（如 300–500ms），不阻塞 UI

---

# T-005 Host：CtaPreviewOnlyIframe 在 iframe 就绪后推送 prefill (deps: T-002)

## 需求描述

`CtaPreviewOnlyIframe` 当前只创建 controller 并 postMessage CREATIFY_HOST_READY，未向 iframe 推送 prefill，导致 batch-preview / batch 页上的 iframe 显示空白或默认内容。需在 iframe 就绪后由 Host 调用 `controller.updateWithData(prefill)`，使 iframe 内真实展示服务端下发的 AI 图与文案。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 为 `CtaPreviewOnlyIframe` 增加可选 prop `prefill`，类型与 `PreviewItemPrefill` 或 `UpdateWithDataPayload`（V2CreativeSuggestions）兼容。
- 在 iframe 的 load 事件中，Host 执行 `postMessage(CREATIFY_HOST_READY)` 后，延迟一短时间（建议 100–200ms）调用 `controller.updateWithData(prefill)`；仅当 `prefill` 存在且非空时调用。
- 若 `prefill` 未传或为空对象，不调用 `updateWithData`，保持现有行为（空白/默认预览）。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口与规范

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx` — 需修改组件
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` — updateWithData 接口
- `webserver/frontend/feature/tool.cta-generator/type.ts` — PreviewItemPrefill、V2CreativeSuggestions

**其他:**
- 本变更 `design.md` — 决策 7（Host 端 iframe 就绪后推送 prefill）
- HTML 内 `applyPrefillFromHost` 已支持 `generated_background_url` / `background_image_url` 等字段，PreviewItemPrefill 可直接传入。

## 注意点

- 延迟时间需在“iframe 已注册 registerUpdateWithData”与“用户不感知卡顿”之间权衡；100–200ms 为建议值，可依实测调整。
- 避免在 iframe 未 load 或 controller 未 expose 时调用 updateWithData；在 load 回调内、postMessage 之后延迟执行即可。

## Scenario

### Scenario 1: batch-preview 页每个 iframe 显示对应 preview 的 AI 图与文案

    **场景描述：**
    - **前置条件**：用户打开 `/tool/cta-generator/batch-preview?bulk_task_id=xxx`，页面已拉取 preview 列表，每个 item 有 prefill（含 generated_background_url、headline 等）。
    - **操作步骤**：每个 `CtaPreviewOnlyIframe` 接收 `controller` 与 `prefill={item.prefill}`，iframe load 后 Host 延迟调用 `controller.updateWithData(prefill)`。
    - **预期结果**：iframe 内展示该 preview 的 AI 生成图、文案、vibe 等，与服务端数据一致。

### Scenario 2: 无 prefill 时不推送

    **场景描述：**
    - **前置条件**：`CtaPreviewOnlyIframe` 未传 `prefill` 或 `prefill` 为空。
    - **操作步骤**：iframe load，Host 照常 postMessage CREATIFY_HOST_READY。
    - **预期结果**：不调用 `updateWithData`，iframe 保持默认/空白预览，不报错。

## Checklist

- [x] C-001 `CtaPreviewOnlyIframe` 增加可选 prop `prefill`（类型与 PreviewItemPrefill / UpdateWithDataPayload 兼容）
- [x] C-002 在 iframe load 且 postMessage CREATIFY_HOST_READY 之后，延迟 100–200ms 调用 `controller.updateWithData(prefill)`（仅当 prefill 存在且非空）
- [x] C-003 无 prefill 时不调用 updateWithData，行为与改动前一致
- [x] C-004 batch-preview 页传入 prefill 后，每个 iframe 内可见对应 AI 图与文案

---

# T-006 batch-preview 页面传入 prefill 并真实以 PreviewOnly 展示 (deps: T-005)

## 需求描述

batch-preview 页已传 `controller={vc.getControllerForKey(item.id, item.prefill)}`，但未向 `CtaPreviewOnlyIframe` 传入 `prefill`，且 Host 从未调用 `updateWithData`。在 T-005 实现“iframe 就绪后推送 prefill”后，本任务确保 batch-preview 页显式传入 `prefill`，使每个预览真实以 PreviewOnly 模式展示服务端数据。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 在 `batch-preview.tsx` 中，渲染 `CtaPreviewOnlyIframe` 时传入 `prefill={item.prefill}`（或等价数据源）。
- 确保 controller 仍为 `mode: 'PreviewOnly'`（已有），且 key 为 `item.id`；与 T-005 配合后，iframe 内应显示该 preview 的 AI 图与文案。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` — 需修改页面
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx` — 接收 prefill prop（T-005）
- `webserver/frontend/feature/tool.cta-generator/context/batch-preview-view-controller-context.tsx` — VC 与 getControllerForKey

**其他:**
- 本变更 `design.md` — 决策 7、Component Structure（batch-preview）

## 注意点

- `item.prefill` 来自 API 的 `PreviewItem.prefill`，字段与 `PreviewItemPrefill` 一致；若 API 返回字段名与 iframe 内不一致，需在 Host 侧做最小映射（当前 type 与 HTML 已兼容）。

## Scenario

### Scenario 1: 打开 batch-preview 后每个卡片显示真实预览

    **场景描述：**
    - **前置条件**：getPreviewList 已返回 results，每个 item 含 id、prefill（含 generated_background_url、headline 等）。
    - **操作步骤**：用户打开 `/tool/cta-generator/batch-preview?bulk_task_id=xxx`，页面按 product 分组渲染多个 CtaPreviewOnlyIframe，每个传入 prefill={item.prefill}。
    - **预期结果**：每个 iframe 以 PreviewOnly 模式显示对应 preview 的 AI 生成图与文案，无左侧编辑、无手机边框。

## Checklist

- [x] C-001 batch-preview 页渲染 CtaPreviewOnlyIframe 时传入 `prefill={item.prefill}`（或等价）
- [x] C-002 打开页面后，每个 iframe 内可见对应 preview 的 AI 图与文案（与 T-005 联合验收）

---

# T-007 batch 页每个 item 右侧展示该 task 下所有 preview 的 AI 图 (deps: T-005)

## 需求描述

当前 batch 页每个 list item 右侧使用“按 source 合成”的假 key（如 `task.id-p0-0`）渲染若干 `CtaPreviewOnlyIframe`，未拉取该 task 的 preview 列表，因此无法显示真实 AI 生成图与 prefill。需改为：每个 item 拉取 `getPreviewList({ bulk_task_id: item.id })`，右侧按返回的 `results`（PreviewItem[]）渲染，每个 preview 一个 iframe，key=previewItem.id，传入 prefill，使右侧展示当前 task 下所有 preview 的真实 AI 图与内容。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- 每个 `BatchListItem` 获取该 task 的 preview 列表：可选用 `getPreviewList({ bulk_task_id: item.id })`（如通过 useQuery、或 VC 内按 task 维度的 cache），得到 `PreviewItem[]`。
- 右侧不再使用 `generatePreviewKeysForTask(item)` 生成的假 key；改为使用 `previewList`（或 results）渲染，每个元素为 `CtaPreviewOnlyIframe`，key=previewItem.id，controller=vc.getControllerForKey(previewItem.id, previewItem.prefill)，prefill=previewItem.prefill。
- 加载中（preview 列表未返回）时可显示占位或骨架，与产品约定一致。
- 与 T-005 配合后，每个 iframe 在就绪后收到 updateWithData(prefill)，显示真实 AI 图与文案。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/page/batch/components/batch-list-item.tsx` — 需修改
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` — getControllerForKey、是否暴露按 task 的 preview 查询由实现决定
- `webserver/frontend/feature/tool.cta-generator/api` — getPreviewList
- `webserver/frontend/feature/tool.cta-generator/type.ts` — PreviewItem、PreviewItemPrefill

**其他:**
- 本变更 `design.md` — 决策 8（batch 页真实 preview 列表，与现有不一致）

## 注意点

- 与现有“按 source 合成 key”行为不一致，需完全替换为按 preview 列表渲染；如有其他地方依赖 generatePreviewKeysForTask，需一并调整（如 Download 的 key 列表改为 preview id 列表）。
- preview 列表可为空（task 刚创建或失败），需处理空列表与加载状态。

## Scenario

### Scenario 1: batch 页每个 item 右侧为该 task 所有 preview 的真实 AI 图

    **场景描述：**
    - **前置条件**：用户打开 `/tool/cta-generator/batch`，列表中有多个 bulk task；某 task 的 getPreviewList 已返回 5 个 PreviewItem。
    - **操作步骤**：该 list item 右侧渲染 5 个 CtaPreviewOnlyIframe，每个 key=previewItem.id，传入 prefill；T-005 使 iframe 就绪后收到 updateWithData。
    - **预期结果**：右侧显示 5 个预览，每个为对应 preview 的 AI 生成图与文案，非占位图。

### Scenario 2: preview 列表为空或加载中

    **场景描述：**
    - **前置条件**：某 task 的 getPreviewList 未返回或 results 为空。
    - **操作步骤**：渲染该 list item。
    - **预期结果**：右侧不显示 iframe 或显示占位/骨架，不报错。

## Checklist

- [x] C-001 每个 BatchListItem 拉取 getPreviewList({ bulk_task_id: item.id })，得到 PreviewItem[]
- [x] C-002 右侧按 preview 列表渲染 CtaPreviewOnlyIframe，key=previewItem.id，controller=getControllerForKey(previewItem.id, previewItem.prefill)，prefill=previewItem.prefill
- [x] C-003 移除或替换对 generatePreviewKeysForTask 的依赖（右侧展示与 Download 的 key 来源统一为 preview id 列表）
- [x] C-004 处理 preview 列表为空及加载中状态
- [x] C-005 每个 iframe 内可见对应 preview 的 AI 图与文案（与 T-005 联合验收）

---

# T-008 batch 页每个 item 的 Download 真实生效 (deps: T-007)

## 需求描述

当前 Download 使用 `(vc as any).controllerMap` 与按 source 合成的 `previewKeys`，类型不安全且 controller 可能未与真实 preview 对应（iframe 未注册 export）。在 T-007 改为按 preview 列表渲染后，Download 应使用该 task 下所有 preview 的 id 作为 key，从 VC 获取对应 controller 调用 getExportedHtml()，打包为 zip。VC 需暴露类型安全的下载接口，供 BatchListItem 调用。

**需求类型**：Feature

**涉及领域**：前端

**功能要求**：
- `BatchListViewController` 暴露下载方法，例如 `downloadBatchForKeys(keys: string[], options?: DownloadOptions): Promise<DownloadResult>`，内部使用现有 `controllerMap` 与 `zip-downloader.downloadFromControllerMap`（或等价逻辑）。
- `BatchListItem` 的 handleDownload 使用当前 task 的 preview id 列表（与 T-007 右侧展示一致）调用上述接口，不再使用 `(vc as any).controllerMap`。
- 下载时 keys 与右侧 iframe 的 key 一致，保证每个 controller 已由对应 iframe 注册 registerExportHtml，getExportedHtml() 能返回有效 Blob。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端入口

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` — 暴露 downloadBatchForKeys
- `webserver/frontend/feature/tool.cta-generator/page/batch/components/batch-list-item.tsx` — handleDownload 改为调用 VC 接口并传入 preview id 列表
- `webserver/frontend/feature/tool.cta-generator/util/zip-downloader.ts` — downloadFromControllerMap、DownloadOptions、DownloadResult

**其他:**
- 本变更 `design.md` — 决策 9（batch Download 真实生效）

## 注意点

- 若某 preview 的 iframe 尚未加载完成或未注册 export，getExportedHtml() 可能返回 null；zip-downloader 已有单条失败处理，可保留现有 Toast 提示（部分成功/失败）。
- 不暴露 controllerMap 本身，仅暴露下载方法，保持封装。

## Scenario

### Scenario 1: 点击 Download 下载该 task 所有 preview 的 HTML zip

    **场景描述：**
    - **前置条件**：某 list item 的 preview 列表已加载，右侧已渲染多个 CtaPreviewOnlyIframe 且已就绪（已注册 registerExportHtml）。
    - **操作步骤**：用户点击该 item 的 Download 按钮，handleDownload 使用该 task 的 preview id 列表调用 vc.downloadBatchForKeys(keys, options)。
    - **预期结果**：下载一个 zip，内含该 task 下每个 preview 导出的 HTML 文件，文件名与 key 对应。

### Scenario 2: 部分 controller 未就绪

    **场景描述：**
    - **前置条件**：部分 iframe 尚未 load 或未注册 export，对应 controller.getExportedHtml() 返回 null。
    - **操作步骤**：用户点击 Download。
    - **预期结果**：已就绪的 preview 正常打包下载，未就绪的计入 failedCount；Toast 或提示中可说明成功/失败数量（与现有 zip-downloader 行为一致）。

## Checklist

- [x] C-001 BatchListViewController 暴露 downloadBatchForKeys(keys, options)，内部使用 controllerMap 与 zip-downloader
- [x] C-002 BatchListItem handleDownload 使用当前 task 的 preview id 列表调用 vc.downloadBatchForKeys，不再使用 (vc as any).controllerMap
- [x] C-003 点击 Download 能下载包含该 task 下所有已就绪 preview 导出 HTML 的 zip
- [x] C-004 部分失败时行为与现有 zip-downloader 一致（Toast 等）
