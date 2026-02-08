# T-001 创建 MushroomAuthManager 和 MushroomUserManager 基础结构

## 需求描述

创建独立的 MushroomAuthManager 和 MushroomUserManager 类，建立基础的 Manager 结构，为后续功能实现打下基础。

**需求类型**：Infrastructure

**涉及领域**：前端

### 1. 创建 MushroomAuthManager 基础结构

在 `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` 创建新的认证管理器类。

**基础结构要求**：
```typescript
export class MushroomAuthManager {
  readonly loginManager: LoginManager;
  readonly authStore: AuthStore;
  private _signOutListeners: (() => void)[] = [];
  private _onDidIdentifyListeners: (() => void)[] = [];
  identifyBarrier = new Barrier();

  constructor(
    broadcastChannelService: IBroadcastChannelService,
    storageService: IStorageService
  ) {
    this.authStore = new AuthStore();
    this.loginManager = new LoginManager(this, broadcastChannelService, storageService);
  }

  onDidIdentify(listener: () => void) { /* ... */ }
  onSignOut(listener: () => void) { /* ... */ }
  dispose() { /* ... */ }
}
```

### 2. 创建 MushroomUserManager 基础结构

在 `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` 创建新的用户管理器类。

**基础结构要求**：
```typescript
export class MushroomUserManager {
  readonly storeManager: UserStore;

  constructor() {
    this.storeManager = new UserStore();
  }

  onUserInfoChange(listener: (data: UserStoreType, preData: UserStoreType) => void) { /* ... */ }
  dispose() { /* ... */ }
}
```

### 3. 在 MushroomController 中集成新的 Manager

修改 `mushroom-controller.ts`，添加新的 Manager 属性：

```typescript
export class MushroomController {
  readonly workspaceManager: WorkspaceManager;
  readonly shotcutManager: ShotcutManager;
  readonly uploadProgressManager: UploadProgressManager;
  readonly eventManager: MushroomEventManager;
  readonly newPermissionManager: NewPermissionManager;
  readonly authManager: MushroomAuthManager;      // 新增
  readonly userManager: MushroomUserManager;      // 新增

  constructor(userService: IUserService) {
    // 现有初始化...
    this.authManager = new MushroomAuthManager(broadcastChannelService, storageService);
    this.userManager = new MushroomUserManager();
  }
}
```

### 4. 创建对应的 React Context

在 `webserver/frontend/feature/mushroom/context/` 创建：
- `mushroom-auth-context.tsx` - 认证上下文
- `mushroom-user-context.tsx` - 用户上下文

**Context 结构要求**：
```typescript
const MushroomAuthContext = createContext<MushroomAuthManager | null>(null);
export function useMushroomAuth(): MushroomAuthManager { /* ... */ }
export function MushroomAuthProvider(props: { children: ReactNode; manager: MushroomAuthManager }) { /* ... */ }
```

### 5. 修改 MushroomBootstrap 添加 Context Provider

在 `mushroom-bootstrap.tsx` 中添加新的 Context Provider：

