# T-001 创建 MushroomAuthManager 处理 Mushroom 的认证逻辑

## 需求描述

**Refactor：创建独立的认证 Manager**

创建 MushroomAuthManager 来封装 Mushroom 模块的认证逻辑，包括登录检查、登录操作、登出等，使 Mushroom 模块不再直接依赖主站的 AuthService。

**需求类型**：Refactor

**涉及领域**：前端

### 1. MushroomAuthManager 的核心功能

MushroomAuthManager 需要实现以下功能：

| 功能 | 说明 | 备注 |
|------|------|------|
| `checkLogin()` | 检查用户是否登录，未登录则弹出登录弹窗 | 参考 AuthService.checkLogin，但针对 Mushroom 场景 |
| `checkPromptGoogleOneTap()` | 检查并唤起 Google One Tap 自动登录 | 仅在 Mushroom 路由下生效 |
| `signOut()` | 登出用户，清理认证状态 | 参考 AuthService.signOut，跳转到 Mushroom 项目页 |
| `loginWithPassword()` | 使用密码登录 | 调用现有 API，封装登录流程 |
| `loginWithGoogle()` | 使用 Google 登录 | 调用现有 API，封装登录流程 |
| `loginWithGoogleOneTap()` | 使用 Google One Tap 登录 | 调用现有 API，封装 Google One Tap 流程 |
| `bootstrapAuth()` | 初始化认证状态 | 检查 Token 是否存在，刷新用户信息 |

### 2. 状态管理

MushroomAuthManager 需要维护以下状态：

```typescript
interface MushroomAuthState {
  isUserInfoLoadCompleted: boolean;  // 用户信息是否加载完成
  inAuthProgress: boolean;           // 是否正在进行认证初始化
  enableApiCallAfterSignIn: boolean; // 登录后是否可以调用 API
}
```

### 3. 与现有 API 的交互

MushroomAuthManager 应该直接调用现有的 API 函数（来自 `@/feature/account/api/user.client`），而不是通过 AuthService：

```typescript
// 示例：调用现有 API 进行密码登录
import { getAccessTokens } from '@/feature/account/api/user.client';
import { signInWithTokens } from '@/feature/account/api/user.client';
```

### 4. 登录弹窗的显示

MushroomAuthManager 负责管理登录弹窗的显示逻辑：

- 使用 `dialogManager.show(MushroomLoginModal, ...)` 显示登录弹窗
- 登录成功后关闭弹窗并通知调用方
- 支持的弹窗选项：`allowManualClose`、`hiddenClose`

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式的实现规范
- `.project-rules/frontend/directory-structure.md` - 了解 manager 目录的组织方式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 新创建的文件
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 参考现有实现
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 参考登录逻辑
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - 登录弹窗组件

**其他:**
- 现有 API 函数：`webserver/frontend/feature/account/api/user.client.ts`

## 注意点

- MushroomAuthManager 不应该继承或依赖 AuthService，应该是一个独立的实现
- 需要正确处理登录成功后的路由跳转和状态刷新
- 需要处理登出后的路由跳转（应该跳转到 Mushroom 项目页面）
- 状态管理使用 Zustand store，遵循 Manager 模式规范
- 需要实现 `bootstrap()` 和 `dispose()` 生命周期方法
- Google One Tap 只在 Mushroom 路由下生效，需要判断当前路由

## Scenario

### Scenario 1: 检查登录状态，未登录时显示登录弹窗

    **场景描述：**
    - **前置条件**：用户访问 Mushroom 页面，未登录
    - **操作步骤**：
      1. 调用 `mushroomAuthManager.checkLogin()`
      2. Manager 检查用户登录状态
      3. 如果未登录，显示 MushroomLoginModal
      4. 用户完成登录
    - **预期结果**：
      - 登录弹窗正常显示
      - 登录成功后，用户信息被正确加载
      - 调用方得到成功通知

