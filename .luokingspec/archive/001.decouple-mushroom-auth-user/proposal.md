# Proposal: 解耦 Mushroom 模块的认证和用户系统

## 需求摘要

将 Mushroom 模块的登录和用户系统从主站完全剥离，创建独立的 `MushroomAuthManager` 和 `MushroomUserManager`，使 Mushroom 模块在认证和用户状态管理上完全自治。

## 背景与动机

Mushroom 作为一个独立的应用模块，目前其登录和用户系统仍然依赖主站的 `IAuthService` 和 `IUserService`。这种耦合带来以下问题：

1. **架构耦合**：Mushroom 模块内部直接调用主站服务接口，导致模块边界不清晰
2. **维护复杂性**：主站服务变更可能影响 Mushroom 模块
3. **独立部署困难**：无法将 Mushroom 作为独立应用部署

当前依赖情况：
- 8 个文件直接依赖 `IAuthService`
- 9 个文件直接依赖 `IUserService`
- 涉及组件层、Manager 层、ViewController 层

## 目标与成功标准

- 创建独立的 `MushroomAuthManager` 处理所有认证相关逻辑
- 创建独立的 `MushroomUserManager` 处理用户状态管理
- Mushroom 模块内部不再直接依赖 `IAuthService` 和 `IUserService`
- 保持所有现有功能正常工作
- 不影响主站的登录功能

**成功标准**：
- Mushroom 模块内所有对 `IAuthService` / `IUserService` 的调用已迁移到新 Manager
- 所有登录方式（密码、Google、SSO）正常工作
- 登出行为符合预期（Mushroom 登出同时登出主站）
- 从 Mushroom 跳转到主站时，主站能正确初始化

## 范围与边界

### In Scope（本次包含）

- 创建 `MushroomAuthManager` 和 `MushroomUserManager`
- 迁移 Mushroom 模块中所有对主站服务的直接调用
- 处理登出时的主站同步
- 处理跳转主站时的 bootstrap 调用

### Out of Scope（本次不包含）

- 后端 API 变更 — 复用现有主站 API
- 主站代码修改 — 主站服务保持不变
- Mushroom 组件嵌入主站场景 — 不存在此场景

## 用户/系统场景

### 场景 1：用户在 Mushroom 中登录

- **谁**：未登录用户
- **何时/条件**：访问 Mushroom 页面需要登录时
- **做什么**：通过 MushroomLoginModal 输入凭证登录
- **得到什么**：登录成功，MushroomUserManager 存储用户信息，可以访问受保护内容

### 场景 2：用户在 Mushroom 中登出

- **谁**：已登录用户
- **何时/条件**：点击用户头像下拉菜单的"登出"
- **做什么**：MushroomAuthManager 处理登出，同时清理主站认证状态
- **得到什么**：用户被登出，Cookie 被清理，跳转到项目列表页

### 场景 3：用户从 Mushroom 跳转到主站

- **谁**：已登录用户
- **何时/条件**：点击 Mushroom 顶部栏的主站入口
- **做什么**：跳转前触发主站的 bootstrap 流程
- **得到什么**：主站正确初始化用户状态，无缝切换

### 场景 4：多标签页场景

- **谁**：用户
- **何时/条件**：同时在不同标签页打开主站和 Mushroom
- **做什么**：各自独立 bootstrap，通过 Cookie 共享 Token
- **得到什么**：两个应用独立运行，认证状态通过 Cookie 同步

## 约束与假设

### 约束

- 复用现有主站后端 API，不做后端改动
- Token 存储在 Cookie 中，主站和 Mushroom 共享
- 登出行为需要同步清理主站状态

### 假设

- BroadcastChannel 机制可用于跨标签页通信
- 主站的 `bootstrapAuth` 方法可以被外部调用

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MushroomAuthManager | Mushroom 认证管理器 | 负责登录、登出、认证状态 |
| MushroomUserManager | Mushroom 用户管理器 | 负责用户信息状态管理 |
| MushroomController | Mushroom 模块总控制器 | 已存在，将集成新 Manager |
| BroadcastChannel | 浏览器跨标签页通信 | 用于登录/登出事件同步 |

## 参考与链接

- 主站 AuthService: `webserver/frontend/feature/services/auth-service/auth-service.ts`
- 主站 UserService: `webserver/frontend/feature/services/user-service/user-service.ts`
- MushroomController: `webserver/frontend/feature/mushroom/manager/mushroom-controller.ts`
- MushroomLoginModal: `webserver/frontend/feature/mushroom/component/mushroom-login-modal.tsx`