```typescript
return (
  <MushroomControllerProvider controller={mushroomController}>
    <MushroomAuthProvider manager={mushroomController.authManager}>
      <MushroomUserProvider manager={mushroomController.userManager}>
        {children}
      </MushroomUserProvider>
    </MushroomAuthProvider>
  </MushroomControllerProvider>
);
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式和状态管理
- `.project-rules/frontend/mvc-architecture.md` - 了解 ViewController 和 Manager 架构
- `.project-rules/frontend/directory-structure.md` - 了解功能目录组织规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - Mushroom 控制器
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 参考主站 AuthService 实现
- `webserver/frontend/feature/services/user-service/user-service.ts` - 参考主站 UserService 实现
- `webserver/frontend/feature/mushroom/context/mushroom-controller-context.tsx` - 参考现有 Context 实现

**其他:**
- 参考 WorkspaceManager、PermissionManager 等 Manager 的实现模式

## 注意点

- 遵循项目的 Manager 模式规范
- 保持与现有 Manager 的一致性
- 正确处理依赖注入
- 实现 dispose() 方法确保资源清理
- Context 需要正确处理 null 情况

## Scenario

### Scenario 1: MushroomController 初始化时创建新的 Manager

    **场景描述：**
    - **前置条件**：MushroomBootstrap 组件挂载
    - **操作步骤**：
      1. MushroomController 初始化
      2. 创建 MushroomAuthManager 实例
      3. 创建 MushroomUserManager 实例
      4. 将 Manager 注入到 Context
    - **预期结果**：
      - Manager 正确初始化
      - Context 可以正常访问 Manager
      - dispose() 方法正确实现

## Checklist

- [ ] C-001 MushroomAuthManager 类创建完成，包含基础结构
- [ ] C-002 MushroomUserManager 类创建完成，包含基础结构
- [ ] C-003 MushroomController 正确集成新的 Manager
- [ ] C-004 MushroomAuthContext 创建完成，包含 Provider 和 Hook
- [ ] C-005 MushroomUserContext 创建完成，包含 Provider 和 Hook
- [ ] C-006 MushroomBootstrap 正确添加 Context Provider
- [ ] C-007 所有 dispose() 方法正确实现
- [ ] C-008 TypeScript 类型定义正确无误

---

# T-002 实现 MushroomAuthManager 密码登录功能

## 需求描述

在 MushroomAuthManager 中实现密码登录功能，支持邮箱密码登录、CF Turnstile 验证和错误处理。

**需求类型**：Feature

**涉及领域**：前端

### 1. 实现 loginWithPassword 方法

```typescript
async loginWithPassword(input: {
  email: string;
  password: string;
  cfToken: string;
  afterLogin?: () => void;
}): Promise<void>
```

**实现要求**：
- 调用 `loginManager.loginWithPassword()` 执行登录
- 登录成功后发送 BroadcastChannel 消息
- 更新本地认证状态
- 调用 `afterLogin` 回调

### 2. 实现 bootstrapAuth 方法

```typescript
async bootstrapAuth(): Promise<void>
```

**实现要求**：
- 检查是否有 refresh token
- 如果有，调用 `userManager.refreshUser()` 获取用户信息
- 更新认证状态
- 打开 `identifyBarrier`

### 3. 实现认证状态管理

使用 AuthStore 管理认证状态：
- `isUserInfoLoadCompleted` - 用户信息是否加载完成
- `inAuthProgress` - 是否正在认证中
- `enableApiCallAfterSignIn` - 是否可以调用 API
- `otp_secret` - OTP 密钥（用于 Magic Link 登录）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式和状态管理

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 认证管理器
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 参考现有实现
- `webserver/frontend/feature/services/auth-service/auth-store.ts` - AuthStore 定义

**其他:**
- `webserver/frontend/feature/account/api/user.client.ts` - 登录 API

## 注意点

- 复用 LoginManager 的登录逻辑
- 正确处理登录成功和失败的情况
- 确保 BroadcastChannel 消息正确发送
- 更新认证状态时要考虑异步情况

## Scenario

### Scenario 1: 用户通过密码登录

    **场景描述：**
    - **前置条件**：用户在 Mushroom 登录弹窗中输入邮箱和密码
    - **操作步骤**：
      1. 用户点击登录按钮
      2. 调用 `mushroomAuthManager.loginWithPassword()`
      3. 登录成功后发送 BroadcastChannel 消息
      4. 更新本地认证状态
      5. 执行 `afterLogin` 回调
    - **预期结果**：
      - 用户成功登录
      - 认证状态正确更新
      - 其他标签页收到登录消息
      - 页面可以正常访问需要登录的功能

## Checklist

- [ ] C-001 loginWithPassword 方法实现完成
- [ ] C-002 bootstrapAuth 方法实现完成
- [ ] C-003 认证状态正确更新
- [ ] C-004 BroadcastChannel 消息正确发送
- [ ] C-005 错误处理正确实现
- [ ] C-006 afterLogin 回调正确执行
- [ ] C-007 单元测试通过

---

# T-003 实现 MushroomAuthManager Google OAuth 和 SSO 登录功能

## 需求描述

在 MushroomAuthManager 中实现 Google OAuth 登录和 SSO 登录检测功能，支持 Google OAuth 和 SSO 自动跳转。

**需求类型**：Feature

**涉及领域**：前端

### 1. 实现 loginWithGoogle 方法

```typescript
async loginWithGoogle(input: {
  flowId: string;
  token: string;
  inviteCode?: string;
  afterLogin?: () => void;
}): Promise<void>
```

**实现要求**：
- 调用 `loginManager.loginWithGoogle()` 执行登录
- 登录成功后发送 BroadcastChannel 消息
- 处理注册和登录两种情况
- 更新认证状态

### 2. 实现 SSO 配置检测

```typescript
async checkSSOConfig(email: string): Promise<OAuthConfig | null>
```

**实现要求**：
- 调用 `/api/sso/config/` API
- 返回 SSO 配置或 null
- 支持在登录弹窗中检测并跳转到 SSO 登录

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 认证管理器
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 参考现有实现
- `webserver/frontend/feature/auth/api/sso.client.ts` - SSO API

## 注意点

- 复用 LoginManager 的 Google 登录逻辑
- 正确处理 SSO 配置响应
- 确保 flowId 正确传递用于埋点

## Scenario

### Scenario 1: 用户通过 Google 登录

    **场景描述：**
    - **前置条件**：用户在 Mushroom 登录弹窗中点击 "Continue with Google"
    - **操作步骤**：
      1. 用户完成 Google OAuth 认证
      2. 调用 `mushroomAuthManager.loginWithGoogle()`
      3. 登录成功后发送 BroadcastChannel 消息
      4. 更新认证状态
    - **预期结果**：
      - 用户成功登录
      - 认证状态正确更新

### Scenario 2: 用户邮箱检测到 SSO 配置

    **场景描述：**
    - **前置条件**：用户在 Mushroom 登录弹窗中输入企业邮箱
    - **操作步骤**：
      1. 用户输入邮箱后调用 `checkSSOConfig()`
      2. 检测到 SSO 配置
      3. 显示 SSO 登录按钮
    - **预期结果**：
      - 正确显示 SSO 登录选项
      - 用户可以跳转到 SSO 登录

## Checklist

- [ ] C-001 loginWithGoogle 方法实现完成
- [ ] C-002 checkSSOConfig 方法实现完成
- [ ] C-003 Google OAuth 登录正常工作
- [ ] C-004 SSO 配置检测正常工作
- [ ] C-005 BroadcastChannel 消息正确发送
- [ ] C-006 单元测试通过

---

# T-004 实现 MushroomAuthManager Google One Tap 和 checkLogin 功能

## 需求描述

在 MushroomAuthManager 中实现 Google One Tap 唤起管理和 checkLogin 功能，支持自动弹出登录弹窗和 Google One Tap 快速登录。

**需求类型**：Feature

**涉及领域**：前端

### 1. 实现 checkLogin 方法

```typescript
async checkLogin(params: {
  popupFrom: LoginPopupFromEnumValues;
  popupOptions?: PopupOptions;
}): Promise<boolean>
```

**实现要求**：
- 等待 `identifyBarrier` 完成
- 检查用户是否已登录
- 如果未登录，弹出 MushroomLoginModal
- 支持移动端跳转到指定页面
- 返回登录结果

### 2. 实现 checkPromptGoogleOneTap 方法

```typescript
async checkPromptGoogleOneTap(): Promise<void>
```

**实现要求**：
- 检查是否满足 Google One Tap 唤起条件：
  - 未登录
  - 不在禁用路由列表中
  - 不在 iframe 中
- 调用 `loginManager.loginWithGoogleOneTap()`
- 登录成功后跳转到指定页面

### 3. 实现 signOut 方法

```typescript
signOut(): void
```

**实现要求**：
- 重置用户状态
- 清理认证状态
- 发送 BroadcastChannel 消息
- 通知所有监听器

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 认证管理器
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 参考现有实现
- `webserver/frontend/feature/auth/util.ts` - Google One Tap 工具函数

**其他:**
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - 登录弹窗组件

## 注意点

- checkLogin 需要正确处理移动端和桌面端的不同行为
- Google One Tap 只在满足条件时唤起
- 登出后需要正确清理状态
- 确保所有监听器被正确通知

## Scenario

### Scenario 1: 用户访问需要登录的页面

    **场景描述：**
    - **前置条件**：用户未登录，访问需要登录的 Mushroom 页面
    - **操作步骤**：
      1. MushroomBootstrap 调用 `checkLogin()`
      2. 弹出 MushroomLoginModal
      3. 用户完成登录
      4. 返回 true
    - **预期结果**：
      - 正确弹出登录弹窗
      - 登录成功后可以继续访问页面

### Scenario 2: Google One Tap 自动唤起

    **场景描述：**
    - **前置条件**：用户未登录，访问 Mushroom 页面
    - **操作步骤**：
      1. MushroomBootstrap 调用 `checkPromptGoogleOneTap()`
      2. Google One Tap 弹出
      3. 用户点击登录
      4. 自动登录成功
    - **预期结果**：
      - Google One Tap 正确弹出
      - 登录成功后页面状态正确更新

## Checklist

- [ ] C-001 checkLogin 方法实现完成
- [ ] C-002 checkPromptGoogleOneTap 方法实现完成
- [ ] C-003 signOut 方法实现完成
- [ ] C-004 Google One Tap 正确唤起
- [ ] C-005 移动端跳转正确处理
- [ ] C-006 单元测试通过

---

# T-005 实现 MushroomUserManager 用户管理功能

## 需求描述

在 MushroomUserManager 中实现用户信息获取、缓存、刷新和更新功能，提供完整的用户状态管理。

**需求类型**：Feature

**涉及领域**：前端

### 1. 实现 refreshUser 方法

```typescript
async refreshUser(): Promise<UserType>
```

**实现要求**：
- 调用 `getUserInfo()` API 获取用户信息
- 更新 UserStore 状态
- 处理重复数据（避免重复更新）
- 返回用户信息

### 2. 实现 setUserInfo 方法

```typescript
setUserInfo(user?: UserType): void
```

**实现要求**：
- 更新 UserStore 状态
- 如果用户 ID 变化，调用 `identifyUserInfo()`
- 处理空值情况

### 3. 实现 updateUser 方法

```typescript
async updateUser(input: { nickname?: string; picture_data?: string }): Promise<void>
```

**实现要求**：
- 调用 `updateCurrentUser()` API
- 刷新用户信息
- 显示成功提示

### 4. 实现 resetUser 方法

```typescript
resetUser(): void
```

**实现要求**：
- 重置用户信息为 DEFAULT_USER
- 清理本地状态

### 5. 实现 waitUserInfoLoaded 方法

```typescript
async waitUserInfoLoaded(): Promise<void>
```

**实现要求**：
- 等待用户信息加载完成
- 如果已加载立即返回
- 如果未加载，监听状态变化

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 用户管理器
- `webserver/frontend/feature/services/user-service/user-service.ts` - 参考现有实现
- `webserver/frontend/feature/account/api/user.client.ts` - 用户 API

## 注意点

- 复用 UserService 的核心逻辑
- 保持与主站 UserService 的接口一致
- 正确处理异步状态
- 确保 UserStore 状态正确更新

## Scenario

### Scenario 1: 登录后刷新用户信息

    **场景描述：**
    - **前置条件**：用户成功登录
    - **操作步骤**：
      1. MushroomAuthManager 调用 `bootstrapAuth()`
      2. 内部调用 `userManager.refreshUser()`
      3. 获取用户信息并更新状态
    - **预期结果**：
      - 用户信息正确获取
      - UserStore 状态正确更新

## Checklist

- [ ] C-001 refreshUser 方法实现完成
- [ ] C-002 setUserInfo 方法实现完成
- [ ] C-003 updateUser 方法实现完成
- [ ] C-004 resetUser 方法实现完成
- [ ] C-005 waitUserInfoLoaded 方法实现完成
- [ ] C-006 UserStore 状态正确更新
- [ ] C-007 单元测试通过

---

# T-006 修改 MushroomLoginModal 使用 MushroomAuthManager

## 需求描述

修改 MushroomLoginModal 组件，使用新的 MushroomAuthManager 替代直接使用 authService，实现完全独立的登录逻辑。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 修改导入和依赖

**修改前**：
```typescript
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';
const authService = useServices(IAuthService);
await authService.loginManager.loginWithPassword(...);
```

**修改后**：
```typescript
import { useMushroomAuth } from '@/feature/mushroom/context/mushroom-auth-context';
const mushroomAuthManager = useMushroomAuth();
await mushroomAuthManager.loginWithPassword(...);
```

### 2. 修改登录方法调用

将所有 `authService.loginManager.xxx()` 改为 `mushroomAuthManager.xxx()`：
- `loginWithPassword`
- `loginWithGoogle`
- `checkSSOConfig`（如果需要）

### 3. 修改 SSO 配置检测

如果需要，添加 SSO 配置检测：
```typescript
const [oauthConfig, setSSOConfig] = useState<OAuthConfig | null>(null);

