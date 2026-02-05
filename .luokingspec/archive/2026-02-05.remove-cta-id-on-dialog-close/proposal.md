# remove-cta-id-on-dialog-close - 关闭 CTA 预览对话框时移除 URL 中的 cta_id 参数

## 概述

当用户在 CTA 批量预览页面点击 Edit 按钮打开预览对话框时，URL 会添加 `cta_id=xxx` 参数用于标识当前编辑的 CTA。但是当用户关闭对话框时，该参数没有被移除，导致 URL 状态与实际页面状态不一致。

## 需求背景

### 当前行为
- 点击 Edit 按钮 → URL 变为 `/tool/cta-generator/batch-preview?jobId=xxx&cta_id=yyy`
- 关闭对话框 → URL 仍然是 `/tool/cta-generator/batch-preview?jobId=xxx&cta_id=yyy`

### 期望行为
- 点击 Edit 按钮 → URL 变为 `/tool/cta-generator/batch-preview?jobId=xxx&cta_id=yyy`
- 关闭对话框 → URL 恢复为 `/tool/cta-generator/batch-preview?jobId=xxx`

### 问题影响
- URL 状态与实际页面状态不一致
- 用户可能通过浏览器历史记录或刷新页面时，导致意外的 Dialog 打开
- 用户体验不佳，URL 应该准确反映当前页面状态

## 需求类型

**Bugfix / Enhancement**

## 涉及领域

**前端**

## 功能需求

### 核心需求
1. 当用户关闭 CTA 预览对话框时，从 URL 中移除 `cta_id` 参数
2. 保留其他 URL 参数（如 `jobId`）
3. 只处理用户主动关闭 Dialog 的场景（点击关闭按钮、点击返回按钮）

### 实现方案
在 `CTAPreviewDialog` 组件的 `handleOpenChange` 函数中，当 Dialog 关闭时（`newOpen` 为 `false`）：
1. 获取当前 URL 的 search 参数
2. 移除 `cta_id` 参数
3. 使用 `router.navigate` 更新 URL（使用 `replace: true` 避免产生额外的历史记录）

### 边界情况
- 如果 URL 中没有 `cta_id` 参数，不执行任何操作
- 如果 Dialog 不是通过 Edit 按钮打开的（比如通过其他方式），也应该正常工作
- 需要考虑多个参数同时存在的情况（如 `jobId` 和 `cta_id` 同时存在）

## 技术约束
- 使用项目现有的 `router` 工具（`@/hook/use-router`）
- 使用 `@tanstack/react-router` 的导航 API
- 遵循前端路由管理规范

## 验收标准
1. 点击 Edit 按钮打开 Dialog，URL 包含 `cta_id` 参数
2. 关闭 Dialog，URL 中的 `cta_id` 参数被移除
3. 其他参数（如 `jobId`）被保留
4. 不会产生额外的浏览器历史记录
5. 刷新页面不会意外打开 Dialog
