# Change: complete-mushroom-service-decoupling

## 概述

在现有 `decouple-mushroom-auth-user` 任务的基础上，完成 Mushroom 模块内所有对主站 AuthService 和 UserService 依赖的替换，实现完全解耦。

## 状态

- **状态**: Pending
- **优先级**: Medium
- **负责人**: 未分配
- **开始日期**: 待定
- **预计完成日期**: 待定

## 依赖

- **依赖项**: `decouple-mushroom-auth-user`
- **依赖说明**: 本任务依赖于 `decouple-mushroom-auth-user` 的完成，需要 MushroomAuthManager 和 MushroomUserManager 已经创建并集成到 MushroomController

## 相关文件

- **提案**: `proposal.md`
- **任务列表**: `tasks.md`
- **设计文档**: 无（不需要额外设计文档）

## 任务列表

- [ ] T-001: 替换 UserAvatarDropdown 中的 AuthService 和 UserService 使用
- [ ] T-002: 替换 ShortLinkRedirectPage 中的 AuthService 使用
- [ ] T-003: 移除 MushroomProjectManager 中的 AuthService 依赖
- [ ] T-004: 替换 InvitePage 中的 AuthService 使用（保留主站 AuthService，添加注释）
- [ ] T-005: 替换 ProjectsPage 中的 UserService 使用
- [ ] T-006: 替换 ShareTopBar 中的 UserService 使用
- [ ] T-007: 更新文档和注释

## 影响范围

### 前端文件

- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx`
- `webserver/frontend/feature/mushroom/component/short-link-redirect-page.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/mushroom-project-manager.ts`
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/project-dashboard-view-controller.ts`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/index.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/invite-page.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/share/block/share-topbar.tsx`
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts`
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts`
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`

### 文档文件

- `webserver/frontend/feature/mushroom/SERVICE_DECOUPLING.md`（新建）

## 验收标准

1. 所有 UI 组件不再直接导入或使用主站的 AuthService 和 UserService
2. 所有登录、登出、用户信息获取功能正常工作
3. 所有现有测试通过，无功能回归
4. 新增文档清楚说明解耦状态和特殊情况

## 风险和注意事项

1. **权限管理**: NewPermissionManager 和 PermissionManager 继续使用 UserService，这是设计决策，不是遗漏
2. **邀请流程**: InvitePage 继续使用主站 AuthService，因为邀请流程是跨模块功能
3. **全局 Controller**: ShortLinkRedirectPage 需要通过 getGlobalMushroomController 获取 Manager
4. **向后兼容**: 需要确保不破坏现有功能

## 变更历史

- 2025-02-05: 创建 change 文档