const checkSSO = async (email: string) => {
  const config = await mushroomAuthManager.checkSSOConfig(email);
  if (config) {
    setSSOConfig(config);
  }
};
```

### 4. 保持现有功能不变

确保所有现有功能正常工作：
- 密码登录
- Google OAuth 登录
- SSO 登录
- 表单验证
- 错误处理
- Loading 状态

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解组件和 Manager 的交互
- `.project-rules/frontend/programming-conventions.md` - 编程规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - 登录弹窗组件
- `webserver/frontend/feature/mushroom/context/mushroom-auth-context.tsx` - 认证上下文

## 注意点

- 保持现有 UI 和交互不变
- 确保所有登录方式正常工作
- 保持错误处理逻辑
- 保持埋点上报

## Scenario

### Scenario 1: 用户通过密码登录

    **场景描述：**
    - **前置条件**：用户在 Mushroom 登录弹窗中
    - **操作步骤**：
      1. 用户输入邮箱和密码
      2. 点击登录按钮
      3. 调用 `mushroomAuthManager.loginWithPassword()`
      4. 登录成功后关闭弹窗
    - **预期结果**：
      - 登录成功
      - 弹窗关闭
      - 页面状态正确更新

### Scenario 2: 用户通过 Google 登录

    **场景描述：**
    - **前置条件**：用户在 Mushroom 登录弹窗中
    - **操作步骤**：
      1. 用户点击 "Continue with Google"
      2. 完成 Google OAuth 认证
      3. 调用 `mushroomAuthManager.loginWithGoogle()`
      4. 登录成功后关闭弹窗
    - **预期结果**：
      - 登录成功
      - 弹窗关闭
      - 页面状态正确更新

## Checklist

- [ ] C-001 MushroomLoginModal 使用 MushroomAuthManager
- [ ] C-002 密码登录功能正常工作
- [ ] C-003 Google OAuth 登录功能正常工作
- [ ] C-004 SSO 登录功能正常工作
- [ ] C-005 错误处理正确
- [ ] C-006 Loading 状态正确显示
- [ ] C-007 埋点正常上报

---

# T-007 修改 MushroomBootstrap 和 UserAvatarDropdown 使用新的 Manager

## 需求描述

修改 MushroomBootstrap 和 UserAvatarDropdown 组件，使用新的 MushroomAuthManager 和 MushroomUserManager，完成组件层面的解耦。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 修改 MushroomBootstrap

**修改前**：
```typescript
const authService = getService(IAuthService);
await authService.checkLogin({
  popupFrom: LoginPopupFromEnum.MushroomPage,
  popupOptions: { allowManualClose: false, hiddenClose: true },
});
```

**修改后**：
```typescript
const mushroomAuthManager = mushroomController.authManager;
await mushroomAuthManager.checkLogin({
  popupFrom: LoginPopupFromEnum.MushroomPage,
  popupOptions: { allowManualClose: false, hiddenClose: true },
});
```

**同时修改**：
- 移除对 `IAuthService` 的依赖
- 使用 `mushroomController.authManager`
- 添加 Google One Tap 唤起：`await mushroomAuthManager.checkPromptGoogleOneTap()`

### 2. 修改 UserAvatarDropdown

**修改前**：
```typescript
const authService = useServices(IAuthService);
authService.checkLogin({ popupFrom: LoginPopupFromEnum.MushroomPage });
authService.userSignOut();
```

**修改后**：
```typescript
const mushroomAuthManager = useMushroomAuth();
mushroomAuthManager.checkLogin({ popupFrom: LoginPopupFromEnum.MushroomPage });
mushroomAuthManager.signOut();
```

**同时修改**：
- 移除对 `IAuthService` 的依赖
- 使用 `useMushroomAuth()` Hook
- 登出逻辑改为调用 `signOut()` 而非 `userSignOut()`

### 3. 修改 ShortLinkRedirectPage

**修改前**：
```typescript
const authService = useServices(IAuthService);
await authService.checkLogin({ popupFrom: LoginPopupFromEnum.MushroomPage });
```

**修改后**：
```typescript
const mushroomAuthManager = useMushroomAuth();
await mushroomAuthManager.checkLogin({ popupFrom: LoginPopupFromEnum.MushroomPage });
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解组件和 Manager 的交互

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx` - Mushroom 初始化组件
- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx` - 用户头像下拉菜单
- `webserver/frontend/feature/mushroom/component/short-link-redirect-page.tsx` - 短链接重定向页面
- `webserver/frontend/feature/mushroom/context/mushroom-auth-context.tsx` - 认证上下文

