## Context

Mushroom 登录逻辑当前依赖主站 `AuthService`，在 AuthService 内部通过路由分支展示 `MushroomLoginModal`。该耦合导致模块边界不清晰，且违反“功能模块不应依赖全局 Service 特化 UI”的原则。本次改造需要在不影响主站登录的前提下，将 Mushroom 登录逻辑独立出来。
同时主站与 Mushroom 仍需共享登录态，仅共享 token（access/refresh），各自独立 bootstrap 登录相关状态。跨模块跳转时需允许各自重新 bootstrap，这是可接受行为。

## Goals / Non-Goals

### Goals

- 新增 `MushroomAuthManager`，承载 Mushroom 登录与登出流程。
- 清理 Mushroom 模块对 `IAuthService` 的依赖。
- 保持现有登录 UI/交互与后端认证机制不变。
- 明确共享 token、独立 bootstrap 的行为边界。

### Non-Goals

- 不改动后端认证接口与 token/cookie 机制。
- 不改动主站登录 UI 与行为。
- 不做 Mushroom 登录 UI 重设计。

## Decisions

### 1. 独立 Manager 承载登录逻辑

**决策**：在 `webserver/frontend/feature/mushroom/manager/` 新增 `MushroomAuthManager`，由 `MushroomController` 创建并对外暴露。

**理由**：
- 遵循 Manager 模式，保证模块内部逻辑闭环。
- 便于 Mushroom 其它 Manager/页面通过 Controller 获取并使用。

**考虑的替代方案**：
- 在 `MushroomBootstrap` 内直接维护登录逻辑：被拒绝，生命周期与职责不清晰。
- 继续复用 `IAuthService`：被拒绝，无法实现真正解耦。

### 2. 复用底层登录 API/存储工具

**决策**：`MushroomAuthManager` 允许复用现有登录 API 与存储工具，但不依赖主站 AuthService。

**理由**：
- 认证能力与 token 体系保持一致。
- 降低改造风险，避免影响主站登录。
- 允许主站与 Mushroom 在共享 token 的前提下独立 bootstrap。

**考虑的替代方案**：
- 完全独立的认证体系：被拒绝，成本高且风险大。

### 3. UI 仍使用 dialogManager

**决策**：登录弹窗继续使用 `dialogManager` 管理生命周期。

**理由**：
- 与现有 UI 体系保持一致，避免重复造轮子。

**考虑的替代方案**：
- 独立 Modal 管理：被拒绝，影响范围过大。

## Data Model

### Existing Model (No Changes Required)

不涉及数据模型变更。

### New/Modified Model

无新增模型。

### API Response Format

复用现有认证 API，不新增接口。

## Component Structure

```
webserver/frontend/feature/mushroom/
├── manager/
│   ├── mushroom-controller.ts
│   └── mushroom-auth-manager.ts     # 新增
├── component/
│   └── mushroom-login-modal.tsx     # 改为依赖 MushroomAuthManager
├── block/
│   └── mushroom-bootstrap.tsx       # 登录检查改为调用新 Manager
└── ...（其它子模块）
```

## Architecture Patterns

- **Manager Pattern**：登录逻辑集中在 `MushroomAuthManager` 内部，UI 仅调用 Manager 接口。
- **Dependency Injection**：`MushroomController` 通过构造函数注入依赖，并向下传递 Manager。

## Risks / Trade-offs

### Risk: 主站登录回归

**风险**：移除 AuthService 中 Mushroom 分支可能影响其它路径。

**缓解措施**：
- 保持主站 AuthService 行为与 UI 不变。
- 仅删除 Mushroom 专属 UI 调用分支。

### Risk: 登录时序与事件链断裂

**风险**：Mushroom 侧如果缺失 `identifyBarrier` 等价机制，或 `onDidIdentify` / `onSignOut` 事件无法正确触发，会导致登录后数据不刷新、退出后状态不清空等问题。

**缓解措施**：
- `MushroomAuthManager` 提供与 `identifyBarrier` 等价的屏障与事件接口。
- 迁移 Mushroom 内所有依赖点，保持现有事件触发时序。

### Risk: 弹窗生命周期语义变化

**风险**：登录成功时弹窗 resolve / hide / close 的顺序不一致，可能导致调用方认为登录被中断。

**缓解措施**：
- 保持现有弹窗生命周期语义（resolve 成功后再 hide/close）。

### Trade-off: 复用底层 API

**决策**：复用现有登录 API 与存储工具。

**影响**：
- 优点：改造成本低，风险小。
- 缺点：仍共享认证体系，非完全隔离。
- 衍生影响：主站与 Mushroom 各自 bootstrap 登录相关状态，跨模块跳转会重新 bootstrap（允许且符合预期）。

## Open Questions

无。

## Migration Plan

### Steps

1. 新增 `MushroomAuthManager`，实现 `bootstrap`/`dispose`/`checkLogin` 等接口。
2. 将 Mushroom 内所有 `IAuthService` 使用点迁移到新 Manager。
3. 调整 `MushroomLoginModal` 依赖与 AuthService 逻辑，移除 Mushroom 特化分支。

### Rollback

- 回滚到改造前版本，恢复 `IAuthService` 依赖即可。

## References

- `.doc/desc.md`
- `.project-rules/frontend/architecture.md`
- `webserver/frontend/feature/services/auth-service/auth-service.ts`
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
