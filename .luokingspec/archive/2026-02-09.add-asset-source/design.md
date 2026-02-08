# Add Asset Source - Design

## Context

通过「Import from Projects」从主站 Media Job 导入视频到 Mushroom 时，目前不记录「该资产来自哪个 Media Job」。产品需要在资产详情等位置展示来源信息并支持跳回项目/Job 详情。现有能力：

- 上传入口：`upload_assets_from_urls` 接收 `parent_id` + `files[]`，每项含 `url`、`name`、`client_visible`、`tags`、`assigned_to` 等，写入 MushroomTask.metadata 后由 Celery 任务 `process_upload_asset_from_url_task` 创建 MushroomAsset。
- 资产模型：MushroomAsset 已有 `metadata` JSONField，当前由 `MushroomAssetMetadata`（created_by_email、created_from）填充；序列化与节点接口已返回 `asset_info.metadata`。
- 前端：Detail 面板使用 `asset.asset_info`（及选中版本的 asset info），FileDetailsCard 等展示文件信息；Import from Projects 已实现并调用 `uploadAssetsFromUrls`。

需要在**不改变现有 API 契约**的前提下，增加「来源」的写入与展示链路。

## Goals / Non-Goals

### Goals

- 在上传链路上透传并持久化 `asset_source`、`source_value` 到 MushroomAsset.metadata。
- 前端仅在存在来源信息时展示；对 `media-job` 提供跳转至 `/projects/detail?mediaJobId=${source_value}`。
- 设计可扩展：后续新增来源类型时，后端无需改结构，前端按 `asset_source` 分支展示与路由。

### Non-Goals

- 在 metadata 中存储展示用 title 或多级来源结构（可后续扩展）。
- 根据 jobId 拉取 job 名称并展示（可选增强，本方案可先使用固定文案或 id 短码）。

## Decisions

### 1. 存储位置：MushroomAsset.metadata

**决策**：将 `asset_source`、`source_value` 存入 **MushroomAsset.metadata**（即接口中的 `asset_info.metadata`），不新增表或字段。

**理由**：metadata 为 JSONField，已对外暴露；扩展两个可选键不影响现有 Pydantic 校验（MushroomAssetMetadata 仅约束 created_by_email、created_from，其余键由后端合并写入即可）。前端已能拿到 `asset_info.metadata`，无需新接口。

**考虑的替代方案**：
- 单独「来源」表/字段：被拒绝，增加模型与迁移成本，且当前仅两个简单字段，metadata 足够。
- 只存 MushroomTask.metadata 不落库到 Asset：被拒绝，任务完成后前端需从节点/资产接口读来源，必须落在 MushroomAsset 上。

### 2. 透传路径：file 入参 → Task.metadata → Asset.metadata

**决策**：上传时每个 file 可带可选字段 `asset_source`、`source_value`；`upload_assets_from_urls` 将其写入对应 MushroomTask.metadata；`process_upload_asset_from_url_task` 在创建 MushroomAsset 后，从 task.metadata 读取这两键并**合并**进 `asset_info.metadata` 再保存。

**理由**：与现有「file → task.metadata → 任务内使用」模式一致；不在 `create_from_url` 或 `create_or_update_asset_info` 签名中增加大量可选参数，仅在任务层做一次合并，对现有创建逻辑侵入最小。

**考虑的替代方案**：
- 在 `create_from_url` 中增加 `asset_source`/`source_value` 并一路传到 `create_or_update_asset_info`：可行但会改动多处签名；当前仅在「从 URL 上传」这一条链路需要，任务内合并更局部。

### 3. 前端展示条件与 media-job 行为

**决策**：仅当 `asset_info?.metadata?.asset_source` 存在时在 Detail 展示「来源」；当 `asset_source === 'media-job'` 时，使用 `source_value` 作为 Media Job ID，展示为可点击链接，跳转 `/projects/detail?mediaJobId=${source_value}`。标题可采用固定文案（如 "From Media Job"）或后续接 job 名称 API。

**理由**：与 `.doc/source.md` 一致；先实现最小可用，避免未约定来源类型时误展示。

