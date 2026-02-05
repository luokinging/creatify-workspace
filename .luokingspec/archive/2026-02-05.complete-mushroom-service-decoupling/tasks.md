# T-001 替换 UserAvatarDropdown 中的 AuthService 和 UserService 使用

## 需求描述

**Refactor：使用 Mushroom Manager 替换主站 Service**

修改 UserAvatarDropdown 组件，使用 MushroomAuthManager 和 MushroomUserManager 替代对主站 AuthService 和 UserService 的依赖。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 获取 MushroomController

从 Context 中获取 MushroomController，然后使用其 Manager：

```typescript
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';

export function UserAvatarDropdown(props: UserAvatarDropdownProps) {
  const mushroomController = useMushroomController();
  const mushroomAuthManager = mushroomController.mushroomAuthManager;
  const mushroomUserManager = mushroomController.mushroomUserManager;
  // ...
}
```

### 2. 替换用户信息获取

将 UserService 的 selector 替换为 MushroomUserManager：

```typescript
// 修改前
const userService = useServices(IUserService);
const authService = useServices(IAuthService);
const isUserInfoLoaded = useZustand(userService.storeManager.store, userSelectors.isUserInfoLoaded);
const userInfo = useZustand(userService.storeManager.store, userSelectors.user);

// 修改后
const isUserInfoLoaded = useZustand(mushroomUserManager.store, (state) => state.isUserInfoLoadCompleted);
const userInfo = useZustand(mushroomUserManager.store, (state) => state.user);
```

### 3. 替换登录和登出操作

```typescript
// 修改前
onClick={() => {
  authService.checkLogin({
    popupFrom: LoginPopupFromEnum.MushroomPage,
  });
}}

// 修改后
onClick={() => {
  mushroomAuthManager.checkLogin({
    allowManualClose: false,
    hiddenClose: true,
  });
}}

// 修改前
if (option.type === 'base' && option.value === 'logout') {
  authService.userSignOut();
}

// 修改后
if (option.type === 'base' && option.value === 'logout') {
  mushroomAuthManager.signOut();
}
```

### 4. 更新 import 语句

```typescript
// 删除
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';
import { IUserService } from '@/feature/services/user-service/user-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';
import { userSelectors } from '@/feature/services/user-service/react-context';

// 添加
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件 Props 解构规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/context/mushroom-controller-context.tsx` - Context Provider
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 认证 Manager
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 用户 Manager

## 注意点

- MushroomUserManager 的状态结构与 UserService 不同，需要调整 selector
- `isUserInfoLoadCompleted` 对应 UserService 的 `isUserInfoLoaded`
- MushroomAuthManager.checkLogin 的参数结构与 AuthService 不同
- MushroomAuthManager.signOut 会自动跳转到 Mushroom 项目页面

## Scenario

### Scenario 1: 用户点击未登录的头像进行登录

    **场景描述：**
    - **前置条件**：用户在 Mushroom 页面，未登录
    - **操作步骤**：
      1. 用户点击用户头像
      2. 调用 `mushroomAuthManager.checkLogin()`
      3. 显示登录弹窗
      4. 用户完成登录
    - **预期结果**：
      - 登录弹窗正常显示
      - 登录成功后，用户信息被正确加载和显示
      - 不再依赖主站的 AuthService

### Scenario 2: 用户点击登出按钮

    **场景描述：**
    - **前置条件**：用户已登录，在 Mushroom 页面
    - **操作步骤**：
      1. 用户点击头像下拉菜单
      2. 选择 "Log out" 选项
      3. 调用 `mushroomAuthManager.signOut()`
    - **预期结果**：
      - 用户被登出
      - 跳转到 Mushroom 项目页面
      - 不再依赖主站的 AuthService

## Checklist

- [x] C-001 从 Context 中获取 MushroomController 和相关 Manager
- [x] C-002 移除对 AuthService 的依赖（import 和使用）
- [x] C-003 移除对 UserService 的依赖（import 和使用）
- [x] C-004 使用 mushroomUserManager.store 替代 userService.storeManager.store
- [x] C-005 使用 mushroomAuthManager.checkLogin() 替代 authService.checkLogin()
- [x] C-006 使用 mushroomAuthManager.signOut() 替代 authService.userSignOut()
- [x] C-007 正确处理用户信息的显示（头像、昵称、邮箱等）
- [x] C-008 正确处理未登录状态的显示
- [x] C-009 组件的 TypeScript 类型正确
- [x] C-010 所有登录/登出功能正常工作

---

# T-002 替换 ShortLinkRedirectPage 中的 AuthService 使用

## 需求描述

