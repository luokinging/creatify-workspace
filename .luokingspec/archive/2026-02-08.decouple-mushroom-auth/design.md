## Context

Mushroom 模块当前完全依赖主站的 AuthService 和 UserService 进行认证和用户管理。这导致：

1. **代码耦合严重**：MushroomLoginModal、MushroomBootstrap、UserAvatarDropdown 等组件直接使用 `authService.loginManager`
2. **路由判断散落**：`isMushroomRoute()` 判断逻辑散布在 AuthService 的多个方法中
3. **Google One Tap 冲突**：主站的 Google One Tap 唤起逻辑没有考虑 Mushroom 模块
4. **扩展困难**：无法为 Mushroom 实现独立的认证策略

当前系统架构：
```
AuthService (主站)
├── LoginManager
│   ├── loginWithPassword
│   ├── loginWithGoogle
│   ├── loginWithGoogleOneTap
│   └── checkPromptGoogleOneTap
├── isMushroomRoute() ← 判断逻辑散落
└── _popupLogin() ← 根据 isMushroomRoute() 显示不同弹窗

Mushroom 模块组件
├── MushroomLoginModal → authService.loginManager
├── MushroomBootstrap → authService.checkLogin()
├── UserAvatarDropdown → authService.userSignOut()
└── ShortLinkRedirectPage → authService.checkLogin()
```

目标架构：
```
AuthService (主站) ← 跳过 /mushroom/ 路由
├── LoginManager
└── isMushroomRoute() → 用于判断是否跳过

MushroomController
├── MushroomAuthManager (新建)
│   ├── loginWithPassword
│   ├── loginWithGoogle
│   ├── loginWithGoogleOneTap
│   ├── checkLogin
│   └── signOut
├── MushroomUserManager (新建)
│   ├── UserStore
│   ├── refreshUser
│   └── updateUser
└── 其他 Manager...

Mushroom 模块组件
├── MushroomLoginModal → mushroomAuthManager
├── MushroomBootstrap → mushroomAuthManager
├── UserAvatarDropdown → mushroomAuthManager
└── ShortLinkRedirectPage → mushroomAuthManager
```

## Goals / Non-Goals

### Goals

- 在 mushroom-controller 中创建独立的 MushroomAuthManager
- 在 mushroom-controller 中创建独立的 MushroomUserManager
- Mushroom 模块不再直接依赖主站的 AuthService 和 UserService
- 修改主站 AuthService，跳过 Mushroom 路由的处理
- 修改 AppContainer，让 Mushroom 模块独立处理 Google One Tap
- 保持所有现有功能正常工作

### Non-Goals

- **不修改现有的 AuthService 和 UserService 实现**：保持主站功能不变
- **不实现新的认证方式**：仅迁移现有功能（密码登录、Google OAuth、SSO）
- **不涉及后端 API 变更**：使用现有 API
- **不涉及数据库变更**：无数据层修改
- **Mushroom 其他模块的改造**：仅限认证和用户系统

## Decisions

### 1. Manager 创建策略

**决策**：在 mushroom-controller 目录下创建独立的 Manager 类

**理由**：
- 与现有架构保持一致（WorkspaceManager、PermissionManager 等）
- 便于在 MushroomController 中统一初始化和管理
- 清晰的模块边界

**考虑的替代方案**：
- 在 mushroom/service 下创建：被拒绝，因为项目使用 Manager 模式
- 继承 AuthService/UserService：被拒绝，因为会导致强耦合

### 2. 代码复用策略

**决策**：MushroomAuthManager 内部复用 LoginManager 的核心方法，但通过组合而非继承

**理由**：
- 避免重复代码
- 保持独立的接口和控制权
- 便于后续定制化

**实现方式**：
```typescript
class MushroomAuthManager {
  private loginManager: LoginManager; // 复用

  constructor() {
    // 创建独立的 LoginManager 实例
    this.loginManager = new LoginManager(
      this /* as IAuthService */,
      broadcastChannelService,
      storageService
    );
  }

  async loginWithPassword(input: { ... }) {
    return this.loginManager.loginWithPassword(input);
  }
}
```

**考虑的替代方案**：
- 完全重写所有登录逻辑：被拒绝，因为重复代码过多
- 直接继承 AuthService：被拒绝，因为会导致接口污染

### 3. 路由判断策略

**决策**：在主站 AuthService 中保留 `isMushroomRoute()` 方法，用于跳过处理

**理由**：
- 最小改动原则
- 保持向后兼容
- 清晰的边界判断

