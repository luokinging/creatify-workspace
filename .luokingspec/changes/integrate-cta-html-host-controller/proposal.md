# Proposal: CTA HTML 与 Host Controller 集成

## 需求摘要

在 `cta-generator-test.html` 内完成与 Host 端 `CreatifyHostController` 的对接（download、prefill、模式、数据回传），并在 PreviewOnly 模式下仅展示右侧纯预览区域（不含手机边框）；**并贯通前后端整体流程**：路由 batch-preview 真实以 PreviewOnly 展示每个预览且 Host 推送 prefill、路由 batch 每个 item 右侧展示该 task 下所有 preview 的 AI 生成图、每个 item 的 Download 真实打包下载。

## 背景与动机

### 现有情况

1. **Host 端**：`CreatifyHostController` 已提供 `getMode()`、`registerExportHtml()`、`registerUpdateWithData()`、`updateWithData()`、`getExportedHtml()`，通过 Comlink 暴露给 iframe。
2. **HTML**：已通过 Comlink 建立连接（`hostControllerReady`），右侧有预览区域（`#exportArea` / `.phone-frame`）和 DOWNLOAD 按钮，具备 `serializePreviewToHTML()` 导出逻辑；尚未向 Host 注册任何回调，也未根据模式切换布局。
3. **外部 prefill**：已约定仅通过 `registerUpdateWithData` 由 Host 主动推送数据给 iframe。

### 问题与痛点

1. **未注册**：iframe 未注册 `registerExportHtml`、`registerUpdateWithData`，Host 无法拉取导出 HTML 或推送 prefill。
2. **未消费模式**：未调用 `getMode()`，无法区分 Generator / PreviewOnly，无法做布局切换。
3. **PreviewOnly 未收窄**：未实现“仅右侧预览、无左侧编辑、无手机边框”的纯预览形态。
4. **数据回传缺失**：用户在 iframe 内编辑后无法通知 Host 同步保存，Host 端也尚未提供可被 iframe 调用的“数据变更”接口。

### 解决方案

- **HTML 侧**：在 `hostControllerReady` 后注册 `registerExportHtml`（封装现有导出为 Blob）、`registerUpdateWithData`（用 V2CreativeSuggestions 应用 prefill）；调用 `getMode()` 并根据结果为 PreviewOnly 时隐藏左侧、仅展示右侧预览且去掉 phone-frame 边框；在用户修改数据后调用 Host 暴露的“数据变更”方法（如 `notifyDataChange`）通知同步保存。
- **Host 侧**：在 `CreatifyHostController` 上增加“iframe 通知数据变更”的能力：Host 注册回调 `registerOnDataChange(fn)`，iframe 调用 `notifyDataChange(payload)` 时触发该回调，便于 Host 执行 PATCH 等同步保存逻辑。

## 目标与成功标准

### 目标

1. iframe 在连接后完成 hostController 的注册与模式消费：download、prefill、getMode、数据变更通知；PreviewOnly 时仅展示纯预览区域（已由 T-001～T-004 完成）。
2. **batch-preview**：页面展示后，每个预览以 PreviewOnly 模式渲染，且 Host 在 iframe 就绪后调用 `updateWithData(prefill)`，真实显示服务端下发的 AI 图与文案。
3. **batch**：每个 list item 右侧展示**当前 task 下所有 preview**（来自 `getPreviewList(bulk_task_id)`），每个预览为真实 AI 生成图与 prefill，与现有“按 source 合成 key”行为不一致，需改为按 preview 列表渲染。
4. **batch Download**：每个 item 的 Download 使用该 task 下所有 preview 的 controller 调用 `getExportedHtml()`，打包为 zip 真实下载。

### 成功标准

- batch-preview：打开页面后，每个 iframe 显示对应 preview 的 AI 图与文案（Host 推送 prefill 生效）。
- batch：每个 item 右侧为该 task 的 preview 列表（真实 preview 数据与 AI 图），非合成占位。
- batch：点击某 item 的 Download，能下载包含该 task 下所有 preview 导出 HTML 的 zip。

## 范围与边界

### In Scope（本次包含）

- **已完成的 iframe–Host 契约**（T-001～T-004）：Controller 扩展、HTML 注册与 PreviewOnly、notifyDataChange。
- **Host 端流程贯通**：
  - `CtaPreviewOnlyIframe` 支持接收 prefill，在 iframe 就绪后调用 `controller.updateWithData(prefill)`。
  - batch-preview 传入 prefill，使每个预览真实展示服务端数据。
  - batch 页：每个 item 拉取该 task 的 preview list，右侧按 preview 列表渲染 iframe（key=previewItem.id，带 prefill）；Download 使用该 task 的 preview id 列表与 VC 暴露的下载接口真实打包下载。

### Out of Scope（本次不包含）

- 后端 API 或批量任务流程的改动。
- Host 端具体“同步保存”实现（如 PATCH 预览项）的产品逻辑；仅约定可收到 notifyDataChange 回调。

## 用户/系统场景

### 场景 1：Host 拉取导出 HTML

- **谁**：Host 页面（如批量预览项卡片）。
- **何时/条件**：用户点击“下载”或需要获取当前 CTA 的 HTML。
- **做什么**：调用已注册的 `getExportedHtml()`，即触发 iframe 的导出回调。
- **得到什么**：iframe 返回的 Blob/File（由现有 `serializePreviewToHTML` 等逻辑生成）。

### 场景 2：Host 推送 prefill 到 iframe

