# 实现决策记录

在开始任务前，记录以下确认的决策：

1. **`short-link-redirect-page.tsx` 的处理**：保持使用 `getService(IAuthService)`，因为该页面不在 MushroomBootstrap 内部，只做简单的登录检查和跳转。

2. **`MushroomLoginModal` 获取 authManager 方式**：通过 props 传入 authManager，不创建额外 context。

3. **Google One Tap 支持**：支持，在 MushroomAuthManager 中实现。**关键点**：需要根据当前页面位置（mushroom vs 主站）触发对应的 bootstrap 流程。

---

# T-001 创建 MushroomUserManager 用户状态管理器

## 需求描述

创建独立的 `MushroomUserManager`，负责 Mushroom 模块的用户状态管理。该 Manager 需要实现与主站 `UserService` 类似的功能，但使用内部 Store，不依赖全局状态。

**需求类型**：Infrastructure

**涉及领域**：前端

核心功能：
- 维护用户信息状态（user store）
- 提供用户信息的获取和更新方法
- 提供用户信息变化的订阅机制
- 提供等待用户信息加载完成的异步方法

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 设计模式

**前端Code Point:**
- `webserver/frontend/feature/services/user-service/user-service.ts` - 参考主站实现
- `webserver/frontend/feature/services/user-service/user-store.ts` - 参考 Store 结构
- `webserver/frontend/feature/account/type.ts` - UserType 定义

## 注意点

- 使用内部 `readonly store = createStore(immer(combine(initialState, () => ({}))))` 
- 不要使用全局 Store
- 需要与 `MushroomAuthManager` 协同工作
- 需要提供 `onUserInfoChange` 订阅机制供其他 Manager 使用

## Scenario

### Scenario 1: 登录后设置用户信息

**场景描述：**
用户登录成功后，`MushroomAuthManager` 调用 `MushroomUserManager.setUserInfo()` 设置用户信息，其他订阅者收到通知。

## Checklist

- [x] C-001 创建 `mushroom-user-manager.ts` 文件
- [x] C-002 实现内部 Store，包含 `user` 字段
- [x] C-003 实现 `setUserInfo(user: UserType)` 方法
- [x] C-004 实现 `resetUser()` 方法，重置为默认用户
- [x] C-005 实现 `onUserInfoChange(listener)` 订阅方法，返回取消订阅函数
- [x] C-006 实现 `waitUserInfoLoaded()` 异步方法
- [x] C-007 实现 `refreshUser()` 方法，从 API 获取最新用户信息
- [x] C-008 实现 `dispose()` 方法清理资源

---

# T-002 创建 MushroomAuthManager 认证管理器 (deps: T-001)

## 需求描述

创建独立的 `MushroomAuthManager`，负责 Mushroom 模块的所有认证逻辑。该 Manager 需要实现登录、登出、认证状态检查等功能，并与 `MushroomUserManager` 协同工作。

**需求类型**：Infrastructure

**涉及领域**：前端

核心功能：
- 管理认证状态（inAuthProgress, isUserInfoLoadCompleted 等）
- 实现 `identifyBarrier` 用于异步协调
- 实现登录方法（密码登录、Google 登录、SSO 登录）
- 实现登出方法（同时清理主站状态）
- 实现 `checkLogin()` 弹出登录框
- 提供登录/登出事件订阅机制

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - Manager 设计模式

**前端Code Point:**
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 参考主站实现
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 参考登录逻辑
- `webserver/frontend/feature/account/api/user.client.ts` - 登录 API
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - 登录弹窗

## 注意点

- 使用内部 Store，不使用全局 Store
- 登出时需要发送 BroadcastChannel 消息同步主站
- `checkLogin()` 需要判断是否在 Mushroom 路由下
- 需要支持 Google 登录和 SSO 登录
- 需要实现 `bootstrapAuth()` 初始化认证状态

## Scenario

### Scenario 1: 用户密码登录

**场景描述：**
用户在 MushroomLoginModal 输入邮箱密码，调用 `authManager.loginManager.loginWithPassword()`，成功后更新用户状态，打开 identifyBarrier。

### Scenario 2: 用户登出

**场景描述：**
用户点击登出，调用 `authManager.userSignOut()`，清理 Cookie，重置用户状态，发送 BroadcastChannel 消息，触发登出监听器，跳转到项目列表页。

## Checklist

