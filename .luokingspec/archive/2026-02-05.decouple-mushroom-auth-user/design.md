## Context

Mushroom 是一个独立的应用模块，但其登录和用户系统目前仍依赖主站的 AuthService 和 UserService。这种耦合关系存在以下问题：

1. **模块依赖**：Mushroom 模块需要直接导入和依赖主站的 Service，违反了模块独立性原则
2. **维护困难**：主站 Service 的变更可能影响 Mushroom 模块
3. **测试复杂**：Mushroom 模块的测试需要 mock 主站的 Service
4. **扩展受限**：Mushroom 模块无法独立部署和定制认证逻辑

为了解决这些问题，我们需要将 Mushroom 的认证和用户逻辑剥离到独立的 Manager 中，放置在 MushroomController 的管理下。

## Goals / Non-Goals

### Goals

- 创建 MushroomAuthManager 和 MushroomUserManager，实现 Mushroom 模块的认证和用户逻辑独立
- 修改 MushroomBootstrap 和 MushroomLoginModal，使用新的 Manager 替代对主站 Service 的依赖
- 在主站 LoginManager 中添加 Mushroom 路由判断，跳过 Google One Tap 的自动唤起
- 保持现有功能完全不变，只进行代码层面的解耦
- 遵循项目的 Manager 模式规范

### Non-Goals

- 修改现有的 AuthService 和 UserService 的实现（只在主站添加路由判断逻辑）
- 支持 Magic Link/OTP 登录方式（本次只支持密码登录和 Google 登录）
- 实现 Mushroom 的 Google One Tap 自动唤起（暂不支持）
- 修改后端 API 或数据模型

## Decisions

### 1. Manager 组织方式

**决策**：创建 MushroomAuthManager 和 MushroomUserManager 两个独立的 Manager，放在 `mushroom/manager/` 目录下，与其他 Mushroom Manager 并列。

**理由**：
- 职责分离：认证和用户管理是两个不同的领域，分离后更清晰
- 独立性：两个 Manager 可以独立开发和测试
- 扩展性：未来如果需要添加更多功能，可以轻松扩展
- 一致性：与项目现有的 Manager 模式保持一致

**考虑的替代方案**：
- 创建单一的 MushroomAuthManager 包含所有认证和用户逻辑：被拒绝，因为职责不够清晰
- 扩展现有 MushroomController，添加认证相关方法：被拒绝，因为会导致 Controller 过于臃肿

### 2. Google One Tap 处理方式

**决策**：
- 主站的 LoginManager 检测到 Mushroom 路由时跳过 Google One Tap
- Mushroom 的 MushroomAuthManager 负责在 Mushroom 页面唤起 Google One Tap

**理由**：
- 完全独立：Mushroom 拥有自己的 Google One Tap 逻辑，不依赖主站
- 清晰分离：主站和 Mushroom 各自处理自己的 Google One Tap
- 避免冲突：主站跳过后，Mushroom 可以独立控制 Google One Tap 的行为

**考虑的替代方案**：
- 主站统一管理所有 Google One Tap：被拒绝，因为 Mushroom 需要独立的认证逻辑
- Mushroom 完全不支持 Google One Tap：被拒绝，因为 Mushroom 需要此功能以提供更好的用户体验

### 3. 登录方式支持范围

**决策**：仅支持密码登录和 Google 登录（当前 MushroomLoginModal 已实现的功能）。

**理由**：
- 最小改动原则：只支持当前已经实现的方式
- 需求聚焦：Mushroom 模块当前只需要这两种登录方式
- 风险控制：减少改动范围，降低引入 bug 的风险

**考虑的替代方案**：
- 支持所有主站支持的登录方式：被拒绝，因为超出本次需求范围
- 额外支持 Magic Link/OTP 登录：被拒绝，因为 Mushroom 当前未使用这些方式

### 4. Manager 依赖关系

**决策**：MushroomAuthManager 和 MushroomUserManager 不需要外部依赖（如 Service），在构造函数中直接创建即可。

**理由**：
- 独立性：Manager 不依赖外部 Service，更加独立
- 简洁性：不需要复杂的依赖注入
- API 直接调用：Manager 直接调用现有的 API 函数

**考虑的替代方案**：
- 通过构造函数注入 Service：被拒绝，因为增加了不必要的复杂度

## Data Model

### Existing Model (No Changes Required)

本次变更不修改数据模型，继续使用现有的类型和 API：

```typescript
// 用户类型
import type { UserType } from '@/feature/account/type';

// Token 类型
import type { TokenType } from '@/feature/account/type';

// 登录相关类型
import type { LoginPopupFromEnumValues } from '@/feature/auth/type';
```

### API Usage

Manager 直接调用现有的 API 函数：

```typescript
// 认证相关 API
import { getAccessTokens } from '@/feature/account/api/user.client';
import { loginWithGoogle } from '@/feature/account/api/user.client';
import { signInWithTokens } from '@/feature/account/api/user.client';

// 用户相关 API
import { getUserInfo } from '@/feature/account/api/user';
```

