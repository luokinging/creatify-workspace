# Add Asset Source - Tasks

## T-001 后端：在 upload_assets_from_urls 中接收并写入 task.metadata 的 asset_source、source_value

## 需求描述

在 `upload_assets_from_urls` 视图中，对每个 file 入参**可选**读取 `asset_source`、`source_value`，并在创建 MushroomTask 时将该两字段写入该 task 的 `metadata`，供后续 Celery 任务使用。不传则不写入，保持与现有行为兼容。

**需求类型**：Feature

**涉及领域**：后端

### 实现要点

- 从 `file_entry` 中读取 `asset_source`、`source_value`（均为可选；若存在则应为字符串）。
- 创建 `MushroomTask` 时，将 `metadata` 字典中加入这两键（仅当存在时），例如：`metadata = { ..., "asset_source": file_entry.get("asset_source"), "source_value": file_entry.get("source_value") }`，注意 None 可不写入或写入后任务端忽略。
- 不校验 `asset_source` 取值或 `source_value` 格式，后端只做透传。

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` — 后端规范与 ruff 等

**后端Code Point:**
- `webserver/backend/mushroom/views/node.py` — `upload_assets_from_urls` 方法（约 1106–1225 行），当前从 file_entry 取 url、name、tags、assigned_to、client_visible、uploaded_by_client 并写入 task.metadata

## 注意点

- 不修改 API 响应格式；不破坏现有未传这两字段的调用方。
- 若需在 OpenAPI/schema 中体现可选字段，可在该 action 的 extend_schema 的 request body 中补充 files[].asset_source、files[].source_value 的说明。

## Scenario

### Scenario 1: 调用方传入 asset_source 与 source_value

**场景描述：**
- **前置条件**：请求体 files 中某一项包含 `asset_source: "media-job"`、`source_value: "job-uuid-xxx"`。
- **操作步骤**：POST upload-assets-from-urls，parent_id 与 files 合法。
- **预期结果**：对应创建的 MushroomTask.metadata 中包含 `asset_source`、`source_value`，且值与入参一致。

### Scenario 2: 调用方不传来源字段

**场景描述：**
- **前置条件**：请求体 files 中仅含 url、name 等现有字段，不包含 asset_source、source_value。
- **操作步骤**：POST upload-assets-from-urls。
- **预期结果**：MushroomTask 正常创建，metadata 中无 asset_source/source_value 或为其 None/未设置；下游任务不因缺失这两键而报错。

## Checklist

- [x] C-001 当 file 项包含 `asset_source` 时，该字段被写入对应 MushroomTask.metadata
- [x] C-002 当 file 项包含 `source_value` 时，该字段被写入对应 MushroomTask.metadata
- [x] C-003 未传 `asset_source`/`source_value` 时，现有上传流程行为不变，任务可正常创建并执行
- [x] C-004 如有 extend_schema，request body 中 files 项已注明可选字段 asset_source、source_value（或等效文档）

---

## T-002 后端：在 process_upload_asset_from_url_task 中将 task.metadata 的 asset_source、source_value 写入 MushroomAsset.metadata (deps: T-001)

## 需求描述

在 Celery 任务 `process_upload_asset_from_url_task` 中，在成功创建 MushroomAsset（及 MushroomNode）之后，从 `task.metadata` 中读取可选的 `asset_source`、`source_value`；若存在则合并到 `asset_info.metadata` 字典中并保存，使节点/资产接口返回的 `asset_info.metadata` 包含这两键。

**需求类型**：Feature

**涉及领域**：后端

### 实现要点

- 在调用 `MushroomAsset.create_from_url` 得到 `asset_node, asset_info` 之后，读取 `metadata = task.metadata or {}`，取 `asset_source`、`source_value`。
- 若任一项存在且非空，则更新 `asset_info.metadata`：例如 `asset_info.metadata = dict(asset_info.metadata or {})`，然后设置 `asset_info.metadata["asset_source"]`、`asset_info.metadata["source_value"]`，再 `asset_info.save(update_fields=["metadata", "updated_at"])`。
- 不修改 `create_from_url` 或 `create_or_update_asset_info` 的签名；仅在任务内做一次合并写入。

## 相关指引

**后端规则:**
- `.project-rules/backend/index.md` — 后端规范

**后端Code Point:**
- `webserver/backend/mushroom/tasks.py` — `process_upload_asset_from_url_task`（约 224 行起），当前从 task.metadata 取 parent_id、file_url、name、client_visible、tags、assigned_to 等，并调用 MushroomAsset.create_from_url
- `webserver/backend/mushroom/models/asset.py` — MushroomAsset.metadata 为 JSONField，可直接读写 dict

## 注意点

- 合并时保留 metadata 中已有键（如 created_by_email、created_from），只新增或覆盖 asset_source、source_value。
- 若 task.metadata 中无这两键，则不做任何写入，避免多余 save。

## Scenario

### Scenario 1: task.metadata 中含 asset_source、source_value

**场景描述：**
- **前置条件**：T-001 已完成，某次上传传入了 asset_source 与 source_value，对应 MushroomTask.metadata 已包含这两键。
- **操作步骤**：Celery 执行 process_upload_asset_from_url_task 处理该 task，create_from_url 成功。
- **预期结果**：创建的 MushroomAsset.metadata 中包含 asset_source、source_value，且与 task.metadata 一致；节点/资产接口返回的 asset_info.metadata 包含这两键。

### Scenario 2: task.metadata 中无来源字段

**场景描述：**
- **前置条件**：MushroomTask 由未传 asset_source/source_value 的请求创建。
- **操作步骤**：Celery 执行 process_upload_asset_from_url_task。
- **预期结果**：MushroomAsset 正常创建，metadata 仅含原有内容（如 created_by_email、created_from），无 asset_source/source_value。

## Checklist

- [x] C-001 当 task.metadata 存在 asset_source 时，该值被合并进 MushroomAsset.metadata 并持久化
- [x] C-002 当 task.metadata 存在 source_value 时，该值被合并进 MushroomAsset.metadata 并持久化
- [x] C-003 合并后 metadata 中已有键（如 created_by_email、created_from）未被清除
- [x] C-004 当 task.metadata 无 asset_source/source_value 时，不修改 asset_info.metadata 或仅保留原内容
- [x] C-005 节点/资产接口返回的 asset_info 中能正确看到 metadata.asset_source、metadata.source_value（在已写入的情况下）

---

## T-003 前端：Import from Projects 调用 uploadAssetsFromUrls 时传入 asset_source、source_value (deps: 无)

## 需求描述

在「Import from Projects」流程中，构造并调用 `uploadAssetsFromUrls` 时，为每个 file 项**传入** `asset_source: 'media-job'` 与 `source_value: jobId`（或业务约定的 Media Job 标识字段）。并扩展前端类型 `UploadAssetFileEntry`，增加可选字段 `asset_source?: string`、`source_value?: string`。

**需求类型**：Feature

**涉及领域**：前端

### 实现要点

- 在 `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` 中，为 `UploadAssetFileEntry` 增加可选属性：`asset_source?: string`、`source_value?: string`。
- 在 Import from Projects 的调用点（见 create-project-selection-dialog 相关实现，如 NodeFolderActionMenu 或封装的上传函数），构造 files 时对每个选中的 job 传入：
  - `url`、`name` 等现有字段不变；
  - `asset_source: 'media-job'`；
  - `source_value`: 该 job 的 ID（如 `job.id`，以实际 MediaJob 类型字段为准）。
- 普通上传（非 Import from Projects）不传这两字段，保持兼容。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端索引
- `.project-rules/frontend/architecture.md` — Manager 与数据流

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/mushroom-node.api.ts` — `UploadAssetFileEntry` 类型、`uploadAssetsFromUrls` 调用
- `.luokingspec/changes/create-project-selection-dialog/tasks.md` — Import from Projects 流程描述；实际调用点需在代码中定位（如多处调用 uploadAssetsFromUrls 的位置中，与 ProjectSelectionDialog 结果关联的那处）