- [x] C-001 创建 `mushroom-auth-manager.ts` 文件
- [x] C-002 实现内部 Store，包含 `inAuthProgress`, `isUserInfoLoadCompleted`, `enableApiCallAfterSignIn`, `otp_secret` 字段
- [x] C-003 实现 `identifyBarrier` 使用 `Barrier` 类
- [x] C-004 实现 `bootstrapAuth()` 方法，初始化认证状态
- [x] C-005 实现内嵌的 `MushroomLoginManager` 类，支持：
  - `loginWithPassword()` - 密码登录
  - `loginWithGoogle()` - Google 登录
  - `loginWithGoogleOneTap()` - Google One Tap 登录
  - `loginWithTokens()` - Token 直接登录
- [x] C-006 实现 `checkLogin()` 方法，未登录时弹出 MushroomLoginModal（通过 props 传入 authManager）
- [x] C-007 实现 `userSignOut()` 方法，包含清理 Cookie、发送 BroadcastChannel、重置用户状态
- [x] C-008 实现 `signOut()` 内部方法（不发送 BroadcastChannel）
- [x] C-009 实现 `onSignOut(listener)` 订阅方法
- [x] C-010 实现 `onDidIdentify(listener)` 订阅方法
- [x] C-011 实现 BroadcastChannel 监听，响应跨标签页登录/登出事件
- [x] C-012 实现 `checkPromptGoogleOneTap()` 方法，检测并触发 Google One Tap 登录
  - **关键**：登录成功后调用 Mushroom 的 `bootstrapAuth()`，而不是主站的
- [x] C-013 实现 `dispose()` 方法清理资源

---

# T-003 集成 Manager 到 MushroomController (deps: T-001, T-002)

## 需求描述

将新创建的 `MushroomAuthManager` 和 `MushroomUserManager` 集成到 `MushroomController` 中，使其成为 Mushroom 模块的认证和用户管理入口。

**需求类型**：Infrastructure

**涉及领域**：前端

核心改动：
- 在 `MushroomController` 构造函数中创建 `MushroomUserManager` 和 `MushroomAuthManager`
- 暴露这两个 Manager 供其他模块使用
- 更新 `bootstrap()` 方法调用 `authManager.bootstrapAuth()`

## 相关指引

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - 需要修改

## 注意点

- `MushroomAuthManager` 需要 `MushroomUserManager` 作为依赖
- 需要移除对 `IUserService` 的构造函数依赖
- `combinedStore` 需要包含新 Manager 的 store

## Scenario

### Scenario 1: Mushroom 模块初始化

**场景描述：**
`MushroomBootstrap` 创建 `MushroomController` 时，内部自动创建 `MushroomUserManager` 和 `MushroomAuthManager`，然后调用 `bootstrap()` 初始化。

## Checklist

- [x] C-001 移除 `MushroomController` 构造函数对 `userService: IUserService` 的依赖
- [x] C-002 在构造函数中创建 `MushroomUserManager` 实例
- [x] C-003 在构造函数中创建 `MushroomAuthManager` 实例
- [x] C-004 添加 `readonly userManager: MushroomUserManager` 属性
- [x] C-005 添加 `readonly authManager: MushroomAuthManager` 属性
- [x] C-006 更新 `combinedStore` 包含新 Manager 的 store
- [x] C-007 更新子 Manager（WorkspaceManager, NewPermissionManager）使用新的 userManager
- [x] C-008 更新 `bootstrap()` 方法，在 `isLoggedIn` 时调用 `authManager.bootstrapAuth()`
- [x] C-009 更新 `dispose()` 方法，调用新 Manager 的 dispose

---

# T-004 迁移 Bootstrap 和组件层调用点 (deps: T-003)

## 需求描述

将 `mushroom-bootstrap.tsx`、`mushroom-login-modal.tsx`、`user-avatar-dropdown.tsx` 等组件中对 `IAuthService` 和 `IUserService` 的直接调用迁移到使用 `MushroomController` 中的新 Manager。

**需求类型**：Refactor

**涉及领域**：前端

需要迁移的文件：
1. `mushroom-bootstrap.tsx` - 移除 `getService(IAuthService)`，使用 `mushroomController.authManager`
2. `mushroom-login-modal.tsx` - 通过 **props** 接收 `authManager`，使用其 `loginManager.loginWithPassword()`
3. `user-avatar-dropdown.tsx` - 使用 `authManager.checkLogin()` 和 `authManager.userSignOut()`
4. `invite-page.tsx` - 使用 `authManager.checkLogin()`