## Component Structure

### 前端组件结构

```
webserver/frontend/feature/mushroom/
├── manager/
│   ├── mushroom-auth-manager.ts      # 新增：认证 Manager
│   ├── mushroom-user-manager.ts      # 新增：用户 Manager
│   ├── mushroom-controller.ts        # 修改：集成新的 Manager
│   └── ...
├── block/
│   └── mushroom-bootstrap.tsx        # 修改：使用新的 Manager
├── component/
│   └── mushroom-login-modal.tsx      # 修改：使用新的 Manager
└── ...
```

### Manager 层次结构

```
MushroomController
├── MushroomAuthManager (新增)
│   ├── 状态管理：登录状态、认证进度
│   ├── Google One Tap：checkPromptGoogleOneTap()
│   ├── 登录检查：checkLogin()
│   ├── 密码登录：loginWithPassword()
│   ├── Google 登录：loginWithGoogle()
│   ├── Google One Tap 登录：loginWithGoogleOneTap()
│   └── 登出：signOut()
├── MushroomUserManager (新增)
│   ├── 状态管理：用户信息
│   ├── 刷新用户：refreshUser()
│   ├── 设置用户：setUserInfo()
│   └── 重置用户：resetUser()
└── 其他现有 Manager...
```

## Architecture Patterns

### Manager 模式

本次变更严格遵循项目的 Manager 模式规范：

1. **状态封装**：每个 Manager 内部维护自己的状态（Zustand store）
2. **生命周期管理**：实现 `bootstrap()` 和 `dispose()` 方法
3. **统一接口**：提供 `state` getter 和 `setState()` 方法
4. **构造器注入**：依赖通过构造函数传入（如果需要）
5. **职责分离**：每个 Manager 只负责自己的领域

### 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                        主站 (Main Site)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                  │
│  │ AuthService  │────────▶│ LoginManager │                  │
│  └──────────────┘         └──────────────┘                  │
│         │                       │                             │
│         │ isMushroomRoute()     │ checkPromptGoogleOneTap()  │
│         │                       │ (跳过 Mushroom 路由)       │
│         ▼                                                       │
│  ┌──────────────────────────────────────┐                    │
│  │     判断是否跳过 Google One Tap      │                    │
│  └──────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ (解耦后不再依赖)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Mushroom 模块                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              MushroomController                      │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │  ┌────────────────────┐  ┌────────────────────┐    │    │
│  │  │MushroomAuthManager│  │MushroomUserManager │    │    │
│  │  ├────────────────────┤  ├────────────────────┤    │    │
│  │  │ checkLogin()       │  │ refreshUser()      │    │    │
│  │  │ checkPromptGoogle* │  │ setUserInfo()      │    │    │
│  │  │ loginWithPassword()│  │ resetUser()        │    │    │
│  │  │ loginWithGoogle()  │  │ waitUserInfoLoaded()│   │    │
│  │  │ loginWithGoogleOne*│  │                    │    │    │
│  │  │ signOut()          │  │                    │    │    │
│  │  └────────────────────┘  └────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                       │                             │
│         ▼                       ▼                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         MushroomBootstrap     MushroomLoginModal     │    │
│  └─────────────────────────────────────────────────────┘    │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │        Mushroom Google One Tap (独立管理)            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 调用流程

#### 登录检查流程

```
用户访问 Mushroom 页面
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  主站 LoginManager                           │
├─────────────────────────────────────────────────────────────┤
│  LoginManager.checkPromptGoogleOneTap()                      │
│        │                                                      │
│        └──▶ 检测到 Mushroom 路由，跳过主站的 Google One Tap   │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mushroom 模块                               │
├─────────────────────────────────────────────────────────────┤
│  MushroomBootstrap 挂载                                      │
│        │                                                      │
│        ▼                                                      │
│  mushroomController.mushroomAuthManager                      │
│        .checkPromptGoogleOneTap()                            │
│        │                                                      │
│        └──▶ 唤起 Mushroom 的 Google One Tap                   │
│                                                              │
│        │                                                      │
│        ├──▶ 未登录且未使用 Google One Tap ──▶ 检查登录状态    │
│        │                              │                      │
│        │                              ▼                      │
│        │                    mushroomAuthManager.checkLogin() │
│        │                              │                      │
│        │                              └──▶ 显示 MushroomLoginModal
│        │                                      │              │
│        │                                      ├──▶ 密码登录  │
│        │                                      │              │
│        │                                      ├──▶ Google 登录
│        │                                      │              │
│        │                                      └──▶ SSO 登录   │
│        │                                                            │
│        └──▶ 已登录 ──▶ 继续 Mushroom 初始化                         │
└─────────────────────────────────────────────────────────────┘
```

#### Google One Tap 判断流程

