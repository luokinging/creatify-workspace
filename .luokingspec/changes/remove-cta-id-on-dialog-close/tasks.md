# T-001 关闭 CTA 预览对话框时移除 URL 中的 cta_id 参数

## 需求描述

当前在 CTA 批量预览页面点击 Edit 按钮打开预览对话框时，URL 会添加 `cta_id` 参数用于标识当前编辑的 CTA。但是当用户关闭对话框时，该参数没有被移除，导致 URL 状态与实际页面状态不一致。

本任务需要在关闭 CTAPreviewDialog 时，从 URL 中移除 `cta_id` 参数，同时保留其他参数（如 `jobId`），并避免产生额外的浏览器历史记录。

**需求类型**：Bugfix / Enhancement

**涉及领域**：前端

### 功能详细说明

当用户在 `/tool/cta-generator/batch-preview` 页面点击 Edit 按钮时：
1. URL 变为 `/tool/cta-generator/batch-preview?jobId=xxx&cta_id=yyy`
2. Dialog 打开，显示对应的 CTA 编辑界面

当用户关闭 Dialog 时（通过点击关闭按钮、返回按钮或 ESC 键）：
1. Dialog 关闭
2. URL 变为 `/tool/cta-generator/batch-preview?jobId=xxx`（移除 `cta_id` 参数）
3. 不产生额外的浏览器历史记录（使用 `replace: true`）

### 用户交互流程

1. 用户在批量预览页面点击某个 CTA 的 Edit 按钮
2. URL 更新为包含 `cta_id` 参数
3. Dialog 打开
4. 用户点击关闭按钮/返回按钮/按 ESC 键
5. Dialog 关闭
6. URL 中的 `cta_id` 参数被移除
7. URL 恢复为打开 Dialog 之前的状态（保留 `jobId` 等其他参数）

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解组件与路由的交互方式
- `.project-rules/frontend/coding-conventions.md` - 了解代码风格约定

**前端Code Point:**
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-dialog.tsx` - 需要修改的 Dialog 组件
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 参考 Edit 按钮的实现
- `webserver/frontend/.vite/routes/(desktop)/tool/cta-generator/batch-preview.tsx` - 路由定义

**前端路由:**
- `/tool/cta-generator/batch-preview` - CTA 批量预览页面
- 路由参数：`jobId`（可选）、`cta_id`（可选）

**其他:**
- TanStack Router 导航 API 文档：https://tanstack.com/router/latest/docs/framework/react/guide/navigation
- 项目中的 router 使用方式：`webserver/frontend/hook/use-router.ts`

## 注意点

- **只在 URL 中存在 `cta_id` 参数时才执行更新操作**：避免不必要的路由更新
- **使用 `replace: true`**：确保关闭 Dialog 不会产生额外的浏览器历史记录
- **保留其他参数**：确保 `jobId` 等其他参数不会被误删
- **同步处理**：URL 更新应该在 Dialog 关闭逻辑中同步执行
- **路由命名**：注意路由中的参数名称是 `cta_id`（下划线）而不是 `ctaId`（驼峰）
- **避免循环更新**：确保 URL 更新不会触发 Dialog 再次打开

## Scenario

### Scenario 1: 正常关闭 Dialog

**场景描述：**
用户点击 Edit 按钮打开 Dialog，然后通过关闭按钮关闭 Dialog。

**前置条件：**
- 用户在 `/tool/cta-generator/batch-preview?jobId=123` 页面
- 页面显示多个 CTA 预览

**操作步骤：**
1. 用户点击某个 CTA 的 Edit 按钮
2. URL 变为 `/tool/cta-generator/batch-preview?jobId=123&cta_id=cta_456`
3. Dialog 打开
4. 用户点击 Dialog 的关闭按钮或返回按钮

**预期结果：**
- Dialog 关闭
- URL 变为 `/tool/cta-generator/batch-preview?jobId=123`
- `cta_id` 参数被移除
- `jobId` 参数被保留
- 浏览器历史记录没有增加（点击后退按钮会返回到上一个页面）

### Scenario 2: URL 中没有 cta_id 参数

**场景描述：**
Dialog 打开时 URL 中没有 `cta_id` 参数（比如通过其他方式打开 Dialog）。

**前置条件：**
- 用户在批量预览页面
- URL 为 `/tool/cta-generator/batch-preview?jobId=123`（没有 `cta_id`）

**操作步骤：**
1. Dialog 打开（通过非 Edit 按钮的方式）
2. 用户关闭 Dialog

**预期结果：**
- Dialog 正常关闭
- URL 保持不变（因为没有 `cta_id` 参数需要移除）
- 不会产生错误或警告

### Scenario 3: 多个参数同时存在

**场景描述：**
URL 中同时存在 `jobId` 和 `cta_id` 参数。

**前置条件：**
- URL 为 `/tool/cta-generator/batch-preview?jobId=123&cta_id=cta_456`

**操作步骤：**
1. Dialog 打开
2. 用户关闭 Dialog

**预期结果：**
- Dialog 关闭
- URL 变为 `/tool/cta-generator/batch-preview?jobId=123`
- 只有 `cta_id` 被移除
- `jobId` 被保留

### Scenario 4: 通过 ESC 键关闭 Dialog

**场景描述：**
用户通过按 ESC 键关闭 Dialog。

**前置条件：**
- Dialog 处于打开状态
- URL 包含 `cta_id` 参数

**操作步骤：**
1. 用户按下 ESC 键
2. Dialog 关闭

**预期结果：**
- Dialog 关闭
- URL 中的 `cta_id` 参数被移除
- 与通过关闭按钮关闭的行为一致

## Checklist

- [ ] C-001 修改 `CTAPreviewDialog` 组件，导入 `router` 和 `Route`（获取当前搜索参数）
- [ ] C-002 在 `handleOpenChange` 函数中，当 Dialog 关闭时（`newOpen` 为 `false`），检查 URL 中是否存在 `cta_id` 参数
- [ ] C-003 如果存在 `cta_id` 参数，使用 `router.navigate` 移除该参数（设置 `cta_id: undefined`），同时保留其他参数
- [ ] C-004 使用 `replace: true` 选项更新 URL，避免产生额外的浏览器历史记录
- [ ] C-005 测试各种关闭场景：点击关闭按钮、点击返回按钮、按 ESC 键
- [ ] C-006 测试边界情况：URL 中没有 `cta_id` 参数、只有 `cta_id` 参数、多个参数同时存在
- [ ] C-007 验证浏览器历史记录没有增加（点击后退按钮应该返回到上一个页面）
- [ ] C-008 验证刷新页面不会意外打开 Dialog
- [ ] C-009 运行 `bun run precommit` 进行 TypeScript 和代码风格检查
- [ ] C-010 如果修改了路由相关代码，运行 `bun run generate-routes` 重新生成路由类型