### Scenario 2: 检查并唤起 Google One Tap

    **场景描述：**
    - **前置条件**：用户访问 Mushroom 页面，未登录
    - **操作步骤**：
      1. 调用 `mushroomAuthManager.checkPromptGoogleOneTap()`
      2. Manager 检查当前路由是否为 Mushroom 路由
      3. 如果是 Mushroom 路由且未登录，唤起 Google One Tap
      4. 用户使用 Google One Tap 完成登录
    - **预期结果**：
      - Google One Tap 正常显示
      - 登录成功后，用户信息被正确加载
      - 页面保持在当前 Mushroom 页面

### Scenario 3: 用户使用密码登录

    **场景描述：**
    - **前置条件**：用户在 MushroomLoginModal 中输入了邮箱和密码
    - **操作步骤**：
      1. 用户点击"Log in"按钮
      2. 调用 `mushroomAuthManager.loginWithPassword()`
      3. 调用 API 获取 Token
      4. 保存 Token 并刷新用户信息
    - **预期结果**：
      - 登录成功，Token 被正确保存
      - 用户信息被刷新
      - 登录弹窗关闭

### Scenario 4: 用户登出

    **场景描述：**
    - **前置条件**：用户已登录，在 Mushroom 页面
    - **操作步骤**：
      1. 调用 `mushroomAuthManager.signOut()`
      2. 清理 Token 和用户信息
      3. 跳转到 Mushroom 项目页面
    - **预期结果**：
      - Token 被清理
      - 用户信息被重置
      - 页面跳转到 `/mushroom/projects`

## Checklist

- [x] C-001 MushroomAuthManager 文件创建完成，包含基本结构
- [x] C-002 实现 `checkLogin()` 方法，支持显示登录弹窗
- [x] C-003 实现 `checkPromptGoogleOneTap()` 方法，支持 Google One Tap 自动唤起
- [x] C-004 实现 `loginWithPassword()` 方法，支持密码登录
- [x] C-005 实现 `loginWithGoogle()` 方法，支持 Google 登录
- [x] C-006 实现 `loginWithGoogleOneTap()` 方法，支持 Google One Tap 登录
- [x] C-007 实现 `signOut()` 方法，支持登出并跳转
- [x] C-008 实现 `bootstrapAuth()` 方法，支持初始化认证状态
- [x] C-009 状态管理使用 Zustand store，遵循 Manager 模式规范
- [x] C-010 实现 `bootstrap()` 和 `dispose()` 生命周期方法
- [x] C-011 正确处理登录成功后的状态刷新和通知
- [x] C-012 正确处理登出后的路由跳转
- [x] C-013 Google One Tap 只在 Mushroom 路由下生效

---

# T-002 创建 MushroomUserManager 处理 Mushroom 的用户信息管理

## 需求描述

**Refactor：创建独立的用户管理 Manager**

创建 MushroomUserManager 来封装 Mushroom 模块的用户信息管理逻辑，包括用户信息的获取、刷新和更新，使 Mushroom 模块不再直接依赖主站的 UserService。

**需求类型**：Refactor

**涉及领域**：前端

### 1. MushroomUserManager 的核心功能

MushroomUserManager 需要实现以下功能：

| 功能 | 说明 | 备注 |
|------|------|------|
| `refreshUser()` | 刷新用户信息 | 调用 API 获取最新的用户信息 |
| `setUserInfo()` | 设置用户信息 | 更新 store 中的用户信息 |
| `resetUser()` | 重置用户信息 | 清空用户信息（登出时使用） |
| `waitUserInfoLoaded()` | 等待用户信息加载完成 | 返回 Promise，等待用户 ID 存在 |

### 2. 状态管理

MushroomUserManager 需要维护以下状态：

```typescript
interface MushroomUserState {
  user: UserType;  // 用户信息
}
```

### 3. 与现有 API 的交互

MushroomUserManager 应该直接调用现有的 API 函数：