## 注意点

- 保持现有功能不变
- 确保 Context 正确使用
- 处理好异步初始化流程
- 确保错误处理正确

## Scenario

### Scenario 1: MushroomBootstrap 初始化登录检查

    **场景描述：**
    - **前置条件**：用户访问 Mushroom 页面
    - **操作步骤**：
      1. MushroomBootstrap 初始化
      2. 调用 `mushroomAuthManager.checkLogin()`
      3. 如果未登录，弹出登录弹窗
      4. 登录成功后继续初始化
    - **预期结果**：
      - 登录检查正常工作
      - 初始化流程正确

### Scenario 2: 用户点击头像下拉菜单登出

    **场景描述：**
    - **前置条件**：用户已登录
    - **操作步骤**：
      1. 用户点击头像
      2. 点击 "Log out"
      3. 调用 `mushroomAuthManager.signOut()`
      4. 状态清理完成
    - **预期结果**：
      - 登出成功
      - 状态正确清理
      - 页面跳转正确

## Checklist

- [ ] C-001 MushroomBootstrap 使用 MushroomAuthManager
- [ ] C-002 UserAvatarDropdown 使用 MushroomAuthManager
- [ ] C-003 ShortLinkRedirectPage 使用 MushroomAuthManager
- [ ] C-004 登录功能正常工作
- [ ] C-005 登出功能正常工作
- [ ] C-006 Google One Tap 正确唤起
- [ ] C-007 错误处理正确