```
页面加载
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  主站 LoginManager                           │
├─────────────────────────────────────────────────────────────┤
│  LoginManager.checkPromptGoogleOneTap()                      │
│        │                                                      │
│        ├──▶ 检查是否在 iframe 中                              │
│        ├──▶ 检查是否在禁用路由列表中                          │
│        ├──▶ 检查是否是 Mushroom 路由 (_isMushroomRoute())    │
│        │        │                                             │
│        │        ├──▶ 是 ──▶ 跳过主站的 Google One Tap          │
│        │        │                                             │
│        │        └──▶ 否 ──▶ 继续主站的 Google One Tap 检查    │
│        │                  │                                  │
│        │                  ├──▶ 未登录 ──▶ 显示主站 Google One Tap│
│        │                  │                                  │
│        │                  └──▶ 已登录 ──▶ 跳过                │
└─────────────────────────────────────────────────────────────┘
        │
        │ （如果是 Mushroom 路由）
        ▼
┌─────────────────────────────────────────────────────────────┐
│                  Mushroom 模块                               │
├─────────────────────────────────────────────────────────────┤
│  MushroomAuthManager.checkPromptGoogleOneTap()              │
│        │                                                      │
│        ├──▶ 检查是否是 Mushroom 路由                          │
│        ├──▶ 检查是否未登录                                    │
│        ├──▶ 检查是否在 iframe 中                              │
│        │                                                       │
│        └──▶ 满足条件 ──▶ 显示 Mushroom 的 Google One Tap       │
│                                                                     │
└─────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

### Risk: 功能回归风险

**风险**：在重构过程中可能引入 bug，导致现有功能无法正常工作。

**缓解措施**：
- 严格遵循最小改动原则，只修改必要的代码
- 充分测试所有登录流程（密码登录、Google 登录、Google One Tap、SSO 登录）
- 测试登出流程和路由跳转
- 测试边界情况（未登录访问、登录后刷新等）
- 保留现有的错误处理逻辑

### Risk: 状态同步问题

**风险**：新的 Manager 和主站 Service 的状态可能出现不一致。

**缓解措施**：
- MushroomAuthManager 和 MushroomUserManager 直接调用相同的 API
- 使用相同的 Token 存储机制（Cookie）
- 确保登录成功后正确刷新用户信息
- 使用 BroadcastChannel 通知其他标签页的登录状态变化

### Risk: Google One Tap 重复唤起风险

**风险**：如果主站和 Mushroom 的判断逻辑不一致，可能导致 Google One Tap 被跳过或重复唤起。

**缓解措施**：
- 确保 AuthService.isMushroomRoute 和 LoginManager._isMushroomRoute 使用相同的判断逻辑
- 确保 MushroomAuthManager.checkPromptGoogleOneTap 在主站跳过后才执行
- 充分测试各种路由场景

## Migration Plan

### Steps

1. **创建新的 Manager**
   - 创建 MushroomAuthManager，实现认证相关功能
   - 创建 MushroomUserManager，实现用户信息管理功能
   - 确保 Manager 遵循项目的 Manager 模式规范

2. **集成到 MushroomController**
   - 修改 MushroomController，添加新的 Manager 实例
   - 更新 combinedStore，包含新 Manager 的 store
   - 更新 bootstrap() 和 dispose() 方法

3. **修改 MushroomBootstrap**
   - 移除对 AuthService 的依赖
   - 使用 mushroomAuthManager.checkLogin() 替代 authService.checkLogin()
   - 确保登录成功后的逻辑保持不变

4. **修改 MushroomLoginModal**
   - 从 Context 获取 MushroomController
   - 使用 mushroomAuthManager.loginWithPassword() 替代 authService.loginManager.loginWithPassword()
   - 确保 Google 登录和 SSO 登录的回调逻辑正确

5. **修改主站 LoginManager**
   - 添加 _isMushroomRoute() 方法
   - 在 checkPromptGoogleOneTap() 中添加 Mushroom 路由判断
   - 确保非 Mushroom 路由不受影响

6. **更新文档和注释**
   - 更新 AuthService.isMushroomRoute 的注释
   - 添加必要的代码注释

7. **测试验证**
   - 测试所有登录流程
   - 测试登出流程
   - 测试路由跳转
   - 测试边界情况

### Rollback

如果需要回滚：

1. 恢复 MushroomBootstrap 对 AuthService 的依赖
2. 恢复 MushroomLoginModal 对 AuthService 的依赖
3. 从 MushroomController 中移除新的 Manager
4. 从 LoginManager 中移除 Mushroom 路由判断
5. 删除新创建的 Manager 文件

由于本次变更不修改后端 API 或数据模型，回滚是安全的，不会影响数据一致性。

## References

### 相关文档

- 项目架构指南：`.project-rules/frontend/architecture.md`
- 目录结构规范：`.project-rules/frontend/directory-structure.md`
- 编码规范：`.project-rules/frontend/coding-conventions.md`

### 相关代码

- AuthService：`webserver/frontend/feature/services/auth-service/auth-service.ts`
- UserService：`webserver/frontend/feature/services/user-service/user-service.ts`
- LoginManager：`webserver/frontend/feature/services/auth-service/login-manager.ts`
- MushroomBootstrap：`webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx`
- MushroomLoginModal：`webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
- MushroomController：`webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`
