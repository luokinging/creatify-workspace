## Context

Mushroom 模块当前直接依赖主站的 `IAuthService` 和 `IUserService`，导致模块边界不清晰。需要创建独立的 Manager 层来封装认证和用户管理逻辑，实现 Mushroom 模块的自治。

### 当前依赖分析

**依赖 IAuthService 的文件（8个）：**
| 文件 | 使用的方法 |
|------|----------|
| `mushroom-bootstrap.tsx` | `checkLogin()` |
| `mushroom-login-modal.tsx` | `loginManager.loginWithPassword()` |
| `user-avatar-dropdown.tsx` | `checkLogin()`, `userSignOut()` |
| `workspace-manager.ts` | `identifyBarrier.wait()` |
| `mushroom-project-manager.ts` | `onSignOut()`, `onDidIdentify()` |
| `project-dashboard-view-controller.ts` | 传递给 MushroomProjectManager |
| `invite-page.tsx` | `checkLogin()` |
| `short-link-redirect-page.tsx` | `checkLogin()` (**保持不变**) |

**依赖 IUserService 的文件（9个）：**
| 文件 | 使用的方法 |
|------|----------|
| `mushroom-controller.ts` | 构造函数注入 |
| `workspace-manager.ts` | `storeManager.store` |
| `new-permission-manager.ts` | `onUserInfoChange()` |
| `permission-manager.ts` | `waitUserInfoLoaded()`, `storeManager.store` |
| `mushroom-platform-integration-manager.ts` | 传递给子 Manager |
| `axon-platform-manager.ts` | `storeManager.store` |
| `mushroom-bootstrap.tsx` | 传递给 MushroomController |
| `share-topbar.tsx` | `storeManager.store` |
| `projects/page/index.tsx` | `waitUserInfoLoaded()`, `storeManager.store` |

## Goals / Non-Goals

### Goals

- 创建 `MushroomAuthManager` 封装所有认证逻辑
- 创建 `MushroomUserManager` 封装用户状态管理
- 实现完全独立的 Store，不依赖全局 Store
- 支持所有现有登录方式（密码、Google、SSO、Google One Tap）
- 登出时同步清理主站状态
- 从 Mushroom 跳转主站时正确触发主站 bootstrap

### Non-Goals

- 不修改后端 API
- 不修改主站服务代码
- 不创建新的全局 Store

## Resolved Questions

1. **Google One Tap** ✅ 已确认
   - Mushroom 支持 Google One Tap 自动登录
   - **关键实现**：登录成功后根据当前页面位置调用对应的 bootstrap
     - 如果在 mushroom 路由下 → 调用 `MushroomAuthManager.bootstrapAuth()`
     - 如果在主站路由下 → 调用主站的 `authService.bootstrapAuth()`

2. **`short-link-redirect-page.tsx` 处理** ✅ 已确认
   - 该页面保持使用 `getService(IAuthService)`
   - 原因：不在 MushroomBootstrap 内部，只做简单登录检查和跳转

3. **`MushroomLoginModal` 获取 authManager** ✅ 已确认
   - 通过 props 传入 authManager
   - 不创建额外的 context

## Decisions

### 1. Store 设计策略

**决策**：使用内部 readonly store，不使用全局 store

```typescript
readonly store = createStore(immer(combine(initialState, () => ({}))));
```

**理由**：
- 保持 Mushroom 模块的独立性
- 避免与主站 Store 产生耦合
- 符合项目现有 Manager 的设计模式

**考虑的替代方案**：
- 复用主站的 UserStore：被拒绝，因为会产生耦合

### 2. 登录逻辑实现

**决策**：MushroomAuthManager 直接调用后端 API，独立管理登录流程

**理由**：
- 复用现有 API（如 `getAccessTokens`、`loginWithGoogle` 等）
- 登录成功后更新自己的 MushroomUserManager 状态
- 通过 BroadcastChannel 通知主站（保持 Token 同步）

### 3. 登出行为

**决策**：Mushroom 登出时同时清理主站状态

**实现方式**：
1. 调用 Cookie 清理函数（`signOutReset`）
2. 发送 BroadcastChannel 消息通知主站
3. 重置 MushroomUserManager 状态
4. 跳转到项目列表页

