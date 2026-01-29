## Context

当前CTA Generator只支持单个产品的CTA生成功能。用户需要为多个产品批量生成CTA时，必须重复操作单个生成流程，效率低下。后端已经实现了批量CTA生成的API（`CTAGenerationJob`和`CTAInfo`模型），但前端尚未实现对应的用户界面和交互逻辑。

现有前端代码包含部分Mock数据的批量生成实现，需要完全移除Mock数据，对接后端API。

## Goals / Non-Goals

### Goals

1. 实现完整的批量CTA生成前端功能，包括入口页、列表页、创建页、预览页
2. 对接后端批量CTA API，使用真实数据替代Mock数据
3. 实现CTAPreview组件，支持预览、编辑、查看功能
4. 实现自动轮询机制，实时显示任务和CTA状态
5. 保持与现有单个CTA生成功能的隔离，不影响线上代码
6. UI设计与参考设计稿保持90%以上一致性

### Non-Goals

1. 不修改现有的单个CTA生成功能（`prod.tsx`及相关文件）
2. 不实现CTA的删除功能（后端暂不支持）
3. 不实现CTA的重新生成功能（后端暂不支持）
4. 不实现批量下载功能（可作为后续增强）
5. 不实现任务的暂停/恢复功能

## Decisions

### 1. 组件架构设计

**决策**：保持现有的MVC架构（ViewController模式），移除Mock数据，对接后端API。

**理由**：
- 现有代码已经使用ViewController模式，团队熟悉
- 有明确的架构规范和示例代码
- 便于维护和测试

**考虑的替代方案**：
- 使用React Context + Hooks：被拒绝，因为与现有架构不一致，增加维护成本
- 使用Redux状态管理：被拒绝，因为对于这个功能来说过于复杂

### 2. CTAPreview组件设计

**决策**：创建全新的CTAPreview组件，保留现有的CtaPreviewOnlyIframe组件不变。

**理由**：
- 现有的CtaPreviewOnlyIframe可能在其他地方被使用，保持其稳定性
- 新的CTAPreview组件需要支持更多功能（Edit/View、状态显示等），与现有组件差异较大
- 避免修改现有组件可能带来的风险
- 两个组件各自专注，代码更清晰

**考虑的替代方案**：
- 替换现有的CtaPreviewOnlyIframe组件：被拒绝，因为可能影响现有功能，增加风险

### 3. iframe通信机制

**决策**：使用Comlink + CreatifyHostController，一个controller实例对应一个iframe。

**理由**：
- 现有代码已经使用这个机制，稳定可靠
- 类型安全的RPC调用
- 便于管理多个iframe的通信

**考虑的替代方案**：
- 使用postMessage直接通信：被拒绝，因为缺乏类型安全，代码复杂
- 使用其他RPC库：被拒绝，因为增加依赖，与现有架构不一致

### 4. 实时状态更新机制

**决策**：使用轮询机制，间隔2-3秒，任务完成后停止。

**理由**：
- 后端使用Celery异步任务，没有WebSocket支持
- 轮询实现简单，可靠
- 任务完成后可以停止轮询，减少资源消耗

**考虑的替代方案**：
- 使用WebSocket：被拒绝，因为后端不支持，增加复杂度
- 使用SSE（Server-Sent Events）：被拒绝，因为后端不支持
- 使用更短的轮询间隔：被拒绝，因为会增加服务器压力

### 5. Edit功能的更新策略

**决策**：Edit时通过hostController.updateSuggestion通知更新，前端使用500ms debounce同步到后端API。

**理由**：
- 避免频繁的API调用
- 保持用户体验流畅
- 防止网络请求拥塞

**考虑的替代方案**：
- 每次修改立即同步：被拒绝，因为会导致频繁API调用
- 只在关闭对话框时同步：被拒绝，因为可能导致数据丢失

## Data Model

### Existing Model (No Changes Required)

使用后端已实现的数据模型：