```typescript
// 示例：调用现有 API 获取用户信息
import { getUserInfo } from '@/feature/account/api/user';
```

### 4. 用户信息类型

使用现有的用户类型定义：

```typescript
import type { UserType } from '@/feature/account/type';
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式的实现规范
- `.project-rules/frontend/directory-structure.md` - 了解 manager 目录的组织方式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 新创建的文件
- `webserver/frontend/feature/services/user-service/user-service.ts` - 参考现有实现

**其他:**
- 现有 API 函数：`webserver/frontend/feature/account/api/user.ts`
- 用户类型定义：`webserver/frontend/feature/account/type.ts`

## 注意点

- MushroomUserManager 不应该继承或依赖 UserService，应该是一个独立的实现
- 用户信息变化时需要通知订阅者（通过 Zustand store 的 subscribe）
- 需要正确处理用户信息的初始化和重置
- 状态管理使用 Zustand store，遵循 Manager 模式规范
- 需要实现 `bootstrap()` 和 `dispose()` 生命周期方法

## Scenario

### Scenario 1: 刷新用户信息

    **场景描述：**
    - **前置条件**：用户已登录
    - **操作步骤**：
      1. 调用 `mushroomUserManager.refreshUser()`
      2. Manager 调用 API 获取最新用户信息
      3. 更新 store 中的用户信息
    - **预期结果**：
      - 用户信息被正确刷新
      - 订阅者得到通知

### Scenario 2: 等待用户信息加载完成

    **场景描述：**
    - **前置条件**：用户刚刚登录，用户信息正在加载
    - **操作步骤**：
      1. 调用 `mushroomUserManager.waitUserInfoLoaded()`
      2. Manager 等待用户 ID 存在
      3. 返回 resolved Promise
    - **预期结果**：
      - 正确等待用户信息加载完成
      - Promise 正确 resolve

### Scenario 3: 重置用户信息（登出时）

    **场景描述：**
    - **前置条件**：用户正在登出
    - **操作步骤**：
      1. 调用 `mushroomUserManager.resetUser()`
      2. Manager 清空用户信息
    - **预期结果**：
      - 用户信息被重置为默认值
      - store 中的状态被正确更新

## Checklist

- [x] C-001 MushroomUserManager 文件创建完成，包含基本结构
- [x] C-002 实现 `refreshUser()` 方法，支持刷新用户信息
- [x] C-003 实现 `setUserInfo()` 方法，支持设置用户信息
- [x] C-004 实现 `resetUser()` 方法，支持重置用户信息
- [x] C-005 实现 `waitUserInfoLoaded()` 方法，支持等待用户信息加载
- [x] C-006 状态管理使用 Zustand store，遵循 Manager 模式规范
- [x] C-007 实现 `bootstrap()` 和 `dispose()` 生命周期方法
- [x] C-008 正确处理用户信息变化时的订阅通知
- [x] C-009 正确处理用户信息的初始化和重置

---

# T-003 修改 MushroomController 集成新的 Manager

## 需求描述

**Refactor：集成新的认证和用户 Manager**

修改 MushroomController，集成新创建的 MushroomAuthManager 和 MushroomUserManager，使 Mushroom 模块可以通过统一的 Controller 访问认证和用户功能。

**需求类型**：Refactor

**涉及领域**：前端

### 1. MushroomController 的更新

MushroomController 需要添加以下内容：

```typescript
export class MushroomController {
  // 现有的 Manager
  readonly workspaceManager: WorkspaceManager;
  readonly shotcutManager: ShotcutManager;
  readonly uploadProgressManager: UploadProgressManager;
  readonly eventManager: MushroomEventManager;
  readonly newPermissionManager: NewPermissionManager;

  // 新增的 Manager
  readonly mushroomAuthManager: MushroomAuthManager;
  readonly mushroomUserManager: MushroomUserManager;