**不需要迁移的文件：**
- `short-link-redirect-page.tsx` - **保持使用 `getService(IAuthService)`**，因为该页面不在 MushroomBootstrap 内部，只做简单登录检查和跳转

## 相关指引

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx`
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/invite-page.tsx`

## 注意点

- `MushroomLoginModal` 通过 **props** 接收 `authManager`（已确认决策）
- `short-link-redirect-page.tsx` **保持现状**，不需要迁移（已确认决策）
- `invite-page.tsx` 在 `MushroomBootstrap` 内部，可以使用 `useMushroomController()`

## Scenario

### Scenario 1: MushroomBootstrap 登录检查

**场景描述：**
用户访问 Mushroom 页面，`MushroomBootstrap` 使用 `mushroomController.authManager.checkLogin()` 检查登录状态。

## Checklist

- [x] C-001 修改 `mushroom-bootstrap.tsx`：
  - 移除 `getService(IAuthService)` 调用
  - 使用 `mushroomController.authManager.checkLogin()` 替代
  - 在弹出 MushroomLoginModal 时，通过 props 传入 `authManager`
- [x] C-002 修改 `mushroom-login-modal.tsx`：
  - 添加 `authManager: MushroomAuthManager` prop
  - 使用 `authManager.loginManager.loginWithPassword()` 替代 `authService.loginManager.loginWithPassword()`
  - 移除 `useServices(IAuthService)` 调用
- [x] C-003 修改 `user-avatar-dropdown.tsx`：
  - 从 `useMushroomController()` 获取 `authManager` 和 `userManager`
  - 使用 `authManager.checkLogin()` 和 `authManager.userSignOut()` 替代
  - 使用 `userManager.store` 获取用户信息
- [x] C-004 修改 `invite-page.tsx`：
  - 使用 `useMushroomController()` 获取 `authManager`
  - 使用 `authManager.checkLogin()` 替代
- [x] C-005 更新 `share-topbar.tsx`：
  - 使用 `userManager.store` 替代 `IUserService`
- [x] C-006 **不修改** `short-link-redirect-page.tsx`（保持使用主站服务）

---

# T-005 迁移 Manager 层调用点 (deps: T-003)

## 需求描述

将 Mushroom Manager 层中对 `IAuthService` 和 `IUserService` 的直接调用迁移到使用 `MushroomController` 中的新 Manager。

**需求类型**：Refactor

**涉及领域**：前端

需要迁移的文件：
1. `workspace-manager.ts` - 使用 `userManager` 替代 `userService`
2. `new-permission-manager.ts` - 使用 `userManager.onUserInfoChange()` 替代
3. `permission-manager.ts` - 使用 `userManager` 替代
4. `mushroom-platform-integration-manager.ts` - 使用 `userManager` 替代
5. `axon-platform-manager.ts` - 使用 `userManager` 替代
6. `mushroom-project-manager.ts` - 使用 `authManager` 替代

## 相关指引

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/workspace-manager.ts`
- `webserver/frontend/feature/mushroom/manager/new-permission/new-permission-manager.ts`
- `webserver/frontend/feature/mushroom/manager/permission/permission-manager.ts`
- `webserver/frontend/feature/mushroom/manager/platform-integration/mushroom-platform-integration-manager.ts`
- `webserver/frontend/feature/mushroom/manager/platform-integration/axon-platform-manager.ts`
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/mushroom-project-manager.ts`

## 注意点

- `workspace-manager.ts` 中的 `isLoggedInAsync()` 使用了 `getService(IAuthService).identifyBarrier.wait()`，需要改为使用 `authManager.identifyBarrier.wait()`
- 需要更新构造函数签名，将 `IUserService` 替换为 `MushroomUserManager`
- `mushroom-project-manager.ts` 使用 `authService.onSignOut()` 和 `authService.onDidIdentify()`，需要改为 `authManager` 的对应方法

## Scenario

### Scenario 1: WorkspaceManager 检查登录状态

**场景描述：**
`WorkspaceManager.isLoggedInAsync()` 等待 `authManager.identifyBarrier`，然后从 `userManager.store` 获取用户信息。

## Checklist

- [x] C-001 修改 `workspace-manager.ts`：
  - 构造函数接收 `MushroomUserManager` 和 `MushroomAuthManager`
  - 更新 `isLoggedInAsync()` 使用 `authManager.identifyBarrier.wait()`
  - 更新 `getCurrentUser()` 使用 `userManager.store`
  - 更新 `isLoggedIn()` 和 `isGuest()` 使用 `userManager.store`
