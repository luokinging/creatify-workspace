## Context

Mushroom 模块目前有一个 `MushroomTag` 模型，通过 `MushroomTagViewSet` 提供基本的 CRUD 操作。标签用于评估工单，但缺少专门的管理界面。用户需要：
1. 一目了然地查看项目中的所有标签
2. 识别他们个人使用过的标签
3. 查找并清理未使用的标签
4. 通过确认删除单个标签

## Goals / Non-Goals

### Goals
- 在项目上下文中提供集中的标签管理页面
- 按使用类别（你的标签、所有标签、未使用）组织显示标签
- 启用带确认的单个标签删除
- 启用未使用标签的批量删除
- 保持与现有资产页面布局的一致性（共享顶部栏和边栏）

### Non-Goals
- 在此页面上创建/编辑标签（可以通过工单编辑完成）
- 标签重命名功能
- 高级标签过滤或搜索
- 移动响应式布局（最初仅桌面版）

## Decisions

### 1. Page Layout Consistency
**决策**：使用与资产页面相同的布局结构（`/mushroom/project/asset`）

**理由**：用户已经熟悉资产页面布局。重用共享的顶部栏和边栏提供了一致的体验并减少了开发工作。标签页面支持与资产页面相同的左侧边栏切换。

**考虑的替代方案**：
- 基于模态的标签管理器：被拒绝，因为标签足够复杂，需要完整页面

### 2. Tag Grouping Strategy
**决策**：基于使用模式的三个组：
- **Your Tags**：当前用户至少附加过一次的标签
- **All Tags**：项目中的所有标签（用户的标签 + 其他用户的标签）
- **Unused Tags**：`usage_count = 0` 的标签（未附加到任何工单）

**理由**：这与 UI 要求一致，并为不同用户需求提供了清晰的关注点分离。标签类型遵循后端模型：`COMMON`、`PROJECT`、`AI`，所有类型在每个组内一起显示。

### 3. Backend API Design
**决策**：增强现有的 `MushroomTagViewSet`：
- 新端点 `/api/mushroom/tags/usage/` 用于获取标签使用统计
- 过滤参数 `?project=<id>` 已存在
- 在列表响应中添加使用计数注释

**理由**：对现有 API 的最小更改，利用当前模式。

**考虑的替代方案**：
- 单独的标签统计端点：被拒绝，因为对当前需求过度设计
- GraphQL：被拒绝，因为项目使用 REST

### 4. Delete Interaction
**决策**：悬停仅对 `usage_count = 0` 的标签显示关闭按钮，点击触发 AlertDialog 确认

**理由**：
- 匹配现有的 `ClosableWrapper` 组件模式（`webserver/frontend/feature/common/component/closable-wrapper.tsx`）
- 防止意外删除正在使用的标签
- `usage_count > 0` 的标签无法删除（不显示按钮）
- 通过确认对话框提供防止意外删除的安全性

### 5. Frontend Architecture
**决策**：遵循 Manager 模式：
- `TagsViewController` 协调页面逻辑
- `createAutoKeyMiniQueryClient` 用于标签获取（使用工具管理器模式，不需要自定义 DataManager）
- 可重用的 `TagGroupContainer` 组件用于一致的 UI

**理由**：
- 保持与 Mushroom 功能其余部分的架构一致性
- 使用项目的标准工具管理器（`createAutoKeyMiniQueryClient`），它包含内置的状态管理（loading、data、error）
- 遵循 `.project-rules/frontend/utility-managers.md` 指南

## Data Model

### Existing Model (No Changes Required)
```python
class MushroomTag(UUIDModelMixin, TimeStampModelMixin):
    name: CharField
    tag_type: CharField  # common/project/ai
    is_system: BooleanField
    project: ForeignKey(MushroomNodeProject, null=True)
```

### New Backend Response Format
```python
# GET /api/mushroom/tags/usage/?project=<id>
{
    "your_tags": [
        {"id": "...", "name": "urgent", "usage_count": 5}
    ],
    "all_tags": [
        {"id": "...", "name": "urgent", "usage_count": 5},
        {"id": "...", "name": "feedback", "usage_count": 0}
    ],
    "unused_tags": [
        {"id": "...", "name": "feedback", "usage_count": 0}
    ]
}
```

## Component Structure

```
feature/mushroom/sub-feature/project-management/
├── page/
│   ├── tags-page.tsx              # Entry point
│   └── desktop/
│       └── tags-page/
│           ├── index.tsx          # Desktop tags page
│           └── tags-content-panel.tsx
├── manager/
│   └── tags/
│       └── tags-view-controller.tsx
├── api/
│   └── tags.api.ts                # API client functions
├── component/
│   └── tag-group-container.tsx    # Reusable tag group component
└── context/
    └── tags-view-controller-context.tsx
```

Note: No `tags-data-manager.ts` needed - using `createAutoKeyMiniQueryClient` utility instead.

## Risks / Trade-offs

### Risk: Tag Usage Performance
**风险**：对于有许多工单的项目，跨所有工单计算标签使用可能很慢。

**缓解措施**：
- 使用带索引的数据库聚合
- 考虑缓存使用计数
- 如果标签列表增长很大，添加分页

### Trade-off: System Tag Deletion
**决策**：系统标签（`is_system=True`）已通过 API 受到删除保护。前端不应为系统标签显示删除按钮。

### Trade-off: Unused Tag Detection
**方法**：如果 `usage_count = 0`，则标签是"未使用的"。这意味着它存在但未附加到任何评估工单。

## Open Questions

1. **"Your Tags" 是否应包括系统标签？**
   - 假设：是的，如果用户已将它们附加到工单

2. **标签分组澄清**
   - **Your Tags**：当前用户至少附加过一次的标签
   - **All Tags**：项目中的所有标签（包括当前用户的标签 + 其他用户的标签）
   - **Unused Tags**：所有用户中 `usage_count = 0` 的标签
   - 标签类型（`COMMON`、`PROJECT`、`AI`）在每个组内一起显示

## Migration Plan

### Steps
1. Backend: 添加使用统计端点
2. Frontend: 创建标签页面组件
3. 添加路由配置
4. 添加侧边栏标签按钮
5. 使用示例数据测试

### Rollback
- 删除路由和按钮
- 可以通过从 URLconf 中删除来禁用后端端点
- 无需回滚数据库更改