  // 更新 combinedStore，包含新的 Manager 的 store
  readonly combinedStore: CombinedStore<...>;
}
```

### 2. 构造函数的更新

MushroomController 的构造函数需要创建新的 Manager 实例：

```typescript
constructor(userService: IUserService) {
  // 现有的初始化代码
  this.eventManager = new MushroomEventManager();
  this.newPermissionManager = new NewPermissionManager(this.eventManager, userService);
  this.workspaceManager = new WorkspaceManager(userService, this.newPermissionManager);
  this.shotcutManager = new ShotcutManager();
  this.uploadProgressManager = new UploadProgressManager();

  // 新增：创建认证和用户 Manager
  this.mushroomAuthManager = new MushroomAuthManager();
  this.mushroomUserManager = new MushroomUserManager();

  // 更新 combinedStore，包含新的 Manager 的 store
  this.combinedStore = createCombinedStore([
    this.workspaceManager.combinedStore,
    this.mushroomAuthManager.store,
    this.mushroomUserManager.store,
  ] as const);
}
```

### 3. bootstrap 方法的更新

在 `bootstrap()` 方法中初始化新的 Manager：

```typescript
async bootstrap(isLoggedIn: boolean) {
  // 现有的初始化代码
  const promises: Promise<unknown>[] = [
    AsyncRetry(() => this.workspaceManager.bootstrap(), { retries: 3 })
  ];

  if (isLoggedIn) {
    promises.push(AsyncRetry(() => this.newPermissionManager.userQueryClient.fetch(), { retries: 3 }));
    promises.push(this.workspaceManager.permissionManager.fetchUserAccess(true));
  }

  await Promise.all(promises);

  // 新增：初始化认证和用户 Manager
  await this.mushroomAuthManager.bootstrap();
  await this.mushroomUserManager.bootstrap();

  this.newPermissionManager.bootstrap();
  this.workspaceManager.permissionManager.bootstrap();
  this.setState((state) => {
    state.isReady = true;
  });
}
```

### 4. dispose 方法的更新

在 `dispose()` 方法中清理新的 Manager：

```typescript
dispose() {
  // 现有的清理代码
  this.eventManager.dispose();
  this.newPermissionManager.dispose();
  this.workspaceManager.dispose();

  // 新增：清理认证和用户 Manager
  this.mushroomAuthManager.dispose();
  this.mushroomUserManager.dispose();
}
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式和生命周期管理
- `.project-rules/frontend/directory-structure.md` - 了解 manager 目录的组织方式

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - 需要修改的文件
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 新创建的认证 Manager
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 新创建的用户 Manager

## 注意点

- MushroomAuthManager 和 MushroomUserManager 不需要外部依赖（如 Service），在构造函数中直接创建即可
- 需要将新 Manager 的 store 添加到 combinedStore 中，以便组件可以统一订阅状态
- 生命周期管理要正确：bootstrap 和 dispose 都要调用新 Manager 的对应方法
- 确保 mushroomUserManager 在 mushroomAuthManager 之后初始化（因为认证可能需要用户信息）

## Scenario

### Scenario 1: MushroomController 初始化

    **场景描述：**
    - **前置条件**：应用启动，创建 MushroomController 实例
    - **操作步骤**：
      1. 创建 MushroomController 实例
      2. 调用 `bootstrap()` 方法
      3. 新的 Manager 被正确初始化
    - **预期结果**：
      - MushroomAuthManager 和 MushroomUserManager 被正确创建
      - 它们的 bootstrap 方法被正确调用
      - combinedStore 包含了新 Manager 的 store

### Scenario 2: MushroomController 销毁

    **场景描述：**
    - **前置条件**：应用关闭或卸载 Mushroom 模块
    - **操作步骤**：
      1. 调用 `dispose()` 方法
      2. 新的 Manager 被正确清理
    - **预期结果**：
      - MushroomAuthManager 和 MushroomUserManager 的 dispose 方法被正确调用
      - 所有订阅和资源被正确释放

## Checklist

