## Context

项目管理系统目前缺少项目详情页面，用户无法查看项目的详细信息。用户需要在项目列表页面点击项目后，能够进入一个专门的项目详情页面，查看项目的基本信息。

当前系统已有：
- 项目列表页面（`/projects`），展示项目的基本信息卡片
- 项目数据模型（`Project`），包含项目的基本字段
- 基础的 API 端点用于获取项目列表

缺失的功能：
- 项目详情页面和路由
- 项目基本信息展示功能

## Goals / Non-Goals

### Goals

- 在项目上下文中提供集中的项目详情页面
- 展示项目的完整信息（名称、描述、创建时间、状态等）
- 保持与现有页面布局的一致性（共享顶部栏和边栏）

### Non-Goals

- 项目成员管理功能（后续功能）
- 项目设置功能（后续功能）
- 移动端适配（后续优化）

## Decisions

### 1. Page Layout Consistency

**决策**：使用与资产页面相同的布局结构（`/mushroom/project/asset`）

**理由**：用户已经熟悉资产页面布局。重用共享的顶部栏和边栏提供了一致的体验并减少了开发工作。

**考虑的替代方案**：
- 基于模态的项目详情：被拒绝，因为项目详情足够复杂，需要完整页面
- 独立的布局结构：被拒绝，因为会增加维护成本并破坏用户体验的一致性

### 2. Routing Strategy

**决策**：使用 TanStack Router 配置路由，路径为 `/projects/:id`

**理由**：
- TanStack Router 是项目标准的路由解决方案
- RESTful 风格的 URL 路径清晰易懂
- 支持类型安全的路由参数

**考虑的替代方案**：
- 使用 Hash Router：被拒绝，因为不利于 SEO 和用户体验
- 使用查询参数传递项目 ID：被拒绝，因为路径参数更符合 RESTful 规范

### 3. Data Fetching Strategy

**决策**：使用 `createAutoKeyMiniQueryClient` 工具管理器进行数据获取，配合客户端缓存

**理由**：
- 保持与 Mushroom 功能其余部分的架构一致性
- 使用项目的标准工具管理器，包含内置的状态管理（loading、data、error）
- 支持自动缓存和重新验证

**考虑的替代方案**：
- 自定义 DataManager：被拒绝，因为工具管理器已能满足需求，无需重复造轮子
- 直接使用 fetch：被拒绝，因为缺少统一的状态管理和错误处理

## Data Model

### Existing Model (No Changes Required)

```python
# webserver/backend/models/project.py
class Project(UUIDModelMixin, TimeStampModelMixin):
    name: CharField
    description: TextField
    status: CharField  # active/archived/deleted
    owner: ForeignKey(User)
    created_at: DateTimeField
    updated_at: DateTimeField
```

### New/Modified Model

无需修改现有数据模型，所有功能基于现有模型实现。

### API Response Format

```json
// GET /api/projects/:id
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "项目名称",
  "description": "项目描述",
  "status": "active",
  "owner": {
    "id": "user-id",
    "name": "所有者姓名",
    "email": "owner@example.com"
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

## Component Structure

```
webserver/frontend/feature/project-detail/
├── page/
│   ├── project-detail-page.tsx              # Entry point
│   └── desktop/
│       └── project-detail-page/
│           ├── index.tsx                    # Desktop page
│           └── project-detail-content-panel.tsx
├── manager/
│   └── project-detail-view-controller.tsx   # ViewController
├── api/
│   └── project.api.ts                       # API client functions
└── component/
    └── project-basic-info.tsx               # 项目基本信息展示
```

```
webserver/backend/api/projects/
├── views.py                                  # ProjectViewSet
└── serializers.py                            # 序列化器
```

## Architecture Patterns

- **Manager Pattern**：使用 ViewController 管理页面状态和业务逻辑
  - `ProjectDetailViewController` 协调页面逻辑
  - 使用 `createAutoKeyMiniQueryClient` 进行数据获取
  - 通过 Context API 提供 ViewController 实例

- **Separation of Concerns**：
  - API 层：纯函数，负责数据请求
  - Manager 层：业务逻辑和状态管理
  - Component 层：UI 展示和用户交互
  - Page 层：页面布局和路由集成

## Risks / Trade-offs

### Risk: Cache Invalidation

**风险**：客户端缓存可能导致数据不一致，特别是在多标签页场景下。

**缓解措施**：
- 实现合理的缓存过期时间（如 5 分钟）
- 使用 TanStack Query 的重新验证机制

### Trade-off: Data Freshness vs Performance

**决策**：优先考虑性能，使用缓存策略减少 API 调用。

**影响**：
- 优点：减少服务器负载，提升用户体验
- 缺点：数据可能不是最新的
- 权衡：通过合理的缓存过期时间平衡数据新鲜度和性能

## Open Questions

1. **项目详情页面是否需要支持标签页（Tabs）？**
   - 假设：当前不需要，后续功能扩展时再考虑
   - 待确认：是否需要预留标签页结构

2. **项目不存在时的错误处理方式**
   - 假设：显示友好的错误提示，提供返回项目列表的链接
   - 待确认：是否需要记录错误日志

## Migration Plan

### Steps

1. **Phase 1: Infrastructure (T-001)**
   - 创建路由配置和占位页面
   - 建立基础的页面结构

2. **Phase 2: Navigation (T-002)**
   - 实现从项目列表到详情页的跳转
   - 测试路由和导航功能

3. **Phase 3: Basic Info Display (T-003)**
   - 实现项目基本信息展示
   - 集成 API 调用和数据展示

### Rollback

- **代码回滚**：通过 Git 回滚到之前的版本
- **数据库变更**：无需数据库变更，无需回滚
- **API 变更**：如果添加了新的 API 端点，可以通过 URLconf 禁用
- **路由变更**：删除路由配置文件即可禁用页面访问
- **功能降级**：如果出现问题，可以临时禁用项目详情页面，用户仍可使用项目列表

## References

- `.project-rules/frontend/architecture.md` - 前端架构规范
- `.project-rules/frontend/mvc-architecture.md` - MVC 架构模式
- `.project-rules/frontend/utility-managers.md` - 工具管理器使用指南
- `.project-rules/backend/index.md` - 后端开发规范