**Refactor：使用 MushroomAuthManager 替换主站 AuthService**

修改 ShortLinkRedirectPage 组件，使用 MushroomAuthManager 替代对主站 AuthService 的依赖。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 获取 MushroomAuthManager

由于 ShortLinkRedirectPage 不使用 MushroomBootstrap，需要直接获取 Manager：

```typescript
import { getGlobalMushroomController } from '@/feature/mushroom/manager/event/mushroom-event-helper';

export function ShortLinkRedirectPage({ shortCode }: ShortLinkRedirectPageProps) {
  const mushroomController = getGlobalMushroomController();
  const mushroomAuthManager = mushroomController?.mushroomAuthManager;
  // ...
}
```

### 2. 替换登录操作

```typescript
// 修改前
const authService = useServices(IAuthService);

const handleLogin = async () => {
  await authService.checkLogin({
    popupFrom: LoginPopupFromEnum.MushroomPage,
  });
  window.location.reload();
};

// 修改后
const handleLogin = async () => {
  if (!mushroomAuthManager) {
    console.error('MushroomAuthManager not available');
    return;
  }
  await mushroomAuthManager.checkLogin({
    allowManualClose: false,
    hiddenClose: true,
  });
  window.location.reload();
};
```

### 3. 处理 MushroomController 不可用的情况

由于这个页面不使用 MushroomBootstrap，需要处理 Controller 不可用的情况：

```typescript
const mushroomController = getGlobalMushroomController();

if (!mushroomController) {
  // 显示错误或使用主站的 AuthService 作为后备
}
```

### 4. 更新 import 语句

```typescript
// 删除
import { IAuthService } from '@/feature/services/auth-service/auth-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';

// 添加
import { getGlobalMushroomController } from '@/feature/mushroom/manager/event/mushroom-event-helper';
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件代码规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/component/short-link-redirect-page.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/manager/event/mushroom-event-helper.ts` - Global Controller 获取
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 认证 Manager

## 注意点

- ShortLinkRedirectPage 不使用 MushroomBootstrap，所以需要通过 getGlobalMushroomController 获取
- 需要处理 Controller 不可用的情况（可以保留 AuthService 作为后备）
- 登录成功后需要重新加载页面以更新认证状态

## Scenario

### Scenario 1: 用户访问需要认证的短链接

    **场景描述：**
    - **前置条件**：用户访问需要认证的短链接，未登录
    - **操作步骤**：
      1. 短链接解析显示需要认证
      2. 用户点击 "Log In" 按钮
      3. 调用 `mushroomAuthManager.checkLogin()`
      4. 用户完成登录
      5. 页面重新加载
    - **预期结果**：
      - 登录弹窗正常显示
      - 登录成功后，页面重新加载并正确跳转
      - 不再依赖主站的 AuthService（在 Mushroom 可用时）

## Checklist

- [x] C-001 使用 getGlobalMushroomController 获取 MushroomController
- [x] C-002 使用 mushroomAuthManager.checkLogin() 替代 authService.checkLogin()
- [x] C-003 处理 MushroomController 不可用的情况
- [x] C-004 登录成功后正确重新加载页面
- [x] C-005 保持现有的错误处理逻辑
- [x] C-006 组件的 TypeScript 类型正确

---

# T-003 移除 MushroomProjectManager 中的 AuthService 依赖

## 需求描述

**Refactor：移除 AuthService 构造函数参数**

修改 MushroomProjectManager，移除对 AuthService 的构造函数依赖，因为该 Manager 实际上不使用 AuthService。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 分析 AuthService 的使用

检查 MushroomProjectManager 是否真正使用 AuthService：

```typescript
constructor(private readonly authService: IAuthService) {
  // authService 在构造函数中被传入，但在代码中未被使用
}
```

### 2. 移除构造函数参数

```typescript
// 修改前
constructor(private readonly authService: IAuthService) {
  // ...
}

// 修改后
constructor() {
  // ...
}
```

### 3. 更新 ProjectDashboardViewController

同步更新 ProjectDashboardViewController：

```typescript
// 修改前
constructor(private readonly authService: IAuthService) {
  this.mushroomProjectManager = new MushroomProjectManager(authService);
}

// 修改后
constructor() {
  this.mushroomProjectManager = new MushroomProjectManager();
}
```

### 4. 更新创建 ProjectDashboardViewController 的地方