- [x] C-001 MushroomController 正确导入新的 Manager
- [x] C-002 构造函数中创建 MushroomAuthManager 和 MushroomUserManager 实例
- [x] C-003 combinedStore 包含新 Manager 的 store
- [x] C-004 bootstrap() 方法中调用新 Manager 的 bootstrap 方法
- [x] C-005 dispose() 方法中调用新 Manager 的 dispose 方法
- [x] C-006 新 Manager 的初始化顺序正确（UserManager 在 AuthManager 之后）
- [x] C-007 新 Manager 作为只读属性暴露给外部使用

---

# T-004 修改 MushroomBootstrap 使用新的 MushroomAuthManager

## 需求描述

**Refactor：使用新的认证 Manager**

修改 MushroomBootstrap 组件，使用新的 MushroomAuthManager 替代对主站 AuthService 的依赖，实现登录检查的解耦。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 移除对 AuthService 的依赖

删除以下代码：

```typescript
// 删除
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';
const authService = getService(IAuthService);
await authService.checkLogin(...);
```

### 2. 使用 MushroomController 的认证 Manager

修改登录检查逻辑：

```typescript
// 修改前
const authService = getService(IAuthService);
await authService.checkLogin({
  popupFrom: LoginPopupFromEnum.MushroomPage,
  popupOptions: {
    allowManualClose: false,
    hiddenClose: true,
  },
});

// 修改后
await mushroomController.mushroomAuthManager.checkLogin({
  allowManualClose: false,
  hiddenClose: true,
});
```

### 3. 更新 import 语句

移除不再需要的导入：

```typescript
// 删除
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';
import { getService } from '@/feature/services/app-container-service/react-context';
```

### 4. 更新类型定义

如果需要，更新 Props 接口：

