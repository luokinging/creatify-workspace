# Proposal: Mushroom 认证与用户系统解耦重构

## 需求摘要

将 Mushroom 模块的登录和用户系统从主站 AuthService/UserService 解耦，在 mushroom-controller 中创建独立的 MushroomAuthManager 和 MushroomUserManager，实现完全独立的认证和用户管理逻辑。

## 背景与动机

Mushroom 作为一个独立的应用模块，其登录和用户系统目前完全依赖主站的 AuthService 和 UserService。这导致：

1. **代码耦合严重**：MushroomLoginModal 直接使用 `authService.loginManager`
2. **路由判断散落**：`isMushroomRoute()` 判断逻辑散布在 AuthService 中
3. **扩展困难**：Mushroom 无法独立实现自己的认证策略
4. **测试复杂**：无法单独测试 Mushroom 的认证逻辑

通过解耦，Mushroom 将拥有独立的认证和用户管理能力，为未来的模块化扩展打下基础。

## 目标与成功标准

- 在 mushroom-controller 中创建 MushroomAuthManager，实现独立的登录逻辑
- 在 mushroom-controller 中创建 MushroomUserManager，实现独立的用户状态管理
- 修改 MushroomLoginModal 使用新的 MushroomAuthManager
- 修改 MushroomBootstrap 使用新的认证管理器
- 修改 AuthService 判断逻辑，当 URL 是 `/mushroom/` 时跳过 Mushroom 相关处理
- MushroomAuthManager 独立处理 Google One Tap 唤起
- 保持现有功能表现不变，单纯剥离逻辑

**成功标准**：
- Mushroom 模块不再直接依赖主站的 AuthService 和 UserService
- 所有现有的 Mushroom 登录功能正常工作
- Google One Tap 在主站和 Mushroom 模块分别正确处理
- 用户登出、登录状态同步等功能正常

## 范围与边界

### In Scope（本次包含）

- 创建 MushroomAuthManager 类
  - 密码登录 (loginWithPassword)
  - Google OAuth 登录 (loginWithGoogle)
  - Google One Tap 唤起管理
  - SSO 登录检测和跳转
  - 登录状态检查 (checkLogin)
  - 登出处理 (signOut)

- 创建 MushroomUserManager 类
  - 用户信息获取和缓存
  - 用户状态管理 (UserStore)
  - 用户信息刷新
  - 用户信息更新

- 修改 MushroomLoginModal 使用 MushroomAuthManager
- 修改 MushroomBootstrap 初始化逻辑
- 修改 UserAvatarDropdown 使用新的认证管理器
- 修改 ShortLinkRedirectPage 使用新的认证管理器
- 修改 AuthService 跳过 Mushroom 路由处理
- 修改 AppContainer 中的 Google One Tap 唤起逻辑

### Out of Scope（本次不包含）

- **不修改现有的 AuthService 和 UserService**：保持主站功能不变
- **不实现新的认证方式**：仅迁移现有功能
- **不涉及后端 API 变更**：使用现有 API
- **不涉及数据库变更**：无数据层修改
- **Mushroom 其他模块的改造**：仅限认证和用户系统

## 用户/系统场景

### 场景 1：用户访问 Mushroom 页面登录

- **谁**：未登录用户
- **何时/条件**：访问 `/mushroom/*` 路由，需要登录才能继续
- **做什么**：
  1. MushroomBootstrap 检测到需要登录
  2. 调用 MushroomAuthManager.checkLogin()
  3. 弹出 MushroomLoginModal
  4. 用户输入账号密码或选择 Google 登录
  5. 登录成功后，通过 BroadcastChannel 通知其他标签页
  6. MushroomController.bootstrap(true) 初始化完成
- **得到什么**：用户成功登录 Mushroom 模块，可以正常使用功能

### 场景 2：Google One Tap 在 Mushroom 中唤起

- **谁**：未登录用户
- **何时/条件**：访问 `/mushroom/*` 路由，满足 Google One Tap 唤起条件
- **做什么**：
  1. AppContainer 检测到当前是 Mushroom 路由，跳过 Google One Tap
  2. MushroomAuthManager 在初始化时独立唤起 Google One Tap
  3. 用户通过 Google One Tap 完成登录
  4. Mushroom 模块获取用户信息并初始化
- **得到什么**：用户在 Mushroom 模块中通过 Google One Tap 快速登录

### 场景 3：用户在 Mushroom 中登出

- **谁**：已登录用户
- **何时/条件**：在 Mushroom 页面点击登出按钮
- **做什么**：
  1. UserAvatarDropdown 响应登出操作
  2. 调用 MushroomAuthManager.signOut()
  3. 清理 Mushroom 模块的用户状态
  4. 通过 BroadcastChannel 通知主站和其他模块
  5. 页面刷新或跳转到指定页面
- **得到什么**：用户登出成功，状态同步到所有标签页

### 场景 4：跨标签页状态同步

- **谁**：已登录用户
- **何时/条件**：在多个标签页中使用 Mushroom，其中一个标签页登录/登出
- **做什么**：
  1. 用户在标签页 A 中完成登录
  2. MushroomAuthManager 发送 BroadcastChannel 消息
  3. 标签页 B 收到消息，更新本地状态
  4. 两个标签页保持状态一致
- **得到什么**：多标签页状态正确同步，用户体验一致

## 约束与假设

### 约束

- **最小改动原则**：不能修改现有的 AuthService 和 UserService 实现
- **功能兼容性**：所有现有的 Mushroom 登录功能必须保持正常工作
- **无破坏性变更**：主站功能不受影响
- **向后兼容**：其他模块使用 AuthService 不受影响

### 假设

- 用户已经拥有可用的 refresh token（由现有系统处理）
- 后端 API 接口保持不变
- BroadcastChannel 通信机制继续使用
- Cookie 存储机制保持不变

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MushroomAuthManager | Mushroom 模块独立的认证管理器 | 新创建，位于 mushroom/manager/ |
| MushroomUserManager | Mushroom 模块独立的用户管理器 | 新创建，位于 mushroom/manager/ |
| isMushroomRoute | 判断当前 URL 是否为 Mushroom 路由 | `window.location.pathname.startsWith('/mushroom/')` |
| Google One Tap | Google 快速登录功能 | 需要在主站和 Mushroom 分别处理 |
| BroadcastChannel | 跨标签页通信机制 | 继续使用现有通道 |

## 参考与链接

### 相关代码文件

**前端 Code Point:**
- `webserver/frontend/feature/services/auth-service/auth-service.ts` - 主站认证服务
- `webserver/frontend/feature/services/user-service/user-service.ts` - 主站用户服务
- `webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx` - Mushroom 初始化组件
- `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts` - Mushroom 控制器
- `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx` - Mushroom 登录弹窗
- `webserver/frontend/feature/mushroom/block/user-avatar-dropdown.tsx` - 用户头像下拉菜单
- `webserver/frontend/feature/services/app-container-service/app-container.ts` - 应用容器初始化
- `webserver/frontend/feature/services/auth-service/login-manager.ts` - 登录管理器
- `webserver/frontend/feature/auth/util.ts` - Google One Tap 工具函数

### 前端路由
- `/mushroom/*` - Mushroom 模块所有路由
- `/mushroom/projects` - Mushroom 项目列表页

### 设计依赖
- `.project-rules/frontend/architecture.md` - Manager 模式架构
- `.project-rules/frontend/mvc-architecture.md` - MVC 架构规范