**CTAGenerationJob** - 批量CTA生成任务
- `id`: UUID
- `name`: string（格式：[Username]-CTA-[yyyy-mm-dd hh:ss]）
- `input`: Array<{url: string, variant: number}>
- `cta_infos`: CTAInfo[]
- `success_count`: number（计算属性）
- `failed_count`: number（计算属性）
- `total_count`: number（计算属性）
- `is_completed`: boolean（计算属性）
- `user`: User
- `workspace`: Workspace
- `created_at`: datetime
- `updated_at`: datetime

**CTAInfo** - 单个CTA生成信息
- `id`: UUID
- `job`: CTAGenerationJob（外键）
- `url`: string
- `product`: ECommerceProduct（外键，可为空）
- `suggestion`: JSON（包含生成的CTA内容）
- `status`: enum（pending/analyzing/generating_image/generating_suggestion/done/failed）
- `retry_count`: number
- `error_message`: string（可为空）
- `created_at`: datetime
- `updated_at`: datetime

### API Response Format

**创建任务**
```
POST /tools/llm_editor/cta-batch/jobs/
Request: {input: [{url: string, variant: number}]}
Response: {
  task_id: string,
  id: string,
  name: string,
  input: [...],
  cta_infos: [...],
  success_count: 0,
  failed_count: 0,
  total_count: N,
  is_completed: false,
  ...
}
```

**获取任务列表**
```
GET /tools/llm_editor/cta-batch/jobs/?page=1&page_size=20
Response: {
  count: number,
  next: string | null,
  previous: string | null,
  results: CTAGenerationJob[]
}
```

**获取单个任务**
```
GET /tools/llm_editor/cta-batch/jobs/{id}/
Response: CTAGenerationJob（包含cta_infos详情）
```

**更新CTAInfo**
```
PATCH /tools/llm_editor/cta-batch/cta-infos/{id}/
Request: {suggestion: {...}}
Response: CTAInfo
```

## Component Structure

```
webserver/frontend/feature/tool.cta-generator/
├── page/
│   ├── test.tsx                    # 入口页（模式选择，已实现）
│   ├── new-batch.tsx               # 创建页（更新）
│   ├── batch/
│   │   ├── index.tsx               # 列表页（更新）
│   │   └── components/
│   │       └── batch-list-item.tsx # 列表项（更新）
│   └── batch-preview.tsx           # 预览页（更新）
├── component/
│   ├── mode-card.tsx               # 模式卡片（已存在）
│   ├── cta-preview-only-iframe.tsx # 现有预览组件（保持不变）
│   ├── cta-preview.tsx             # 新的CTA预览组件（新增，用于批量功能）
│   └── cta-preview-dialog.tsx      # Edit/View对话框（新增）
├── manager/
│   ├── batch-list-view-controller.ts  # 列表页ViewController（更新，移除Mock，实现轮询）
│   └── batch-preview-view-controller.ts # 预览页ViewController（新增，实现轮询）
├── context/
│   └── batch-list-view-controller-context.tsx  # Context（更新类型）
├── api/
│   └── index.ts                    # API接口（新增批量任务API）
└── type.ts                         # 类型定义（新增后端类型）

webserver/frontend/feature/iframe-controller/
└── creatify-host-controller.ts     # Host控制器（扩展updateSuggestion）

webserver/frontend/public/iframe/
├── cta-generator.html              # 现有iframe页面（保持不变）
└── cta-generator-test.html         # 新的iframe页面（新增，用于批量功能）
```

## Architecture Patterns

1. **MVC架构（ViewController模式）**
   - View：React组件（页面组件、UI组件）- 只负责渲染
   - Controller：ViewController类（业务逻辑、状态管理、轮询逻辑）
   - Model：后端API数据模型

2. **Context模式**
   - 使用React Context传递ViewController实例
   - 避免prop drilling，便于组件访问状态和方法

3. **iframe通信模式**
   - 使用Comlink进行类型安全的RPC通信
   - Host暴露CreatifyHostController实例
   - Iframe通过controller调用host能力
   - 一个controller实例对应一个iframe

4. **轮询模式（在ViewController中实现）**
   - 轮询逻辑应该在ViewController中实现，而不是在页面组件中
   - ViewController提供startPolling和stopPolling方法
   - 页面组件在useEffect中调用这些方法
   - 任务完成时ViewController自动停止轮询
   - 页面卸载时调用stopPolling清理资源