```typescript
// 在 projects/page/index.tsx 中
// 修改前
const authService = useServices(IAuthService);
const [vc] = useState(() => new ProjectDashboardViewController(authService));

// 修改后
const [vc] = useState(() => new ProjectDashboardViewController());
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式
- `.project-rules/frontend/coding-conventions.md` - 了解代码规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/mushroom-project-manager.ts` - 需要修改的文件
- `webserver/frontend/feature/mushroom/sub-feature/projects/manager/project-dashboard-view-controller.ts` - 需要修改的文件
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/index.tsx` - 需要修改的文件

## 注意点

- 需要确认 AuthService 确实在 MushroomProjectManager 中未被使用
- 需要同步更新所有创建这些 Manager 的地方
- 保持其他功能不变

## Scenario

### Scenario 1: 初始化 ProjectDashboardViewController

    **场景描述：**
    - **前置条件**：用户访问项目列表页面
    - **操作步骤**：
      1. 创建 ProjectDashboardViewController 实例
      2. 创建 MushroomProjectManager 实例
    - **预期结果**：
      - Manager 正常创建
      - 所有功能正常工作
      - 不再依赖 AuthService

## Checklist

- [x] C-001 确认 AuthService 在 MushroomProjectManager 中未被使用
- [x] C-002 移除 MushroomProjectManager 的 authService 构造函数参数
- [x] C-003 移除 ProjectDashboardViewController 的 authService 构造函数参数
- [x] C-004 更新 projects/page/index.tsx 中的创建代码
- [x] C-005 移除不必要的 import
- [x] C-006 所有现有功能正常工作

---

# T-004 替换 InvitePage 中的 AuthService 使用

## 需求描述

**Refactor：保留主站 AuthService 用于邀请流程**

InvitePage 是一个特殊的页面，它处理项目邀请，这是一个跨模块的功能。经过分析，该页面应该继续使用主站的 AuthService，因为邀请流程可能涉及主站和 Mushroom 之间的交互。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 分析 InvitePage 的职责

InvitePage 处理项目邀请流程：
- 验证邀请链接
- 接受邀请
- 跳转到项目页面

这是一个跨模块的功能，不应该局限于 Mushroom 模块。

### 2. 保持现有实现

由于邀请流程的特殊性，该页面应该继续使用主站的 AuthService：

```typescript
// 保持不变
const authService = getService(IAuthService);
```

### 3. 添加注释说明

添加注释说明为什么这个页面使用主站 AuthService：

```typescript
/**
 * InvitePage handles project invitations which may involve
 * cross-module interactions between main site and Mushroom.
 * Therefore, it uses the main site AuthService.
 */
export function InvitePage({ code }: InvitePageProps) {
  // Invite flow uses main site AuthService as it may involve
  // cross-module operations
  const authService = getService(IAuthService);
  // ...
}
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解 Manager 模式
- `.project-rules/frontend/coding-conventions.md` - 了解注释规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/invite-page.tsx` - 需要添加注释的文件

## 注意点

- 这个任务不修改代码实现，只添加文档说明
- 邀请流程是跨模块的功能，使用主站 AuthService 是合理的
- 需要在文档中明确说明这个设计决策

## Scenario

### Scenario 1: 用户通过邀请链接访问

    **场景描述：**
    - **前置条件**：用户通过邀请链接访问
    - **操作步骤**：
      1. 验证邀请
      2. 接受邀请
      3. 跳转到项目页面
    - **预期结果**：
      - 邀请流程正常工作
      - 使用主站 AuthService 处理认证

## Checklist

- [x] C-001 添加文件顶部注释说明设计决策
- [x] C-002 添加相关代码注释
- [x] C-003 更新项目文档说明这个特殊情况

---

# T-005 替换 ProjectsPage 中的 UserService 使用

## 需求描述

**Refactor：使用 MushroomUserManager 替换主站 UserService**

修改 ProjectsPage（projects/page/index.tsx），使用 MushroomUserManager 替代对主站 UserService 的依赖。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 获取 MushroomUserManager

从 Context 中获取 MushroomController：

```typescript
const mushroomController = useMushroomController();
const mushroomUserManager = mushroomController.mushroomUserManager;
```

### 2. 替换 waitUserInfoLoaded

```typescript
// 修改前
const userService = getService(IUserService);
await userService.waitUserInfoLoaded();

// 修改后
await mushroomUserManager.waitUserInfoLoaded();
```

### 3. 替换用户信息获取

```typescript
// 修改前
const user = userService.storeManager.store.getState().user;

// 修改后
const user = mushroomUserManager.store.getState().user;
```

### 4. 更新 import 语句

```typescript
// 删除
import { IUserService } from '@/feature/services/user-service/user-service.type';
import { getService } from '@/feature/services/app-container-service/react-context';