## 注意点

- 仅在有明确「来自 Media Job」语义的入口传 asset_source/source_value；其他上传入口不传，避免误标来源。
- source_value 必须与后端约定一致（当前为 Media Job ID）；若主站使用不同 ID 字段，需与产品/后端确认。

## Scenario

### Scenario 1: 用户通过 Import from Projects 导入 2 个视频

**场景描述：**
- **前置条件**：用户已选择 2 个 Media Job，确认导入。
- **操作步骤**：前端构造 files 为两项，每项包含 url、name、asset_source: 'media-job'、source_value: 对应 job.id；调用 uploadAssetsFromUrls(parentId, files)。
- **预期结果**：请求体中每个 file 包含 asset_source 与 source_value；后端能收到并写入 task/asset metadata；导入完成后资产具备来源信息（可由 T-004 或接口验证）。

### Scenario 2: 普通上传不传来源

**场景描述：**
- **前置条件**：用户通过非「Import from Projects」的方式上传（如本地文件上传或其它 URL 导入）。
- **操作步骤**：调用 uploadAssetsFromUrls 时 files 中不包含 asset_source、source_value。
- **预期结果**：上传成功，行为与变更前一致；资产无 asset_source/source_value。

## Checklist

- [x] C-001 `UploadAssetFileEntry` 类型中已增加可选字段 `asset_source`、`source_value`
- [x] C-002 Import from Projects 流程中构造的每个 file 项包含 `asset_source: 'media-job'` 与 `source_value: <jobId>`
- [x] C-003 其他调用 uploadAssetsFromUrls 的入口未强制传入 asset_source/source_value，兼容性保持
- [x] C-004 实际传入的 source_value 与主站 Media Job 标识一致（如 job.id），便于后续跳转与产品约定