**实现方式**：
```typescript
// AuthService 中
async checkLogin(params) {
  // 如果是 mushroom 路由，跳过处理
  if (this.isMushroomRoute()) {
    return false;
  }
  // 原有逻辑...
}

// AppContainer 中
async _appBootstrapFlow() {
  // ...
  // 如果是 mushroom 路由，跳过 Google One Tap
  if (!this.isMushroomRoute()) {
    authService.loginManager.checkPromptGoogleOneTap();
  }
}
```

**考虑的替代方案**：
- 在 MushroomBootstrap 中拦截：被拒绝，因为主站仍会唤起
- 使用环境变量判断：被拒绝，因为无法在运行时动态判断

### 4. 用户状态管理策略

**决策**：MushroomUserManager 创建独立的 UserStore，但与主站 UserService 共享底层数据源

**理由**：
- 独立的状态管理，便于 Mushroom 定制
- 共享数据源，保证数据一致性
- 符合最小改动原则

**实现方式**：
```typescript
class MushroomUserManager {
  readonly storeManager = new UserStore(); // 独立 store

  async refreshUser() {
    const user = await getUserInfo(); // 复用 API
    this.setUserInfo(user);
    return user;
  }
}
```

**考虑的替代方案**：
- 完全独立的用户存储：被拒绝，因为会导致数据不一致
- 直接使用 UserService：被拒绝，因为无法独立管理

### 5. BroadcastChannel 通信策略

**决策**：继续使用现有的 BroadcastChannel 机制，保持消息格式不变

**理由**：
- 最小改动原则
- 保持跨标签页同步功能
- 主站和 Mushroom 可以相互通信

**实现方式**：
- Mushroom 登录成功后发送 `LoginSuccess` 消息
- 主站收到消息后更新状态
- Mushroom 登出后发送 `Logout` 消息
- 主站收到消息后清理状态

**考虑的替代方案**：
- 创建独立的 Mushroom 广播通道：被拒绝，因为会破坏同步
- 使用其他通信机制（如 localStorage events）：被拒绝，因为功能较弱

## Data Model

### Existing Model (No Changes Required)

无数据模型变更，继续使用现有的用户数据结构：

```typescript
// webserver/frontend/feature/account/type/index.ts
type UserType = {
  id: string;
  email: string;
  nickname?: string;
  picture?: string;
  is_staff: boolean;
  // ...
};
```

### New/Modified Model

无需修改现有数据模型。

### API Response Format

使用现有 API，无变更：

```typescript
// 登录 API
POST /api/token/
{
  "email": string,
  "password": string,
  "cf_token": string
}
Response: {
  "access": string,
  "refresh": string,
  "is_signup": boolean
}

// Google 登录
POST /api/google-login/
{
  "token": string,
  "invite_code"?: string
}
Response: {
  "access": string,
  "refresh": string,
  "is_signup": boolean
}

// SSO 配置
POST /api/sso/config/
{
  "email": string
}
Response: {
  "config": OAuthConfig | null,
  "state": string
}
```

## Component Structure

### 新增文件结构

```
webserver/frontend/feature/mushroom/
├── manager/
│   ├── mushroom-auth-manager.ts          # 新建：认证管理器
│   ├── mushroom-user-manager.ts          # 新建：用户管理器
│   └── mushroom-controller.ts             # 修改：添加新 manager
├── context/
│   └── mushroom-auth-context.tsx         # 新建：认证上下文
└── component/
    └── mushroom-login-modal.tsx           # 修改：使用新的认证管理器
```

### 修改的文件结构

```
webserver/frontend/feature/
├── services/
│   └── auth-service/
│       └── auth-service.ts                # 修改：跳过 mushroom 路由
└── services/
    └── app-container-service/
        └── app-container.ts               # 修改：跳过 mushroom 的 Google One Tap
```

## Architecture Patterns

### Manager Pattern

MushroomAuthManager 和 MushroomUserManager 遵循项目的 Manager 模式：

- **单一职责**：每个 Manager 只负责一个领域
- **状态管理**：使用 Zustand store 管理状态
- **依赖注入**：通过构造函数注入依赖
- **生命周期管理**：提供 dispose() 方法清理资源

### 组合模式

MushroomAuthManager 使用组合而非继承来复用 LoginManager：

```typescript
class MushroomAuthManager implements IAuthService {
  private loginManager: LoginManager;

  constructor() {
    this.loginManager = new LoginManager(this, broadcastChannel, storage);
  }

  // 委托给 LoginManager
  async loginWithPassword(input) {
    return this.loginManager.loginWithPassword(input);
  }
}
```

