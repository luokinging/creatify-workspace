# Add Asset Source（资产来源）提案

## 变更概述

在通过「Import from Projects」等能力导入资产时，记录资产来源信息并写入后端；前端从现有节点/资产接口读取 `asset_info.metadata`，在 Detail 等位置**按条件展示**来源信息（如：来源标题 + 可点击跳转）。当前仅支持来自 Media Job 的导入（`asset_source === 'media-job'`），后续可扩展更多来源类型。

**需求来源**：`.doc/source.md`（Asset Source 需求说明）

## 目标

- **上传链路**：调用 `uploadAssetsFromUrls` 时，每个 file 项可**可选**携带 `asset_source`、`source_value`；后端接收后放入 MushroomTask.metadata，Celery 任务创建 MushroomAsset 时写入 MushroomAsset.metadata。
- **读取与展示**：前端从 `asset.asset_info?.metadata?.asset_source` / `source_value` 读取；仅当存在来源信息时在 Detail 面板展示；对 `media-job` 展示为「来源标题 + 跳转」至 `/projects/detail?mediaJobId=${source_value}`。

## 范围

| 阶段           | 说明 |
|----------------|------|
| 上传请求       | 前端在 Import from Projects 等入口传 `asset_source`、`source_value`；类型定义扩展 `UploadAssetFileEntry`。 |
| 后端接收       | `upload_assets_from_urls` 将 file 中的 `asset_source`、`source_value` 写入 MushroomTask.metadata。 |
| 任务写入       | `process_upload_asset_from_url_task` 创建 MushroomAsset 后，将 task.metadata 中的两字段合并写入 MushroomAsset.metadata。 |
| 前端读取       | 现有接口已返回 `asset_info.metadata`，无需新接口。 |
| 前端展示       | Detail 面板（如 FileDetailsCard 或 Detail 区块内）条件展示「来源」行；media-job 时展示可点击跳转。 |

## 不在此次变更范围内

- 新增其他 `asset_source` 类型（如 library、ads）的展示与跳转逻辑（扩展时再加）。
- 根据 jobId 二次拉取 job 名称作为标题（可选增强，可与产品约定：先使用固定文案如「From Media Job」或 job id 短码，后续再接 API）。

## 依赖与影响

- **依赖**：现有「Import from Projects」流程（create-project-selection-dialog）已存在，本次在其调用 `uploadAssetsFromUrls` 时补充入参，并在后端透传、落库。
- **影响**：MushroomAsset.metadata 会新增可选键 `asset_source`、`source_value`；现有序列化已包含 `metadata`，无需改接口契约。

## 任务拆分概要

- **T-001**：后端 — 在 `upload_assets_from_urls` 中接收并将 `asset_source`、`source_value` 写入 MushroomTask.metadata。
- **T-002**：后端 — 在 `process_upload_asset_from_url_task` 中将 task.metadata 的 `asset_source`、`source_value` 写入 MushroomAsset.metadata。（deps: T-001）
- **T-003**：前端 — Import from Projects 调用 `uploadAssetsFromUrls` 时传入 `asset_source: 'media-job'` 与 `source_value: jobId`；扩展 `UploadAssetFileEntry` 类型。（deps: 无，可与 T-001 并行）
- **T-004**：前端 — 在 Detail 面板按条件展示来源（仅当存在 `asset_source` 时）；对 `media-job` 展示可点击跳转至 `/projects/detail?mediaJobId=${source_value}`。（deps: T-002 完成后有数据可展示；T-003 使新导入带来源）

## 合规说明

- **前端规则**：已参考 `.project-rules/frontend/index.md` 及架构设计指南。
- **后端规则**：已参考 `.project-rules/backend/index.md`。
- **提案阶段**：仅创建设计与任务文档，不编写实现代码。
