# Proposal: 完全解耦 Mushroom 模块与主站 Service 的依赖

## 需求摘要

在现有 `decouple-mushroom-auth-user` 任务的基础上，完成 Mushroom 模块内所有对主站 AuthService 和 UserService 依赖的替换，实现完全解耦。

## 背景与动机

- 现有的 `decouple-mushroom-auth-user` 任务已经创建了 MushroomAuthManager 和 MushroomUserManager
- 但是 Mushroom 模块中仍有多个文件直接使用主站的 AuthService 和 UserService
- 这些依赖阻碍了 Mushroom 模块的完全独立性
- 需要完成所有剩余的 Service 替换，实现彻底解耦

## 目标与成功标准

- 替换所有直接使用 AuthService 的地方为 MushroomAuthManager
- 替换所有直接使用 UserService 的地方为 MushroomUserManager
- 保持现有功能完全不变，只进行代码层面的解耦
- 确保 Mushroom 模块不再依赖主站的 AuthService 和 UserService

**成功标准**：

- Mushroom 模块内所有文件不再直接导入或使用主站的 AuthService 和 UserService
- 所有登录、登出、用户信息获取功能正常工作
- 所有现有测试通过，无功能回归
- MushroomController 仍然是唯一的外部依赖点（通过构造函数接收 UserService）

## 范围与边界

### In Scope（本次包含）

- 替换 `user-avatar-dropdown.tsx` 中的 AuthService 和 UserService 使用
- 替换 `short-link-redirect-page.tsx` 中的 AuthService 使用
- 替换 `invite-page.tsx` 中的 AuthService 使用
- 替换 `projects/page/index.tsx` 中的 UserService 使用
- 替换 `share-topbar.tsx` 中的 UserService 使用
- 移除 Manager 中对 AuthService 的构造函数依赖（MushroomProjectManager, ProjectDashboardViewController）
- 更新 MushroomController 中的 Manager 初始化逻辑

### Out of Scope（本次不包含）

- 修改主站的 AuthService 和 UserService
- 修改 Mushroom 模块以外的代码
- 修改 API 层的实现
- 修改现有的权限管理系统（NewPermissionManager 继续使用 UserService）

## 用户/系统场景

### 场景 1：用户在 Mushroom 页面点击用户头像下拉菜单

- **谁**：访问 Mushroom 页面的用户
- **何时/条件**：用户点击右上角的用户头像
- **做什么**：显示用户信息和操作选项（登录/登出）
- **得到什么**：使用 MushroomAuthManager 和 MushroomUserManager 而非主站 Service

### 场景 2：用户通过短链接访问共享内容

- **谁**：通过短链接访问的未登录用户
- **何时/条件**：短链接需要认证
- **做什么**：显示登录按钮，点击后弹出登录弹窗
- **得到什么**：使用 MushroomAuthManager 进行登录检查

### 场景 3：用户访问邀请页面

- **谁**：通过邀请链接访问的用户
- **何时/条件**：访问邀请页面
- **做什么**：验证邀请并接受
- **得到什么**：使用主站 AuthService（因为这是跨模块的邀请流程）

## 约束与假设

### 约束

- 不能修改现有的权限管理系统逻辑
- NewPermissionManager 和 PermissionManager 继续使用 UserService
- 必须保持现有功能完全不变
- 必须遵循项目的 Manager 模式规范

### 假设

- MushroomController 仍然通过构造函数接收 UserService（用于权限管理）
- UI 组件应该通过 MushroomController 访问 Manager，而非直接使用 Service
- 登录相关的操作应该统一使用 MushroomAuthManager
- 用户信息获取应该统一使用 MushroomUserManager

## 名词与术语

| 术语/缩写 | 含义 | 备注 |
|----------|------|------|
| MushroomAuthManager | Mushroom 的认证管理器 | 封装 Mushroom 的登录、登出等认证逻辑 |
| MushroomUserManager | Mushroom 的用户管理器 | 封装 Mushroom 的用户信息管理逻辑 |
| Service 解耦 | 移除对主站 Service 的直接依赖 | 通过 Mushroom 的 Manager 替代 |

## 参考与链接

- 现有任务：`.luokingspec/changes/decouple-mushroom-auth-user/`
- MushroomAuthManager：`webserver/frontend/feature/mushroom/manager/mushroom-auth-manager.ts`
- MushroomUserManager：`webserver/frontend/feature/mushroom/manager/mushroom-user-manager.ts`
- 项目规则：`.project-rules/frontend/architecture.md`