- [x] C-002 修改 `new-permission-manager.ts`：
  - 构造函数接收 `MushroomUserManager`
  - 更新 `bootstrapEventListeners()` 使用 `userManager.onUserInfoChange()`
- [x] C-003 修改 `permission-manager.ts`：
  - 构造函数接收 `MushroomUserManager`
  - 更新 `fetchUserAccess()` 使用 `userManager.waitUserInfoLoaded()`
  - 更新 `bootstrap()` 使用 `userManager.onUserInfoChange()`
- [x] C-004 修改 `mushroom-platform-integration-manager.ts`：
  - 构造函数接收 `MushroomUserManager`
  - 更新传递给 `AxonPlatformManager` 的参数
- [x] C-005 修改 `axon-platform-manager.ts`：
  - 构造函数接收 `MushroomUserManager`
  - 更新 `combinedStore` 使用 `userManager.store`
- [x] C-006 修改 `mushroom-project-manager.ts`：
  - 构造函数接收 `MushroomAuthManager`
  - 更新 `bootstrapAuthListener()` 使用 `authManager.onSignOut()` 和 `authManager.onDidIdentify()`

---

# T-006 迁移 ViewController 层调用点 (deps: T-003)

## 需求描述

将 ViewController 层中对 `IAuthService` 和 `IUserService` 的直接调用迁移到使用 `MushroomController` 中的新 Manager。

**需求类型**：Refactor

**涉及领域**：前端

需要迁移的文件：
1. `project-dashboard-view-controller.ts` - 使用 `authManager` 传递给 `MushroomProjectManager`
2. `projects/page/index.tsx` - 使用 `userManager` 替代 `userService`

## 相关指引

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/project-dashboard-view-controller.ts`
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/index.tsx`

## 注意点

- `project-dashboard-view-controller.ts` 目前接收 `IAuthService`，需要改为 `MushroomAuthManager`
- `projects/page/index.tsx` 使用 `getService(IUserService)`，需要改为从 `mushroomController` 获取

## Scenario

### Scenario 1: 项目仪表盘初始化

**场景描述：**
`ProjectDashboardPage` 创建 `ProjectDashboardViewController` 时，从 `mushroomController` 获取 `authManager` 传入。

## Checklist

- [x] C-001 修改 `project-dashboard-view-controller.ts`：
  - 构造函数接收 `MushroomAuthManager` 替代 `IAuthService`
  - 更新 `MushroomProjectManager` 的创建
- [x] C-002 修改 `projects/page/index.tsx`：
  - 移除 `getService(IUserService)` 调用
  - 从 `useMushroomController()` 获取 `userManager`
  - 使用 `userManager.waitUserInfoLoaded()` 替代

---

# T-007 处理跳转主站的 Bootstrap 逻辑 (deps: T-003)

## 需求描述

当用户从 Mushroom 模块跳转到主站时，需要确保主站的认证状态正确初始化。需要在跳转前调用主站的 `bootstrapAuth()` 方法。

**需求类型**：Feature

**涉及领域**：前端

核心功能：
- 在 `MushroomAuthManager` 中提供 `navigateToMainSite()` 方法
- 该方法在跳转前调用主站的 `authService.bootstrapAuth()`
- 确保主站用户状态正确初始化

## 相关指引

**前端Code Point:**
- `webserver/frontend/feature/services/app-container-service/app-container.ts` - 主站 bootstrap 逻辑
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 主站 bootstrapAuth

## 注意点

- 需要通过 `getService(IAuthService)` 获取主站的 AuthService
- 这是 Mushroom 唯一需要与主站服务交互的场景
- 跳转主站的入口可能在多处（如 Logo 点击、面包屑导航等）

## Scenario

### Scenario 1: 用户点击 Logo 返回主站

**场景描述：**
用户在 Mushroom 页面点击 Logo，触发 `authManager.navigateToMainSite('/home')`，等待主站 bootstrap 完成后执行跳转。

## Checklist

- [x] C-001 在 `MushroomAuthManager` 中添加 `navigateToMainSite(to: string)` 方法
- [x] C-002 实现方法逻辑：
  - 调用 `getService(IAuthService).bootstrapAuth()` 
  - 等待完成后执行 `router.navigate({ to })`
- [x] C-003 识别所有从 Mushroom 跳转到主站的入口点
- [x] C-004 将这些入口点的跳转逻辑改为使用 `authManager.navigateToMainSite()`
- [ ] C-005 测试跳转后主站用户状态是否正确