## Risks / Trade-offs

### Risk: iframe性能问题

**风险**：预览页面可能同时加载多个iframe，可能导致性能问题。

**缓解措施**：
- 使用虚拟化列表，只渲染可视区域的iframe
- 延迟加载iframe（lazy loading）
- 限制同时渲染的iframe数量
- 使用轻量级的iframe内容

### Risk: 轮询服务器压力

**风险**：大量用户同时使用批量功能可能导致频繁的API请求，增加服务器压力。

**缓解措施**：
- 设置合理的轮询间隔（2-3秒）
- 任务完成后立即停止轮询
- 页面失去焦点时暂停轮询
- 前端缓存减少重复请求

### Risk: Edit功能的数据一致性

**风险**：多个用户同时编辑可能导致数据覆盖问题。

**缓解措施**：
- 使用乐观更新，先更新UI再同步后端
- 后端实现版本控制或乐观锁（后续）
- 显示最后编辑时间，提醒用户冲突

### Trade-off: 轮询 vs WebSocket

**决策**：使用轮询而非WebSocket。

**影响**：
- 优点：实现简单，可靠，不依赖后端支持
- 缺点：实时性较差，服务器压力较大
- 权衡：对于批量CTA生成场景，轮询已经足够满足需求

### Trade-off: 组件复用 vs 代码冗余

**决策**：创建新组件而非复用现有组件。

**影响**：
- 优点：保持现有组件的稳定性，避免修改风险；新组件可以专注批量功能的需求
- 缺点：增加代码量，需要维护两个类似的组件
- 权衡：现有`CtaPreviewOnlyIframe`可能被其他功能使用，保持不变更安全；批量功能需要的状态显示、Edit/View等新功能与现有组件差异较大

## Migration Plan

### Steps

1. **准备阶段**
   - 创建新的分支
   - 添加API接口定义
   - 添加TypeScript类型定义

2. **组件开发**
   - 实现CTAPreview组件
   - 实现CTAPreviewDialog组件
   - 扩展CreatifyHostController

3. **页面开发**
   - 实现入口页（test.tsx）
   - 实现创建页（new-batch.tsx）
   - 实现列表页（batch/index.tsx）
   - 实现预览页（batch-preview.tsx）

4. **ViewController开发**
   - 移除Mock数据
   - 对接后端API
   - 实现轮询逻辑
   - 实现状态管理

5. **测试和优化**
   - 测试各个页面的功能
   - 测试iframe通信
   - 测试轮询机制
   - 性能优化

6. **部署**
   - Code Review
   - 合并到主分支
   - 部署到生产环境

### Rollback

1. **代码回滚**
   - 通过Git回滚到变更前的版本
   - 恢复原有的路由配置

2. **数据回滚**
   - 不涉及数据库变更，无需数据回滚
   - 后端API保持不变，向前兼容

3. **用户影响**
   - 如果用户正在使用批量功能，回滚后无法继续使用
   - 已创建的任务仍然保存在数据库中，恢复后可以继续访问

## References

### 参考文档
- `.doc/reference/mode-entry.tsx` - 入口页UI参考
- `.doc/reference/model-card.tsx` - 模式卡片UI参考
- `.doc/reference/new-task.tsx` - 创建页UI参考
- `.doc/reference/cta-task-list.tsx` - 列表页UI参考
- `.doc/reference/cta-task-item.tsx` - 列表项UI参考
- `.doc/reference/preview.tsx` - 预览页UI参考

### 相关代码
- `webserver/backend/tools/llm_editor/models.py` - 后端数据模型
- `webserver/backend/tools/llm_editor/views.py` - 后端API实现
- `webserver/backend/tools/llm_editor/serializers.py` - 后端序列化器
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - Host控制器
- `webserver/frontend/public/iframe/cta-generator.html` - 现有iframe实现

### 规范文档
- `.project-rules/frontend/index.md` - 前端开发规范
- `.project-rules/frontend/architecture.md` - 前端架构规范
- `.project-rules/frontend/mvc-architecture.md` - MVC架构规范