// 添加
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件代码规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/projects/page/index.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/context/mushroom-controller-context.tsx` - Context Provider
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 用户 Manager

## 注意点

- 需要确保在权限检查之前等待用户信息加载完成
- MushroomUserManager 的 waitUserInfoLoaded 返回 Promise
- 保持现有的权限检查逻辑不变

## Scenario

### Scenario 1: 用户访问项目列表页面

    **场景描述：**
    - **前置条件**：用户访问 /mushroom/projects 页面
    - **操作步骤**：
      1. 等待用户信息加载
      2. 检查用户权限
      3. 显示项目列表
    - **预期结果**：
      - 用户信息正确加载
      - 权限检查正常工作
      - 项目列表正常显示
      - 不再依赖主站的 UserService

## Checklist

- [x] C-001 从 Context 中获取 MushroomController 和 MushroomUserManager
- [x] C-002 移除对 UserService 的依赖（import 和使用）
- [x] C-003 使用 mushroomUserManager.waitUserInfoLoaded() 替代 userService.waitUserInfoLoaded()
- [x] C-004 使用 mushroomUserManager.store.getState().user 替代 userService.storeManager.store.getState().user
- [x] C-005 保持现有的权限检查逻辑不变
- [x] C-006 所有功能正常工作
- [x] C-007 组件的 TypeScript 类型正确

---

# T-006 替换 ShareTopBar 中的 UserService 使用

## 需求描述

**Refactor：使用 MushroomUserManager 替换主站 UserService**

修改 ShareTopBar 组件，使用 MushroomUserManager 替代对主站 UserService 的依赖。

**需求类型**：Refactor

**涉及领域**：前端

### 1. 获取 MushroomUserManager

从 Context 中获取 MushroomController：

```typescript
const mushroomController = useMushroomController();
const mushroomUserManager = mushroomController.mushroomUserManager;
```

### 2. 替换用户信息获取

```typescript
// 修改前
const userService = useServices(IUserService);
const user = useZustand(userService.storeManager.store, userSelectors.user);
const isLoggedIn = !!user?.id;

// 修改后
const user = useZustand(mushroomUserManager.store, (state) => state.user);
const isLoggedIn = !!user?.id;
```

### 3. 更新 import 语句

```typescript
// 删除
import { IUserService } from '@/feature/services/user-service/user-service.type';
import { useServices } from '@/feature/services/app-container-service/react-context';
import { userSelectors } from '@/feature/services/user-service/react-context';

// 添加
import { useMushroomController } from '@/feature/mushroom/context/mushroom-controller-context';
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解如何使用 Manager
- `.project-rules/frontend/coding-conventions.md` - 了解组件代码规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/sub-feature/share/block/share-topbar.tsx` - 需要修改的文件
- `webserver/frontend/feature/mushroom/context/mushroom-controller-context.tsx` - Context Provider
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 用户 Manager

## 注意点

- ShareTopBar 在共享页面中使用，需要确保 MushroomController 可用
- 保持现有的权限信息获取逻辑不变
- 保持现有的访客信息处理逻辑不变

## Scenario

### Scenario 1: 用户在共享页面查看用户信息

    **场景描述：**
    - **前置条件**：用户访问共享页面
    - **操作步骤**：
      1. ShareTopBar 渲染
      2. 获取用户信息
      3. 显示用户头像和下拉菜单
    - **预期结果**：
      - 用户信息正确显示
      - 登录状态正确判断
      - 权限信息正确显示
      - 不再依赖主站的 UserService

## Checklist

- [x] C-001 从 Context 中获取 MushroomController 和 MushroomUserManager
- [x] C-002 移除对 UserService 的依赖（import 和使用）
- [x] C-003 使用 mushroomUserManager.store 替代 userService.storeManager.store
- [x] C-004 保持现有的权限信息获取逻辑
- [x] C-005 保持现有的访客信息处理逻辑
- [x] C-006 所有功能正常工作
- [x] C-007 组件的 TypeScript 类型正确

---

# T-007 更新文档和注释

## 需求描述

**Enhancement：更新项目文档和代码注释**

更新相关文档和代码注释，说明 Mushroom 模块的 Service 解耦状态和特殊情况。

**需求类型**：Enhancement

**涉及领域**：前端

### 1. 更新 MushroomAuthManager 和 MushroomUserManager 注释

在 Manager 文件中添加更详细的注释：

```typescript
/**
 * MushroomAuthManager
 *
 * Handles authentication logic for the Mushroom module independently
 * from the main site AuthService. This allows Mushroom to be deployed
 * and maintained separately.
 *
 * Features:
 * - Login check with modal display
 * - Google One Tap integration
 * - Password and Google login methods
 * - Sign out with Mushroom-specific redirect
 */