---

# T-008 修改 AuthService 跳过 Mushroom 路由处理 (deps: T-001, T-002, T-003, T-004, T-005, T-006, T-007)

## 需求描述

修改主站 AuthService，当检测到当前 URL 是 `/mushroom/` 路由时，跳过 Mushroom 相关的处理逻辑，让 Mushroom 模块独立处理。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 修改 checkLogin 方法

在 `checkLogin` 方法开始时添加路由检查：

```typescript
async checkLogin(params: {
  originPath?: `${RouteValue}${string}`;
  popupFrom: LoginPopupFromEnumValues;
  popupOptions?: PopupOptions;
}) {
  // 如果是 mushroom 路由，跳过处理，返回 false
  if (this.isMushroomRoute()) {
    return false;
  }
  // 原有逻辑...
}
```

### 2. 修改 _popupLogin 方法

在 `_popupLogin` 方法开始时添加路由检查：

```typescript
private async _popupLogin(popupFrom: LoginPopupFromEnumValues, dialogOptions?: PopupOptions) {
  // 如果是 mushroom 路由，跳过处理
  if (this.isMushroomRoute()) {
    throw new ExpectInterruptError('Mushroom route, skipping');
  }
  // 原有逻辑...
}
```

### 3. 修改 signOut 方法

在 `signOut` 方法中调整路由跳转逻辑：

