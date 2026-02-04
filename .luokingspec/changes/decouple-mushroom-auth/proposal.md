# Proposal: Mushroom 登录逻辑解耦主站 AuthService

## 需求摘要

将 Mushroom 登录前端逻辑从主站 AuthService 中剥离，建立独立的 `MushroomAuthManager`，保证 Mushroom 登录流程独立且不影响主站登录。

## 背景与动机

- 目前 Mushroom 登录依赖主站 `IAuthService` 与 `AuthService` 的路由分支逻辑，存在模块间耦合。
- 需求明确要求将 Mushroom 登录模块从主站剥离，形成独立的前端登录逻辑。
- 该改动影响范围较大，需要梳理依赖与模块职责，确保主站登录不被影响。
- 主站与 Mushroom 仍需共享登录态，仅共享 token（access/refresh），各自独立 bootstrap 登录相关状态。

## 目标与成功标准

- Mushroom 登录逻辑不再依赖 `IAuthService`，由独立 `MushroomAuthManager` 负责。
- 主站 AuthService 不再感知/使用 Mushroom 登录 UI。
- 主站登录行为保持不变，Mushroom 登录行为保持不变。

**成功标准**：
- Mushroom 内所有 `IAuthService` 使用点迁移完成。
- `MushroomLoginModal` 不再依赖 `IAuthService`。
- 主站登录流程与 UI 行为无回归。

## 范围与边界

### In Scope（本次包含）

- 新增 `MushroomAuthManager` 并接入 Mushroom 生命周期。
- Mushroom 内所有 `IAuthService` 使用点迁移到新 Manager。
- `MushroomLoginModal` 改为依赖 `MushroomAuthManager`。
- 主站 AuthService 中去除 Mushroom UI 分支逻辑。
- 明确“共享 token、独立 bootstrap”的行为与边界。

### Out of Scope（本次不包含）

- 后端认证接口与 token/cookie 体系变更 — 继续复用现有体系。
- 登录 UI 视觉与交互调整 — 保持现状。
- 主站登录逻辑改造 — 保持现状。

## 用户/系统场景

### 场景 1：Mushroom 触发登录

- **谁**：访问 Mushroom 模块的用户
- **何时/条件**：未登录或需要强制登录
- **做什么**：触发登录弹窗并完成登录
- **得到什么**：登录成功后保持现有页面与流程行为

### 场景 2：Mushroom 内退出登录

- **谁**：已登录用户
- **何时/条件**：点击退出登录
- **做什么**：退出登录并清理状态
- **得到什么**：跳转至 `/mushroom/projects`，状态清理完整

### 场景 3：多标签页登录状态同步

- **谁**：多标签页用户
- **何时/条件**：任一标签页登录/退出
- **做什么**：广播同步登录状态
- **得到什么**：各标签页一致刷新

## 约束与假设

### 约束

- 继续复用现有认证接口与 token/cookie 体系。
- 登录方式保留：SSO / Google / 密码登录。
- 登录成功后保持现有刷新/路由行为。
- 继续使用 `dialogManager` 与 BroadcastChannel。
- 退出登录行为与主站一致，跳转至 `/mushroom/projects`。
- 主站与 Mushroom 共享 token，但各自独立 bootstrap 登录相关状态。
- 需保持移动端登录分支行为一致（hideAll + 跳转）。
- 需保持弹窗生命周期语义一致（resolve 后 hide/close）。

### 假设

- `MushroomAuthManager` 可复用现有底层登录 API/存储工具，但不依赖主站 AuthService。
- Mushroom 仅需独立前端登录逻辑，不影响主站认证链路。

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MushroomAuthManager | Mushroom 领域登录管理器 | 新增 Manager |
| AuthService | 主站认证服务 | 保持不变 |
| MushroomLoginModal | Mushroom 登录弹窗 | UI 保持不变 |

## 参考与链接

- 需求描述：`.doc/desc.md`
- 现有登录服务：`webserver/frontend/feature/services/auth-service/auth-service.ts`
- Mushroom 入口：`webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx`
- Mushroom 管理器：`webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`
- Mushroom 登录 UI：`webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