export class MushroomAuthManager {
  // ...
}

/**
 * MushroomUserManager
 *
 * Manages user information for the Mushroom module independently
 * from the main site UserService. This allows Mushroom to be deployed
 * and maintained separately.
 *
 * Features:
 * - User information storage and retrieval
 * - User info refresh
 * - Wait for user info loaded
 */
export class MushroomUserManager {
  // ...
}
```

### 2. 更新 MushroomController 注释

说明 Controller 的外部依赖：

```typescript
/**
 * MushroomController
 *
 * Central controller for the Mushroom module. Manages all Mushroom-specific
 * managers and coordinates their interactions.
 *
 * External Dependencies:
 * - UserService: Used by permission managers (NewPermissionManager, PermissionManager)
 *   These managers handle permissions that may span multiple modules.
 *
 * Internal Managers:
 * - MushroomAuthManager: Authentication (decoupled from main site)
 * - MushroomUserManager: User info (decoupled from main site)
 * - WorkspaceManager: Project workspace
 * - NewPermissionManager: Permission management
 * - etc.
 */
export class MushroomController {
  // ...
}
```

### 3. 创建解耦状态文档

创建一个文档说明解耦状态：

创建文件：`webserver/frontend/feature/mushroom/SERVICE_DECOUPLING.md`

```markdown
# Mushroom Service Decoupling Status

## Overview

Mushroom module has been decoupled from main site AuthService and UserService
by creating dedicated managers (MushroomAuthManager, MushroomUserManager).

## Decoupled Components

The following components now use Mushroom managers instead of main site services:

- ✅ MushroomAuthManager - Authentication logic
- ✅ MushroomUserManager - User information
- ✅ MushroomBootstrap - Bootstrap and login check
- ✅ MushroomLoginModal - Login modal
- ✅ UserAvatarDropdown - User avatar dropdown
- ✅ ShortLinkRedirectPage - Short link redirect (with fallback)
- ✅ ProjectsPage - Project list page
- ✅ ShareTopBar - Share page top bar

## Remaining Dependencies

### UserService Dependency

The following managers still depend on main site UserService for permission management:

- ⚠️ NewPermissionManager - Uses UserService for user info in permission context
- ⚠️ PermissionManager - Uses UserService for user info and waitUserInfoLoaded
- ⚠️ WorkspaceManager - Passes UserService to PermissionManager
- ⚠️ MushroomPlatformIntegrationManager - Passes UserService to AxonPlatformManager
- ⚠️ AxonPlatformManager - Uses UserService.store in combinedStore

**Rationale**: Permission management is a cross-module concern that may involve
both Mushroom and main site projects. Complete decoupling would require creating
a separate permission system for Mushroom.

### Special Cases

- ⚠️ InvitePage - Uses main site AuthService for invitation flow
  **Rationale**: Project invitations are cross-module features that may involve
  both main site and Mushroom projects.

## Future Work

- Consider decoupling permission management if Mushroom becomes fully independent
- Evaluate if Mushroom needs its own permission system
```

### 4. 更新项目规则文档

如果需要，更新 `.project-rules` 下的相关文档说明 Mushroom 模块的特殊情况。

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 更新架构说明
- `.project-rules/frontend/coding-conventions.md` - 更新代码注释规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts` - 更新注释
- `webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts` - 更新注释
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - 更新注释
- `webserver/frontend/feature/mushroom/SERVICE_DECOUPLING.md` - 新建文档

## 注意点

- 文档应该准确反映当前的实际状态
- 明确说明哪些功能已解耦，哪些仍依赖主站
- 说明保留依赖的原因

## Scenario

### Scenario 1: 开发者查看 Mushroom 架构文档

    **场景描述：**
    - **前置条件**：开发者需要了解 Mushroom 的架构
    - **操作步骤**：
      1. 阅读 MushroomAuthManager 和 MushroomUserManager 的注释
      2. 阅读 MushroomController 的注释
      3. 阅读 SERVICE_DECOUPLING.md 文档
    - **预期结果**：
      - 清楚了解解耦状态
      - 了解哪些依赖仍然存在
      - 了解设计决策的原因

## Checklist

- [x] C-001 更新 MushroomAuthManager 注释
- [x] C-002 更新 MushroomUserManager 注释
- [x] C-003 更新 MushroomController 注释
- [x] C-004 创建 SERVICE_DECOUPLING.md 文档
- [x] C-005 更新相关项目规则文档
- [x] C-006 文档清晰、准确、易懂