### 4. 跳转主站时的 Bootstrap

**决策**：跳转前调用主站的 `bootstrapAuth`

**实现方式**：
```typescript
// 在跳转主站前
const authService = getService(IAuthService);
await authService.bootstrapAuth();
// 然后执行跳转
router.navigate({ to: '/home' });
```

### 5. Google One Tap 支持

**决策**：Mushroom 支持 Google One Tap，根据当前路由决定调用哪个 bootstrap

**实现方式**：
```typescript
async loginWithGoogleOneTap() {
  const { credential } = await googleOneTap();
  const tokens = await loginWithGoogleOneTap({ credential, ... });
  
  // Set cookies
  signInWithTokens(tokens);
  
  // 根据当前路由决定调用哪个 bootstrap
  if (this.isMushroomRoute()) {
    await this.bootstrapAuth(); // Mushroom 的 bootstrap
  } else {
    const authService = getService(IAuthService);
    await authService.bootstrapAuth(); // 主站的 bootstrap
  }
  
  // 发送 BroadcastChannel 通知
  this.broadcastChannelService.sendMessage(...);
}
```

### 6. MushroomLoginModal 获取 authManager

**决策**：通过 props 传入

**实现方式**：
```typescript
// mushroom-auth-manager.ts
async _popupLogin(popupFrom, dialogOptions) {
  const instance = dialogManager.show(MushroomLoginModal, {
    authManager: this,  // 通过 props 传入
    ...dialogOptions,
  });
  // ...
}

// mushroom-login-modal.tsx
interface Props {
  authManager: MushroomAuthManager;
  // ...
}
```

## Data Model

### MushroomAuthManager State

```typescript
interface MushroomAuthState {
  // Whether auth bootstrap is in progress
  inAuthProgress: boolean;
  // Whether user info load is completed
  isUserInfoLoadCompleted: boolean;
  // Whether API calls are enabled after sign in
  enableApiCallAfterSignIn: boolean;
  // OTP secret for magic link login
  otp_secret: string;
}
```

### MushroomUserManager State

```typescript
interface MushroomUserState {
  user: UserType;
}

// UserType from existing type definition
interface UserType {
  id: string;
  email: string;
  nickname?: string;
  picture?: string;
  is_staff?: boolean;
  // ... other fields
}
```

## Component Structure

```
webserver/frontend/feature/mushroom/
├── manager/
│   ├── mushroom-auth-manager.ts      # NEW: 认证管理器
│   ├── mushroom-user-manager.ts      # NEW: 用户管理器
│   ├── mushroom-controller.ts        # MODIFY: 集成新 Manager
│   ├── workspace-manager.ts          # MODIFY: 使用新 Manager
│   ├── new-permission/
│   │   └── new-permission-manager.ts # MODIFY: 使用新 Manager
│   ├── permission/
│   │   └── permission-manager.ts     # MODIFY: 使用新 Manager
│   └── platform-integration/
│       ├── mushroom-platform-integration-manager.ts  # MODIFY
│       └── axon-platform-manager.ts                  # MODIFY
├── block/
│   ├── mushroom-bootstrap.tsx        # MODIFY: 使用新 Manager
│   └── user-avatar-dropdown.tsx      # MODIFY: 使用新 Manager
├── component/
│   ├── mushroom-login-modal.tsx      # MODIFY: 接收 authManager prop
│   └── short-link-redirect-page.tsx  # NO CHANGE: 保持使用主站服务
└── sub-feature/
    └── projects/
        ├── page/
        │   ├── index.tsx             # MODIFY: 使用新 Manager
        │   └── invite-page.tsx       # MODIFY: 使用新 Manager
        └── manager/
            ├── mushroom-project-manager.ts           # MODIFY
            └── project-dashboard-view-controller.ts  # MODIFY
```

## Architecture Patterns

### Manager 内部结构

