# Proposal: 解耦 Mushroom 登录和用户系统

## 需求摘要

将 Mushroom 模块的登录和用户系统从主站独立出来，创建 MushroomAuthManager 和 MushroomUserManager，实现代码层面的解耦合，同时保持现有功能完全不变。

## 背景与动机

- Mushroom 作为独立的应用模块，其登录和用户逻辑目前仍依赖主站的 AuthService 和 UserService
- 这种耦合关系导致 Mushroom 模块无法独立部署和维护
- 需要将 Mushroom 的认证和用户逻辑剥离到独立的 Manager 中，放置在 MushroomController 管理下
- 主站需要能够识别 Mushroom 路由，并相应地调整 Google One Tap 的唤起逻辑

## 目标与成功标准

- 创建 MushroomAuthManager 和 MushroomUserManager，实现 Mushroom 模块的认证和用户逻辑独立
- 修改 MushroomBootstrap 和 MushroomLoginModal，使用新的 Manager 替代对主站 Service 的依赖
- 在主站 LoginManager 中添加 Mushroom 路由判断，跳过 Google One Tap 的自动唤起
- 保持现有功能完全不变，只进行代码层面的解耦

**成功标准**：

- Mushroom 模块不再直接依赖主站的 AuthService 和 UserService
- Mushroom 中的登录功能（密码登录、Google 登录）正常工作
- 主站在 Mushroom 路由下不会自动唤起 Google One Tap
- 所有现有测试通过，无功能回归

## 范围与边界

### In Scope（本次包含）

- 创建 MushroomAuthManager，封装 Mushroom 的认证逻辑
- 创建 MushroomUserManager，封装 Mushroom 的用户信息管理逻辑
- 修改 MushroomBootstrap，使用新的 MushroomAuthManager 进行登录检查
- 修改 MushroomLoginModal，使用新的 MushroomAuthManager 进行登录
- 在主站 LoginManager 中添加 Mushroom 路由判断，跳过 Google One Tap 自动唤起
- 在主站 AuthService.isMushroomRoute 中添加 Mushroom 路由判断

### Out of Scope（本次不包含）

- Magic Link/OTP 登录方式 — 仅支持现有的密码登录和 Google 登录
- SSO 登录方式 — 现有 MushroomLoginModal 已实现 SSO，保留其实现
- 修改现有的 AuthService 和 UserService — 只在主站添加路由判断逻辑

## 用户/系统场景

### 场景 1：用户在 Mushroom 页面访问时需要登录

- **谁**：访问 Mushroom 页面的未登录用户
- **何时/条件**：用户访问 `/mushroom/*` 路由，但未登录
- **做什么**：系统检测到未登录状态，弹出 MushroomLoginModal 进行登录
- **得到什么**：用户完成登录后，可以正常访问 Mushroom 页面

### 场景 2：用户在 Mushroom 页面点击 Google 登录按钮

- **谁**：在 Mushroom 页面的用户
- **何时/条件**：用户在 MushroomLoginModal 中点击"Continue with Google"按钮
- **做什么**：通过 Google OAuth 完成登录流程
- **得到什么**：登录成功后，可以正常访问 Mushroom 页面

### 场景 3：用户在 Mushroom 页面看到 Mushroom 自己的 Google One Tap

- **谁**：访问 Mushroom 页面的未登录用户
- **何时/条件**：用户访问 `/mushroom/*` 路由
- **做什么**：
  - 主站的 LoginManager 检测到是 Mushroom 路由，跳过主站的 Google One Tap 唤起
  - Mushroom 的 MushroomAuthManager 正常唤起 Google One Tap
- **得到什么**：用户在 Mushroom 页面看到 Google One Tap 的自动登录提示（由 Mushroom 管理而非主站）

## 约束与假设

### 约束

- 不能修改现有的 AuthService 和 UserService，只能在主站添加路由判断逻辑
- 必须保持现有功能完全不变，包括 UI 交互和用户体验
- 新的 Manager 必须遵循项目的 Manager 模式规范
- Google One Tap 的自动唤起必须在主站进行判断和跳过

### 假设

- Mushroom 模块当前只使用密码登录和 Google 登录两种方式
- SSO 登录由 MushroomLoginModal 现有实现处理，不需要在新 Manager 中重复
- 用户信息相关的 API 调用可以继续使用现有的 API 函数
- Mushroom 路由的判断标准是 URL 路径以 `/mushroom/` 开头

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MushroomAuthManager | Mushroom 的认证管理器 | 封装 Mushroom 的登录、登出等认证逻辑 |
| MushroomUserManager | Mushroom 的用户管理器 | 封装 Mushroom 的用户信息管理逻辑 |
| Google One Tap | Google 的自动登录提示 | Google 提供的自动登录功能，可在页面加载时自动显示 |
| Mushroom 路由 | 以 `/mushroom/` 开头的 URL 路径 | 用于判断用户是否在 Mushroom 模块中 |

## 参考与链接

- 现有 AuthService：`webserver/frontend/feature/services/auth-service/auth-service.ts`
- 现有 UserService：`webserver/frontend/feature/services/user-service/user-service.ts`
- 现有 LoginManager：`webserver/frontend/feature/services/auth-service/login-manager.ts`
- MushroomBootstrap：`webserver/frontend/feature/mushroom/block/mushroom-bootstrap.tsx`
- MushroomLoginModal：`webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
- MushroomController：`webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`
- 项目规则：`.project-rules/frontend/architecture.md`