- **谁**：Host 页面。
- **何时/条件**：打开预览项或切换条目时，需要展示服务端下发的 prefill。
- **做什么**：调用 `updateWithData(data)`（V2CreativeSuggestions 结构）。
- **得到什么**：iframe 内部应用背景、文案、vibe、颜色等，预览区域更新。

### 场景 3：PreviewOnly 模式仅展示纯预览

- **谁**：用户/系统。
- **何时/条件**：Host 以 `mode: 'PreviewOnly'` 加载 iframe。
- **做什么**：iframe 在 `hostControllerReady` 后调用 `getMode()`，若为 `PreviewOnly` 则隐藏左侧编辑面板，仅保留右侧预览区域，并去掉 phone-frame 的黑色边框。
- **得到什么**：页面仅显示纯预览内容，无编辑 UI、无手机外框。

### 场景 4：iframe 内编辑后通知 Host 同步保存

- **谁**：用户（在 iframe 内编辑文案/样式等）。
- **何时/条件**：编辑导致当前预览数据发生变化。
- **做什么**：iframe 在防抖/合适时机调用 `hostController.notifyDataChange(payload)`。
- **得到什么**：Host 端注册的回调被调用，Host 可据此执行同步保存（如 PATCH 预览项）。

### 场景 5：batch-preview 页面真实展示每个预览（PreviewOnly + prefill）

- **谁**：用户打开路由 `/tool/cta-generator/batch-preview?bulk_task_id=xxx`。
- **何时/条件**：页面拉取 `getPreviewList(bulk_task_id)` 得到 preview 列表。
- **做什么**：每个 preview 渲染一个 `CtaPreviewOnlyIframe`，controller 为 `mode: 'PreviewOnly'`，并在 iframe 就绪后调用 `controller.updateWithData(item.prefill)`。
- **得到什么**：每个 iframe 内显示该 preview 的 AI 生成图、文案、vibe 等，无左侧编辑、无手机边框。

### 场景 6：batch 页面每个 item 右侧显示该 task 下所有 preview 的 AI 图

- **谁**：用户在路由 `/tool/cta-generator/batch` 查看列表。
- **何时/条件**：每个 list item 对应一个 bulk task，需展示该 task 下所有 preview。
- **做什么**：每个 item 拉取 `getPreviewList({ bulk_task_id: item.id })`，右侧按 `results` 渲染多个 `CtaPreviewOnlyIframe`，每个 key=previewItem.id，传入 prefill；不再使用按 source 合成的假 key。
- **得到什么**：右侧显示当前 task 下所有 preview 的真实 AI 生成图与内容。

### 场景 7：batch 页面每个 item 的 Download 真实生效

- **谁**：用户点击某 list item 的 Download 按钮。
- **何时/条件**：该 task 的 preview 列表已加载，且每个 preview 对应一个已创建并已注册 export 的 controller。
- **做什么**：使用该 task 下所有 preview 的 id 作为 key，从 VC 获取对应 controller 调用 `getExportedHtml()`，打包为 zip 下载。
- **得到什么**：下载的 zip 内包含该 task 下每个 preview 导出的 HTML 文件。

## 约束与假设

### 约束

- 数据格式与 `V2CreativeSuggestions`（及现有 type 定义）一致，以便 Host 与 iframe 共用同一数据结构。
- 仅使用已有 `registerUpdateWithData` 机制做 prefill，不在 iframe 内主动向 Host“拉取”prefill。

### 假设

- Host 在 iframe 加载后会在合适时机调用 `updateWithData` 推送 prefill；PreviewOnly 模式下 Host 会传入 `mode: 'PreviewOnly'` 的 controller。
- `notifyDataChange` 的 payload 与 V2CreativeSuggestions 兼容即可；Host 端是否立即 PATCH 或做节流由 Host 实现决定。

## 名词与术语

| 术语/缩写 | 含义 |
|----------|------|
| Host | 嵌入了 iframe 的 Creatify 前端页面 |
| iframe / HTML | `cta-generator-test.html` 所加载的页面 |
| CreatifyHostController | Host 端通过 Comlink 暴露给 iframe 的控制器 |
| registerUpdateWithData | iframe 向 Host 注册的回调，Host 通过 updateWithData(data) 推送 prefill |
| registerExportHtml | iframe 向 Host 注册的导出函数，返回 Blob/File |
| PreviewOnly | 模式之一，iframe 仅展示右侧纯预览区域（无左侧、无手机边框） |
| V2CreativeSuggestions | prefill / 数据变更 payload 的共用数据结构（背景、文案、vibe、颜色等） |

## 参考与链接

- 指引：`.luokingspec/archive/002.integrate-cta-batch-backend-api`（后端集成）、`.luokingspec/archive/cta-generator-batch-mode`（前端功能）
- HTML：`webserver/frontend/public/iframe/cta-generator-test.html`
- Host 控制器：`webserver/frontend/feature/iframe-controller/creatify-host-controller.ts`
- 类型：`webserver/frontend/feature/tool.cta-generator/type.ts`（V2CreativeSuggestions、PreviewItemPrefill）
- 路由与页面：`/tool/cta-generator/batch-preview`（`batch-preview.tsx`）、`/tool/cta-generator/batch`（`batch/index.tsx`、`batch-list-item.tsx`）
- 组件与 VC：`cta-preview-only-iframe.tsx`、`BatchPreviewViewController`、`BatchListViewController`
- 下载：`webserver/frontend/feature/tool.cta-generator/util/zip-downloader.ts`