```typescript
signOut() {
  // ... 现有清理逻辑 ...

  signOutReset(() => {
    const isMushroomRoute = this.isMushroomRoute();
    if (isMushroomRoute) {
      // Mushroom 路由，不跳转，由 Mushroom 处理
      router.invalidate();
    } else {
      // 主站路由，跳转到 /home
      router.navigate({ to: '/home' });
      router.invalidate();
    }
    this._signOutListeners.forEach((fn) => fn());
  });
}
```

### 4. 保持 isMushroomRoute 方法

确保 `isMushroomRoute()` 方法正常工作：

```typescript
protected isMushroomRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/mushroom/');
}
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解服务层架构
- `.project-rules/frontend/programming-conventions.md` - 编程规范

**前端Code Point:**
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 认证服务

## 注意点

- 最小改动原则，只添加路由检查
- 不修改现有的处理逻辑
- 确保主站功能不受影响
- 保持向后兼容

## Scenario

### Scenario 1: 用户访问 Mushroom 页面时主站跳过处理

    **场景描述：**
    - **前置条件**：用户访问 `/mushroom/projects` 页面
    - **操作步骤**：
      1. 某处调用 `authService.checkLogin()`
      2. AuthService 检测到是 Mushroom 路由
      3. 返回 false，跳过处理
    - **预期结果**：
      - 主站不弹出登录弹窗
      - Mushroom 模块独立处理登录

### Scenario 2: 用户在 Mushroom 中登出

    **场景描述：**
    - **前置条件**：用户在 Mushroom 页面点击登出
    - **操作步骤**：
      1. 调用 `authService.signOut()`
      2. AuthService 检测到是 Mushroom 路由
      3. 清理状态但不跳转
    - **预期结果**：
      - 状态正确清理
      - 页面不跳转到 /home

## Checklist

- [ ] C-001 checkLogin 方法添加路由检查
- [ ] C-002 _popupLogin 方法添加路由检查
- [ ] C-003 signOut 方法调整路由跳转逻辑
- [ ] C-004 isMushroomRoute 方法正常工作
- [ ] C-005 主站功能不受影响
- [ ] C-006 单元测试通过
- [ ] C-007 集成测试通过

---

# T-009 修改 AppContainer 跳过 Mushroom 的 Google One Tap (deps: T-001, T-002, T-003, T-004)

## 需求描述

修改主站 AppContainer，当检测到当前 URL 是 `/mushroom/` 路由时，跳过 Google One Tap 的唤起，让 MushroomAuthManager 独立处理。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 修改 _appBootstrapFlow 方法

在 `_appBootstrapFlow` 方法中添加路由检查：

```typescript
private async _appBootstrapFlow() {
  // ... 现有初始化逻辑 ...

  const authService = this.invokeFunction(IAuthService);
  await authService.bootstrapAuth();

  // 如果是 mushroom 路由，跳过 Google One Tap
  const isMushroomRoute = typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/mushroom/');
  if (!isMushroomRoute) {
    authService.loginManager.checkPromptGoogleOneTap();
  }

  this._registerBroadcastChannel();
}
```

### 2. 确保路由检查正确

- 在客户端环境中检查 `window.location.pathname`
- 正确判断 `/mushroom/` 路由
- SSR 环境中不进行检查

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解应用初始化流程

**前端Code Point:**
- `webserver/frontend/feature/services/app-container-service/app-container.ts` - 应用容器

## 注意点

- 最小改动原则
- 确保主站 Google One Tap 不受影响
- SSR 环境中正确处理

## Scenario

### Scenario 1: 用户访问 Mushroom 页面时主站跳过 Google One Tap

    **场景描述：**
    - **前置条件**：用户未登录，访问 `/mushroom/projects` 页面
    - **操作步骤**：
      1. AppContainer 初始化
      2. 检测到是 Mushroom 路由
      3. 跳过 Google One Tap 唤起
    - **预期结果**：
      - 主站不唤起 Google One Tap
      - MushroomAuthManager 独立处理

### Scenario 2: 用户访问主站页面时正常唤起 Google One Tap

    **场景描述：**
    - **前置条件**：用户未登录，访问主站页面
    - **操作步骤**：
      1. AppContainer 初始化
      2. 检测到不是 Mushroom 路由
      3. 正常唤起 Google One Tap
    - **预期结果**：
      - Google One Tap 正常弹出
      - 主站功能不受影响

## Checklist

- [ ] C-001 _appBootstrapFlow 方法添加路由检查
- [ ] C-002 Mushroom 路由正确跳过 Google One Tap
- [ ] C-003 主站路由正常唤起 Google One Tap
- [ ] C-004 SSR 环境中正确处理
- [ ] C-005 集成测试通过

---

# T-010 测试和验证所有功能

## 需求描述

对所有改造的功能进行全面的测试和验证，确保所有现有功能正常工作，没有破坏性变更。

**需求类型**：Testing

**涉及领域**：前端

### 1. 功能测试

#### 1.1 登录功能测试
- [ ] 密码登录正常工作
- [ ] Google OAuth 登录正常工作
- [ ] SSO 登录正常工作
- [ ] Google One Tap 唤起正常
- [ ] 登录弹窗正确显示

#### 1.2 用户管理功能测试
- [ ] 用户信息正确获取
- [ ] 用户状态正确更新
- [ ] 用户登出正常工作
- [ ] 用户刷新正常工作

#### 1.3 页面功能测试
- [ ] MushroomBootstrap 初始化正常
- [ ] UserAvatarDropdown 交互正常
- [ ] ShortLinkRedirectPage 重定向正常

### 2. 集成测试

#### 2.1 跨标签页状态同步
- [ ] 登录成功后所有标签页同步
- [ ] 登出后所有标签页同步
- [ ] BroadcastChannel 消息正确发送

#### 2.2 路由跳转测试
- [ ] 主站跳过 Mushroom 路由处理
- [ ] Mushroom 模块独立处理登录
- [ ] Google One Tap 在主站和 Mushroom 分别正确处理

### 3. 边界情况测试

- [ ] 网络错误时正确处理
- [ ] 登录失败时正确提示
- [ ] 并发登录请求正确处理
- [ ] Token 过期时正确处理
- [ ] 刷新页面后状态正确恢复

### 4. 性能测试

- [ ] 页面加载性能没有退化
- [ ] 登录响应时间没有增加
- [ ] 内存使用没有明显增加

### 5. 兼容性测试

- [ ] 主站功能不受影响
- [ ] 其他模块功能不受影响
- [ ] 向后兼容性保持

## 相关指引

**前端规则:**
- `.project-rules/frontend/development-workflow.md` - 测试流程

**前端Code Point:**
- 所有相关的前端代码文件

## 注意点

- 全面测试所有改造的功能
- 确保没有破坏性变更
- 验证所有边界情况
- 检查性能和兼容性

## Scenario

### Scenario 1: 端到端测试 Mushroom 登录流程

    **场景描述：**
    - **前置条件**：用户未登录
    - **操作步骤**：
      1. 访问 `/mushroom/projects` 页面
      2. 弹出登录弹窗
      3. 输入账号密码登录
      4. 登录成功后页面正常显示
      5. 点击头像登出
      6. 状态正确清理
    - **预期结果**：
      - 所有步骤正常工作
      - 用户体验与改造前一致

### Scenario 2: 测试跨标签页状态同步

    **场景描述：**
    - **前置条件**：用户在两个标签页中打开 Mushroom
    - **操作步骤**：
      1. 在标签页 A 中登录
      2. 标签页 B 自动同步状态
      3. 在标签页 A 中登出
      4. 标签页 B 自动同步状态
    - **预期结果**：
      - 状态同步正常
      - BroadcastChannel 消息正确传递

## Checklist

- [ ] C-001 所有登录功能测试通过
- [ ] C-002 所有用户管理功能测试通过
- [ ] C-003 所有页面功能测试通过
- [ ] C-004 集成测试通过
- [ ] C-005 边界情况测试通过
- [ ] C-006 性能测试通过
- [ ] C-007 兼容性测试通过
- [ ] C-008 端到端测试通过