**考虑的替代方案**：
- 仅当同时存在 `asset_source` 与 `source_value` 才展示：产品可约定；若约定「有 asset_source 即展示」，则 source_value 可为空时只显示类型文案。

### 4. 前端类型与调用方

**决策**：扩展 `UploadAssetFileEntry`，增加可选 `asset_source?: string`、`source_value?: string`；Import from Projects 在构造 files 时对每个 job 传入 `asset_source: 'media-job'`、`source_value: job.id`（或业务约定的 job 标识字段）。

**理由**：类型与 API 约定一致；仅在有明确来源的入口传参，普通上传不传，保持兼容。

## Data Model

### Existing Model (No Changes Required)

- **MushroomTask**：已有 `metadata` JSONField，当前已存 parent_id、file_url、name、client_visible、tags、assigned_to 等。
- **MushroomAsset**：已有 `metadata` JSONField，序列化已返回；现有写入来自 MushroomAssetMetadata（created_by_email、created_from）。

### New/Modified Model

- **MushroomTask.metadata**：新增可选键 `asset_source`、`source_value`（由 view 从 file 入参写入）。
- **MushroomAsset.metadata**：在任务中合并写入可选键 `asset_source`、`source_value`；不修改 MushroomAssetMetadata Pydantic 模型，仅在运行时 dict 合并。

### API

- **POST upload-assets-from-urls**：请求体 `files[]` 中每项可增加可选字段 `asset_source`、`source_value`；响应格式不变。
- **节点/资产接口**：已返回 `asset_info.metadata`，无需变更；前端读取 `asset_info.metadata.asset_source`、`asset_info.metadata.source_value`。

## Component Structure

- **后端**：
  - `webserver/backend/mushroom/views/node.py` — `upload_assets_from_urls` 中从 file_entry 取 asset_source、source_value 写入 task.metadata。
  - `webserver/backend/mushroom/tasks.py` — `process_upload_asset_from_url_task` 中在创建 MushroomAsset 后合并 task.metadata 的 asset_source、source_value 到 asset_info.metadata 并 save。
- **前端**：
  - `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` — `UploadAssetFileEntry` 增加可选字段；调用处（Import from Projects）传参。
  - Import from Projects 调用点：见 create-project-selection-dialog 相关实现（如 NodeFolderActionMenu / 上传流程）。
  - Detail 展示：在 `detail-fields-section` 使用的区块内（如 FileDetailsCard 同级的「来源」行，或独立小卡片）根据 asset_info.metadata 条件渲染；media-job 使用 Link 至 `/projects/detail?mediaJobId=...`。

## Architecture Patterns

- **透传**：后端不解析 asset_source/source_value 语义，只做接收、写入 task、再写入 asset metadata。
- **条件展示**：前端单一读取点 `asset_info?.metadata`，按 asset_source 分支展示与跳转，便于后续扩展新类型。

## Risks / Trade-offs

### Risk: metadata 键冲突

**风险**：若未来 metadata 中其他功能也使用同名键，可能覆盖。

**缓解措施**：asset_source、source_value 与现有 MushroomAssetMetadata 键（created_by_email、created_from）不冲突；命名空间清晰，文档约定为「资产来源」专用。

### Trade-off: 标题不拉 job 名称

**决策**：首版可用固定文案或 source_value 短码，不强制接 Media Job 详情 API。

**影响**：体验略逊于展示真实 job 名称；可后续在 T-004 或单独任务中增加按 jobId 拉取名称并展示。

## References

- `.doc/source.md` — 需求与数据约定
- `webserver/backend/mushroom/views/node.py` — upload_assets_from_urls、task 创建
- `webserver/backend/mushroom/tasks.py` — process_upload_asset_from_url_task
- `webserver/backend/mushroom/models/asset.py` — MushroomAsset.metadata、create_from_url
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` — UploadAssetFileEntry、uploadAssetsFromUrls
- `webserver/frontend/feature/mushroom/sub-feature/project-management/block/section/detail-fields-section.tsx` — Detail 面板结构
- `.luokingspec/changes/create-project-selection-dialog/` — Import from Projects 流程