这样既复用了代码，又保持了独立性。

### Context Provider Pattern

使用 React Context 提供 MushroomAuthManager 和 MushroomUserManager：

```typescript
const MushroomAuthContext = createContext<MushroomAuthManager | null>(null);

function MushroomAuthProvider({ children, manager }) {
  return (
    <MushroomAuthContext.Provider value={manager}>
      {children}
    </MushroomAuthContext.Provider>
  );
}

function useMushroomAuth() {
  const manager = useContext(MushroomAuthContext);
  if (!manager) throw new Error('...');
  return manager;
}
```

## Risks / Trade-offs

### Risk: 登录状态不一致

**风险**：Mushroom 和主站分别管理登录状态，可能导致状态不同步。

**缓解措施**：
- 使用 BroadcastChannel 保持状态同步
- 共享 Cookie 存储的 refresh token
- 定期同步用户信息

### Risk: Google One Tap 冲突

**风险**：主站和 Mushroom 都可能唤起 Google One Tap，导致重复弹出。

**缓解措施**：
- 在 AppContainer 中判断路由，跳过 Mushroom 路由
- MushroomAuthManager 独立处理 Google One Tap
- 使用 `cancelGoogleOneTap()` 确保只有一个实例

### Trade-off: 代码复用 vs 独立性

**决策**：优先考虑代码复用，通过组合而非重写来实现独立。

**影响**：
- 优点：减少重复代码，降低维护成本
- 缺点：与 LoginManager 有一定耦合
- 权衡：通过接口隔离，未来可以替换实现

### Risk: 改动范围大

**风险**：涉及多个文件的修改，可能引入 bug。

**缓解措施**：
- 分阶段实施，每个 Task 独立测试
- 保持现有功能不变，只改变调用方式
- 充分的测试覆盖

## Open Questions

1. **MushroomAuthManager 是否需要实现完整的 IAuthService 接口？**
   - 假设：实现最小接口，仅包含 Mushroom 用到的方法
   - 待确认：是否需要实现 `sendLink`、`resetPassword` 等方法

2. **MushroomUserManager 是否需要独立的用户存储？**
   - 假设：独立的 UserStore，但共享底层数据源
   - 待确认：是否需要离线缓存等高级功能

3. **SSO 登录是否需要在 Mushroom 中独立实现？**
   - 假设：保留现有实现，复用 SSOAuthButton 组件
   - 待确认：是否需要定制化的 SSO 流程

## Migration Plan

### Steps

#### Phase 1: 创建基础结构 (T-001)
- 创建 MushroomAuthManager 基础结构
- 创建 MushroomUserManager 基础结构
- 在 MushroomController 中集成新的 Manager
- 创建对应的 React Context

#### Phase 2: 实现认证功能 (T-002, T-003, T-004)
- 实现密码登录功能
- 实现 Google OAuth 登录功能
- 实现 SSO 登录检测
- 实现 Google One Tap 管理

#### Phase 3: 实现用户管理功能 (T-005)
- 实现用户信息获取和缓存
- 实现用户状态管理
- 实现用户信息刷新

#### Phase 4: 修改组件使用新的 Manager (T-006, T-007)
- 修改 MushroomLoginModal
- 修改 MushroomBootstrap
- 修改 UserAvatarDropdown
- 修改 ShortLinkRedirectPage

#### Phase 5: 修改主站跳过 Mushroom 路由 (T-008, T-009)
- 修改 AuthService 跳过 /mushroom/ 路由
- 修改 AppContainer 跳过 Mushroom 的 Google One Tap

#### Phase 6: 测试和验证 (T-010)
- 端到端测试所有登录流程
- 测试跨标签页状态同步
- 测试边界情况和错误处理

### Rollback

- **代码回滚**：通过 Git 回滚到之前的版本
- **无数据库变更**：无需数据库回滚
- **无 API 变更**：无需 API 回滚
- **功能降级**：如果出现问题，可以临时恢复旧的依赖关系

## References

### 相关文档
- `.project-rules/frontend/architecture.md` - Manager 模式架构
- `.project-rules/frontend/mvc-architecture.md` - MVC 架构规范
- `.luokingspec/changes/decouple-mushroom-auth/proposal.md` - 需求提案

### 相关代码
- `webserver/frontend/feature/services/auth-service/auth-service.ts`
- `webserver/frontend/feature/services/user-service/user-service.ts`
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`
- `webserver/frontend/feature/services/auth-service/login-manager.ts`