```typescript
export interface MushroomBootstrapProps {
  children: ReactNode;
  skipLoginCheck?: boolean;
  // 不再需要其他认证相关的 props
}
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件 Props 解构规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - 包含新的 Manager
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 新的认证 Manager

**前端路由:**
- `/mushroom/*` - Mushroom 模块的所有路由

## 注意点

- 删除对主站 AuthService 的依赖后，需要确保所有功能仍然正常工作
- checkLogin 的参数可能需要调整，确保与 MushroomAuthManager 的接口匹配
- 登录成功后的逻辑（如邀请接受、权限获取）需要保持不变
- 确保错误处理和加载状态仍然正确

## Scenario

### Scenario 1: 用户访问 Mushroom 页面时进行登录检查

    **场景描述：**
    - **前置条件**：用户访问 `/mushroom/*` 路由，未登录
    - **操作步骤**：
      1. MushroomBootstrap 组件挂载
      2. 调用 `mushroomController.mushroomAuthManager.checkLogin()`
      3. 显示登录弹窗
      4. 用户完成登录
    - **预期结果**：
      - 登录弹窗正常显示
      - 登录成功后，Mushroom 继续初始化
      - 不再依赖主站的 AuthService

### Scenario 2: 跳过登录检查的情况

    **场景描述：**
    - **前置条件**：MushroomBootstrap 的 `skipLoginCheck` prop 为 true
    - **操作步骤**：
      1. MushroomBootstrap 组件挂载
      2. 跳过登录检查，直接进行初始化
    - **预期结果**：
      - 不显示登录弹窗
      - Mushroom 直接初始化（无登录状态）

## Checklist

- [x] C-001 移除对 AuthService 的依赖（import 和使用）
- [x] C-002 使用 mushroomController.mushroomAuthManager.checkLogin() 替代 authService.checkLogin()
- [x] C-003 登录成功后的逻辑（邀请接受、权限获取）保持不变
- [x] C-004 错误处理和加载状态正确
- [x] C-005 skipLoginCheck 逻辑正常工作
- [x] C-006 组件的 TypeScript 类型正确

---

# T-005 修改 MushroomLoginModal 使用新的 MushroomAuthManager

## 需求描述

**Refactor：使用新的认证 Manager 进行登录操作**

修改 MushroomLoginModal 组件，使用新的 MushroomAuthManager 替代对主站 AuthService 的依赖，实现登录操作的解耦。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 获取 MushroomAuthManager

从 Context 中获取 MushroomController，然后使用其认证 Manager：

```typescript
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';

export function MushroomLoginModal(props: ...) {
  const mushroomController = useMushroomController();
  const mushroomAuthManager = mushroomController.mushroomAuthManager;
  // ...
}
```

### 2. 修改密码登录逻辑

修改登录表单提交逻辑：

```typescript
// 修改前
await authService.loginManager.loginWithPassword({
  email,
  password,
  cfToken,
  afterLogin: async () => {
    await onLoginSuccess?.();
    router.invalidate();
    onResolve?.({ isLoginSuccess: true });
    onOpenChange?.(false);
  },
});

// 修改后
await mushroomAuthManager.loginWithPassword({
  email,
  password,
  cfToken,
  afterLogin: async () => {
    await onLoginSuccess?.();
    router.invalidate();
    onResolve?.({ isLoginSuccess: true });
    onOpenChange?.(false);
  },
});
```

### 3. 更新 import 语句

移除不再需要的导入，添加新的导入：

```typescript
// 删除
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';

// 添加
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';
```

### 4. Google 登录和 SSO 登录的处理

对于 Google 登录和 SSO 登录，继续使用现有的组件和逻辑，但 afterLogin 回调中可以使用新的 Manager：

```typescript
// GoogleAuthButton 的 afterLogin
const afterLogin = async () => {
  await onLoginSuccess?.();
  router.invalidate();
  onResolve?.({ isLoginSuccess: true });
  onOpenChange?.(false);
};
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件 Props 解构规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/context/mushroom-controller-context.tsx` - Context Provider
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 新的认证 Manager

**其他:**
- Google 登录按钮：`webserver/frontend/feature/auth/google-auth.button.tsx`
- SSO 登录按钮：`webserver/frontend/feature/auth/component/sso-auth-button.tsx`

## 注意点

- Google 登录和 SSO 登录的实际实现由现有组件处理，MushroomLoginModal 只需要正确处理 afterLogin 回调
- 密码登录是唯一需要直接调用 Manager 的登录方式
- 需要确保所有登录方式的成功回调逻辑一致
- 登录成功后的路由刷新和弹窗关闭逻辑需要保持不变

## Scenario

### Scenario 1: 用户使用密码登录

    **场景描述：**
    - **前置条件**：用户在 MushroomLoginModal 中输入了邮箱和密码
    - **操作步骤**：
      1. 用户点击"Log in"按钮
      2. 调用 `mushroomAuthManager.loginWithPassword()`
      3. 登录成功后执行 afterLogin 回调
    - **预期结果**：
      - 登录成功
      - 路由被刷新
      - 登录弹窗关闭
      - 不再依赖主站的 AuthService

### Scenario 2: 用户使用 Google 登录

    **场景描述：**
    - **前置条件**：用户在 MushroomLoginModal 中点击"Continue with Google"
    - **操作步骤**：
      1. GoogleAuthButton 处理 Google OAuth 流程
      2. 登录成功后执行 afterLogin 回调
      3. 回调中刷新路由、关闭弹窗
    - **预期结果**：
      - 登录成功
      - 路由被刷新
      - 登录弹窗关闭

### Scenario 3: 用户使用 SSO 登录

    **场景描述：**
    - **前置条件**：用户输入的邮箱检测到使用 SSO
    - **操作步骤**：
      1. 显示 SSO 登录按钮
      2. SSOAuthButton 处理 SSO 登录流程
      3. 登录成功后执行 afterLogin 回调
    - **预期结果**：
      - 登录成功
      - 路由被刷新
      - 登录弹窗关闭

## Checklist

- [x] C-001 从 Context 中获取 MushroomController 和 MushroomAuthManager
- [x] C-002 移除对 AuthService 的依赖（import 和使用）
- [x] C-003 密码登录使用 mushroomAuthManager.loginWithPassword()
- [x] C-004 Google 登录的 afterLogin 回调正确处理
- [x] C-005 SSO 登录的 afterLogin 回调正确处理
- [x] C-006 所有登录方式的成功回调逻辑一致
- [x] C-007 登录成功后的路由刷新和弹窗关闭正确
- [x] C-008 组件的 TypeScript 类型正确

---

# T-006 在主站 LoginManager 中跳过 Mushroom 路由的 Google One Tap

## 需求描述

**Refactor：主站识别 Mushroom 路由并跳过 Google One Tap，让 Mushroom 自己处理**

在主站的 LoginManager 中添加对 Mushroom 路由的判断，当检测到当前是 Mushroom 路由时，跳过主站的 Google One Tap 自动唤起（由 Mushroom 自己的 MushroomAuthManager 处理）。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 修改 checkPromptGoogleOneTap 方法

在 LoginManager 的 `checkPromptGoogleOneTap` 方法中添加 Mushroom 路由判断：

```typescript
async checkPromptGoogleOneTap() {
  const isInIFrame = isInIframe();
  const isInDisabledRouteList = GoogleOneTapDisabledRouteList.some((route) =>
    window.location.pathname.includes(route as string)
  );
  const isMushroomRoute = this._isMushroomRoute(); // 新增：判断是否是 Mushroom 路由
  const isNotLogin = !hasAccessRefreshToken();

  // 修改：如果是在 Mushroom 路由，跳过 Google One Tap
  if (isNotLogin && !isInDisabledRouteList && !isInIFrame && !isMushroomRoute) {
    const redirectUrl = this._getRedirectUrlFromUrl();
    try {
      await this.loginWithGoogleOneTap({
        afterLogin: () => {
          safeNavigate({ to: redirectUrl, replace: true, defaultTo: HOME });
        },
      });
    } catch {
      // User cancelled or Google One Tap not displayed - ignore error
    }
  }
}
```

### 2. 添加 _isMushroomRoute 辅助方法

在 LoginManager 中添加判断 Mushroom 路由的辅助方法：

```typescript
/**
 * Helper method to check if current route is a mushroom route.
 * This can be overridden in tests for easier testing.
 */
