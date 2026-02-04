# T-001 搭建 MushroomAuthManager 基础结构

## 需求描述

在 Mushroom 模块内新增 `MushroomAuthManager`，提供独立的登录状态管理、弹窗控制与广播同步能力。该 Manager 需复用现有登录 API/存储工具，但不依赖主站 `IAuthService`。同时遵循 Manager 生命周期规范，提供 `bootstrap` 与 `dispose`。

**需求类型**：Refactor / Enhancement

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 模式与生命周期要求
- `.project-rules/frontend/directory-structure.md` - Feature 目录结构规范
- `.project-rules/frontend/refactoring.md` - 重构流程与输出物要求
- `.project-rules/frontend/workflow-refactor.md` - 重构步骤与验证

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/` - 新 Manager 目录位置
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - 管理器注入位置
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 可复用的底层登录流程
- `webserver/frontend/feature/services/broadcast-channel-service.type.ts` - 广播服务类型
- `webserver/frontend/feature/services/storage-service/` - token 与存储工具

## 注意点

- `MushroomAuthManager` 必须独立于 `IAuthService`。
- 继续使用 BroadcastChannel 进行多标签页登录状态同步。
- 继续使用 `dialogManager` 管理弹窗实例。
- 需要暴露 `checkLogin`、`signOut`、`onDidIdentify`、`onSignOut` 等接口以供 Mushroom 其它模块使用。
- 生命周期：`bootstrap` 初始化监听与状态，`dispose` 清理监听。
- 主站与 Mushroom 共享 token，但各自 bootstrap 登录相关状态；跨模块跳转允许重新 bootstrap。
- 需要提供与 `identifyBarrier` 等价的时序保障，避免未完成 refresh 即触发权限/数据拉取。
- 保持登录弹窗 resolve/hide/close 的语义顺序，避免 `checkLogin` 误判为中断。
- 迁移 `onDidIdentify` / `onSignOut` 监听链，确保列表刷新与退出清理一致。
- 移动端分支行为需保持（hideAll + 跳转），避免移动端卡顿或逻辑不一致。

## Scenario

### Scenario 1:
    用户进入 Mushroom 页面后触发登录检查

    **场景描述：**
    用户访问 Mushroom 页面，系统需要弹出登录弹窗并完成登录流程。

## Checklist

- [ ] C-001 新增 `MushroomAuthManager` 类并实现 `bootstrap` / `dispose`
- [ ] C-002 复用底层登录 API/存储工具，不依赖 `IAuthService`
- [ ] C-003 支持 BroadcastChannel 的登录/退出同步
- [ ] C-004 支持弹窗管理（`dialogManager`）
- [ ] C-005 对外暴露登录相关能力（`checkLogin`/`signOut` 等）

---

# T-002 迁移 Mushroom 内全部 Auth 依赖

## 需求描述

将 Mushroom 模块内所有对 `IAuthService` 的使用迁移到 `MushroomAuthManager`。迁移点包含登录检查、登出、权限刷新触发等调用，确保 Mushroom 内不再依赖主站 AuthService。

**需求类型**：Refactor

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 依赖注入与层次结构
- `.project-rules/frontend/refactoring.md` - 重构流程
- `.project-rules/frontend/workflow-refactor.md` - 重构验证要求

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/index.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/mushroom-project-manager.ts`
- `webserver/frontend/feature/mushroom/manager/workspace-manager.ts`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/invite-page.tsx`
- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/project-dashboard-view-controller.ts`

## 注意点

- 确保所有 `IAuthService` 引用清理完毕。
- 迁移后行为保持一致（登录触发、登出流程、广播监听）。
- 不引入主站登录的行为变化。

## Scenario

### Scenario 1:
    Mushroom 内任意登录/登出触发点均使用 MushroomAuthManager

    **场景描述：**
    用户在 Mushroom 页面触发登录或退出，调用链不再经过 `IAuthService`。

## Checklist

- [ ] C-001 `mushroom-bootstrap.tsx` 使用 `MushroomAuthManager.checkLogin`
- [ ] C-002 `mushroom-project-manager.ts` 的登录事件监听迁移完成
- [ ] C-003 `workspace-manager.ts` 的登录判断迁移完成
- [ ] C-004 `invite-page.tsx`、`user-avatar-dropdown.tsx` 迁移完成
- [ ] C-005 `project-dashboard-view-controller.ts` 依赖迁移完成

---

# T-003 解耦 MushroomLoginModal 与 AuthService

## 需求描述

`MushroomLoginModal` 改为依赖 `MushroomAuthManager` 而非 `IAuthService`；主站 AuthService 移除 Mushroom UI 相关逻辑（不再 import / show `MushroomLoginModal`），避免主站与 Mushroom 的 UI 耦合。

**需求类型**：Refactor

**涉及领域**：前端

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 模块边界与依赖关系
- `.project-rules/frontend/refactoring.md` - 重构流程
- `.project-rules/frontend/workflow-refactor.md` - 重构验证要求

**前端Code Point:**
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
- `webserver/frontend/feature/services/auth-service/auth-service.ts`
- `webserver/frontend/feature/services/auth-service/login-manager.ts`

## 注意点

- `MushroomLoginModal` UI 与交互保持不变。
- 主站 AuthService 行为保持不变（仅移除 Mushroom 特化分支）。
- 需要确保 `checkLogin` 的调用链在 Mushroom 内部闭环。

## Scenario

### Scenario 1:
    Mushroom 登录弹窗独立运行

    **场景描述：**
    Mushroom 弹窗登录流程不再依赖主站 AuthService，且登录成功后行为一致。

## Checklist

- [ ] C-001 `MushroomLoginModal` 不再依赖 `IAuthService`
- [ ] C-002 AuthService 移除 Mushroom 特化 UI 分支
- [ ] C-003 主站登录流程不回归
- [ ] C-004 Mushroom 登录流程保持一致
