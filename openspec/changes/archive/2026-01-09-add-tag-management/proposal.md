# Change: Add Tag List Management Page

## Why
用户需要一个集中的界面来查看、管理和清理项目中的标签。目前，标签只能通过评估工单间接管理，这使得很难查看所有标签、识别未使用的标签以及执行批量清理操作。

## What Changes
- 添加新路由 `/mushroom/project/tags`，带有 `projectId` 查询参数
- 在侧边栏面板中添加"Label"图标按钮（位于 Member 按钮的左侧）以导航到标签页面
- 创建带有三个标签组的标签管理页面：
  - **Your Tags**：当前用户至少附加过一次的标签
  - **All Tags**：项目中的所有标签
  - **Unused Tags**：未附加到任何书签的标签，带有批量删除按钮
- 实现悬停显示删除交互，带有确认对话框（仅适用于未使用的标签）
- 在页面右上角区域添加"Create Tag"按钮（如果存在 Bulk Edit 按钮，则位于其左侧）
- 实现带有标签名称输入字段的标签创建对话框
- 后端增强以支持标签过滤和使用计数

## Impact
- **受影响规格**：新功能 `tag-management`
- **受影响代码**：
  - Frontend: `webserver/frontend/feature/mushroom/sub-feature/project-management/`
    - `page/desktop/sidebar/sidebar-panel.tsx`（添加标签按钮）
    - 新的标签页面组件
  - Backend: `webserver/backend/mushroom/views/tags.py`（增强过滤并添加使用端点）
- **迁移**：不需要数据库迁移（MushroomTag 模型已存在）