private _isMushroomRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/mushroom/');
}
```

### 3. 更新禁用路由列表（可选）

也可以考虑将 Mushroom 路由添加到禁用列表中：

```typescript
const GoogleOneTapDisabledRouteList: RouteValue[] = ['/preview', '/mushroom/'];
```

但是添加辅助方法的方式更清晰，因为 Mushroom 路由是一个完整的前缀路径，而不是单个路由。

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式
- `.project-rules/frontend/coding-conventions.md` - 了解代码风格约定

**前端Code Point:**
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 需要修改的文件
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 参考现有的 isMushroomRoute 实现

**前端路由:**
- `/mushroom/*` - Mushroom 模块的所有路由

## 注意点

- 与 AuthService.isMushroomRoute 保持一致的实现逻辑
- 需要考虑服务端渲染（SSR）的情况，检查 `window` 是否存在
- 添加的判断不应该影响其他路由的 Google One Tap 唤起逻辑
- 需要确保在测试环境中可以方便地 mock 这个方法

## Scenario

### Scenario 1: 用户在 Mushroom 路由页面，主站跳过但 Mushroom 唤起 Google One Tap

    **场景描述：**
    - **前置条件**：用户访问 `/mushroom/projects` 页面，未登录
    - **操作步骤**：
      1. LoginManager.checkPromptGoogleOneTap() 被调用
      2. 检测到当前是 Mushroom 路由
      3. 主站跳过 Google One Tap 的自动唤起
      4. Mushroom 的 MushroomAuthManager.checkPromptGoogleOneTap() 被调用
      5. Mushroom 唤起自己的 Google One Tap
    - **预期结果**：
      - 主站的 Google One Tap 不会显示
      - Mushroom 的 Google One Tap 正常显示
      - 用户可以使用 Mushroom 的 Google One Tap 快速登录

### Scenario 2: 用户在主站路由页面

    **场景描述：**
    - **前置条件**：用户访问 `/home` 页面，未登录
    - **操作步骤**：
      1. LoginManager.checkPromptGoogleOneTap() 被调用
      2. 检测到当前不是 Mushroom 路由
      3. 正常执行 Google One Tap 的自动唤起
    - **预期结果**：
      - 正常显示 Google One Tap 的自动登录提示
      - 用户可以使用 Google One Tap 快速登录

## Checklist

- [x] C-001 LoginManager 添加 _isMushroomRoute() 辅助方法
- [x] C-002 checkPromptGoogleOneTap() 方法中添加 Mushroom 路由判断
- [x] C-003 在 Mushroom 路由下跳过 Google One Tap 自动唤起
- [x] C-004 非 Mushroom 路由的 Google One Tap 唤起不受影响
- [x] C-005 正确处理 SSR 情况（window 不存在）
- [x] C-006 方法可以被测试方便地 mock
- [x] C-007 代码风格符合项目规范

---

# T-007 更新 AuthService 的 isMushroomRoute 方法注释

## 需求描述

**Enhancement：完善 isMushroomRoute 方法的文档**

更新 AuthService 中的 `isMushroomRoute` 方法的注释，说明该方法现在被主站和 Mushroom 共同使用，用于判断当前路由是否属于 Mushroom 模块。

**需求类型**：Enhancement

**涉及领域**：前端

### 1. 更新方法注释

更新 `isMushroomRoute` 方法的 JSDoc 注释：

```typescript
/**
 * Helper method to check if current route is a mushroom route.
 * This method is used by:
 * - AuthService: to determine login/logout redirect behavior
 * - LoginManager: to skip Google One Tap on mushroom routes
 *
 * This can be overridden in tests for easier testing.
 *
 * @returns true if current route starts with '/mushroom/', false otherwise
 */