---

## T-004 前端：在 Detail 面板按条件展示来源并支持 media-job 跳转 (deps: T-002, T-003)

## 需求描述

在资产 Detail 面板中，从当前展示的 asset 的 `asset_info?.metadata` 读取 `asset_source`、`source_value`；**仅当存在 `asset_source`** 时展示「来源」信息。当 `asset_source === 'media-job'` 时，展示为可点击链接，跳转至 `/projects/detail?mediaJobId=${source_value}`；展示标题可采用固定文案（如 "From Media Job"）或 source_value 短码，后续可扩展为按 jobId 拉取名称。

**需求类型**：Feature

**涉及领域**：前端

### 实现要点

- **数据来源**：使用当前选中的 asset 的 asset_info（与 Detail 其他字段一致）；若使用「当前选中版本」的 asset info，则从该版本的 metadata 读取；读取路径为 `asset.asset_info?.metadata?.asset_source`、`asset.asset_info?.metadata?.source_value`。
- **展示位置**：在 Detail 面板内合适位置（如 FileDetailsCard 所在区块上方/下方，或同一卡片内新增一行「Source」），与现有「Asset Information」「Version」等区块协调。
- **展示逻辑**：若不存在 asset_source，不渲染来源区块或行；若存在且为 media-job，展示一行：标题（如 "From Media Job"）+ 可点击链接，链接为 `/projects/detail?mediaJobId=${source_value}`；若为其他 asset_source，可仅展示类型文案，后续再扩展跳转。
- **样式**：与现有 Detail 文案、链接风格一致（如 text-body-sm、Link 组件等）。

## 相关指引

**前端规则:**
- `.project-rules/frontend/index.md` — 前端索引
- `.project-rules/frontend/architecture.md` — 组件与数据从 Manager/ViewController 获取
- `.project-rules/frontend/directory-structure.md` — block/section 组织（如 detail-fields-section）

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/project-management/block/section/detail-fields-section.tsx` — Detail 面板结构；detailContent 中含 FileDetailsCard、TagsFieldCard 等
- `webserver/frontend/feature/mushroom/block/detail/fields/file-details-card.tsx` — 文件信息卡片，可参考布局与样式；或在此卡片内新增「Source」行
- `webserver/frontend/feature/mushroom/sub-feature/projects/api/types.ts` — MushroomAssetInfo.metadata 类型为 Record<string, any>，已包含扩展键

**前端路由:**
- `/projects/detail?mediaJobId=...` — 项目/Media Job 详情页（主站），用于来源跳转

## 注意点

- 使用「当前选中版本」的 asset_info 时，需与 detail-fields-section 中 selectedAssetInfo 一致（若该版本无 metadata 中的 asset_source，则不展示来源，避免误导）。
- 链接使用项目内路由或 a 标签需与主站域名/路由约定一致（若 projects/detail 为同应用路由则用 Link；若为主站则可能需 a href 或 window.open）。
- 不展示时不要留空白占位，保持 UI 简洁。

## Scenario

### Scenario 1: 资产来自 Import from Projects（media-job）

**场景描述：**
- **前置条件**：T-002、T-003 已完成；某资产由 Import from Projects 导入，asset_info.metadata 含 asset_source: 'media-job'、source_value: 'job-123'。
- **操作步骤**：用户在 Mushroom 中打开该资产 Detail 面板。
- **预期结果**：Detail 中展示「来源」信息；有可点击链接，点击后跳转到 `/projects/detail?mediaJobId=job-123`（或当前应用约定写法）；标题为固定文案或短码。

### Scenario 2: 资产无来源信息

**场景描述：**
- **前置条件**：资产为普通上传或旧数据，asset_info.metadata 无 asset_source。
- **操作步骤**：用户打开该资产 Detail 面板。
- **预期结果**：不展示「来源」区块或行，无空白占位。

### Scenario 3: 未来扩展 asset_source 类型

**场景描述：**
- **前置条件**：metadata 中 asset_source 为其他值（如 'library'），source_value 有值。
- **操作步骤**：用户打开 Detail 面板。
- **预期结果**：可仅展示类型文案（如 "From Library"），或预留扩展点；不因未知类型报错。

## Checklist

- [x] C-001 仅当 asset_info?.metadata?.asset_source 存在时展示来源信息
- [x] C-002 当 asset_source === 'media-job' 时，展示可点击链接，跳转目标为 `/projects/detail?mediaJobId=${source_value}`
- [x] C-003 当无 asset_source 时不展示来源区块/行，无多余占位
- [x] C-004 展示使用的 asset_info 与 Detail 其他字段一致（含选中版本逻辑若存在）
- [x] C-005 样式与现有 Detail 区块一致；链接可访问且参数正确
- [x] C-006 未知 asset_source 时不报错，可展示通用文案或仅类型键名