```typescript
export class MushroomAuthManager {
  // Internal store - not global
  readonly store = createStore(immer(combine(initialState, () => ({}))));
  
  // Barrier for async coordination
  readonly identifyBarrier = new Barrier();
  
  // Login manager for different login methods
  readonly loginManager: MushroomLoginManager;
  
  // Reference to user manager
  private readonly userManager: MushroomUserManager;
  
  // BroadcastChannel for cross-tab communication
  private readonly broadcastChannelService: IBroadcastChannelService;
  
  // Event listeners
  private _signOutListeners: (() => void)[] = [];
  private _onDidIdentifyListeners: (() => void)[] = [];
  
  // Helper to check current route
  protected isMushroomRoute(): boolean {
    return window.location.pathname.startsWith('/mushroom/');
  }
}
```

### 登录流程

```
User Input → MushroomLoginModal
                    ↓
          MushroomAuthManager.loginManager.loginWithPassword()
                    ↓
          Call Backend API (getAccessTokens)
                    ↓
          Set Cookie (signInWithTokens)
                    ↓
          Update MushroomUserManager state
                    ↓
          Fire identifyBarrier.open()
                    ↓
          Send BroadcastChannel message
                    ↓
          Execute afterLogin callback
```

### 登出流程

```
User Click Logout → UserAvatarDropdown
                         ↓
              MushroomAuthManager.userSignOut()
                         ↓
              Reset MushroomUserManager state
                         ↓
              Call signOutReset (clear cookies)
                         ↓
              Send BroadcastChannel message (Logout)
                         ↓
              Fire signOut listeners
                         ↓
              Navigate to projects page
```

### Google One Tap 流程

```
Page Load → checkPromptGoogleOneTap()
                    ↓
          Check: isNotLogin && !isInDisabledRoute && !isInIframe
                    ↓
          Trigger googleOneTap()
                    ↓
          Call Backend API (loginWithGoogleOneTap)
                    ↓
          Set Cookie (signInWithTokens)
                    ↓
          Check: isMushroomRoute()?
                ↓                    ↓
            YES: this.bootstrapAuth()    NO: getService(IAuthService).bootstrapAuth()
                    ↓
          Send BroadcastChannel message
                    ↓
          Execute afterLogin callback (navigate)
```

## Risks / Trade-offs

### Risk: BroadcastChannel 兼容性

**风险**：某些旧浏览器可能不支持 BroadcastChannel

**缓解措施**：
- 现有主站已在使用 BroadcastChannel，说明目标用户群浏览器兼容
- 可以添加 fallback 机制（如 localStorage 事件）

### Trade-off: 代码重复

**决策**：部分登录逻辑与主站 LoginManager 相似

**影响**：
- 需要维护两份相似代码
- 但获得了完全的独立性和灵活性

### Trade-off: `short-link-redirect-page.tsx` 保持依赖主站

**决策**：该页面不迁移，保持使用 `getService(IAuthService)`

**影响**：
- 该页面与主站服务保持耦合
- 但简化了实现，该页面逻辑简单（只做登录检查和跳转）

## Open Questions

1. **Magic Link 重定向**
   - Magic Link 邮件中的链接应该跳转到主站还是 Mushroom？
   - 假设：维持现有行为，根据链接中的 redirect_url 决定

## Migration Plan

### Steps

1. **T-001**: 创建 `MushroomUserManager`
2. **T-002**: 创建 `MushroomAuthManager`（依赖 T-001）
3. **T-003**: 集成到 `MushroomController`（依赖 T-001, T-002）
4. **T-004**: 迁移 Bootstrap 和组件层调用点（依赖 T-003）
5. **T-005**: 迁移 Manager 层调用点（依赖 T-003）
6. **T-006**: 迁移 ViewController 层调用点（依赖 T-003）
7. **T-007**: 处理跳转主站的 Bootstrap 逻辑（依赖 T-003）

### Rollback

- 所有改动在 Mushroom 模块内部，不影响主站
- 如需回滚，恢复对 IAuthService/IUserService 的直接调用即可
- Git 分支可以快速回滚

## References

- 主站 AppContainer: `webserver/frontend/feature/services/app-container-service/app-container.ts`
- 主站 AuthService: `webserver/frontend/feature/services/auth-service/auth-service.ts`
- 主站 LoginManager: `webserver/frontend/feature/services/auth-service/login-manager.ts`
- 主站 UserService: `webserver/frontend/feature/services/user-service/user-service.ts`
- Account API: `webserver/frontend/feature/account/api/user.client.ts`