protected isMushroomRoute(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/mushroom/');
}
```

### 2. 添加使用说明（可选）

如果需要，可以在 AuthService 类的顶部添加一个注释，说明 Mushroom 路由的处理逻辑：

```typescript
export class AuthService implements IAuthService {
  /**
   * Mushroom Route Handling:
   * - Mushroom module has its own authentication managers (MushroomAuthManager, MushroomUserManager)
   * - isMushroomRoute() is used to determine if current route belongs to Mushroom module
   * - On mushroom routes, redirect behavior differs from main site
   * - LoginManager uses similar logic to skip Google One Tap on mushroom routes
   */
  // ...
}
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/coding-conventions.md` - 了解代码风格和注释规范

**前端Code Point:**
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 需要修改的文件

## 注意点

- 不改变方法的实现逻辑，只更新注释
- 注释应该清晰地说明方法的用途和调用方
- 保持与现有代码风格一致

## Scenario

### Scenario 1: 开发者阅读 AuthService 代码

    **场景描述：**
    - **前置条件**：开发者正在阅读 AuthService 的代码
    - **操作步骤**：
      1. 开发者看到 isMushroomRoute 方法
      2. 阅读方法的注释
    - **预期结果**：
      - 清楚地了解这个方法的用途
      - 知道哪些地方使用了这个方法
      - 理解 Mushroom 模块的认证逻辑

## Checklist

- [x] C-001 更新 isMushroomRoute 方法的 JSDoc 注释
- [x] C-002 注释说明方法的调用方（AuthService、LoginManager）
- [x] C-003 注释说明方法的返回值和判断逻辑
- [x] C-004 （可选）在 AuthService 类顶部添加 Mushroom 路由处理说明（跳过，保持代码风格一致）
- [x] C-005 注释清晰、准确、易懂
