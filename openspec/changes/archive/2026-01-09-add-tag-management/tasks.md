## 1. Backend Implementation

- [ ] 1.1 在 `webserver/backend/mushroom/views/tags.py` 中向 `MushroomTagViewSet` 添加 `usage` 操作
  - [ ] 1.1.1 实现 `get_usage_counts()` 方法以从评估工单聚合标签使用情况
  - [ ] 1.1.2 按当前用户的附加历史过滤 `your_tags`
  - [ ] 1.1.3 过滤 `all_tags` 以包含所有项目标签
  - [ ] 1.1.4 过滤 `unused_tags`，其中 `usage_count = 0`
  - [ ] 1.1.5 为 `/api/mushroom/tags/usage/` 添加 URL 路由

- [ ] 1.2 验证 `MushroomTagViewSet` 中是否存在标签创建端点
  - [ ] 1.2.1 确认 `POST` 端点创建项目范围的标签
  - [ ] 1.2.2 验证重复标签名称的验证
  - [ ] 1.2.3 确认用户创建的标签强制 `is_system` 为 `False`

- [ ] 1.3 在 `webserver/backend/mushroom/tests/` 中添加标签使用端点的单元测试
  - [ ] 1.2.1 测试使用计数计算
  - [ ] 1.2.2 测试用户特定的标签过滤
  - [ ] 1.2.3 测试未使用标签检测
  - [ ] 1.2.4 使用系统标签进行测试

## 2. Frontend Data Layer

- [ ] 2.1 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/api/tags.api.ts` 中创建标签 API 客户端
  - [ ] 2.1.1 定义 `TagUsageResponse` 类型
  - [ ] 2.1.2 实现 `getTagUsage(projectId: string)` 函数（用于 `createAutoKeyMiniQueryClient` 的稳定函数引用）
  - [ ] 2.1.3 实现 `deleteTag(tagId: string)` 函数
  - [ ] 2.1.4 实现 `bulkDeleteUnusedTags(tagIds: string[])` 函数
  - [ ] 2.1.5 实现 `createTag(projectId: string, name: string)` 函数

- [ ] 2.2 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/manager/tags/tags-view-controller.tsx` 中创建 `TagsViewController`
  - [ ] 2.2.1 使用 `getTagUsage` 通过 `createAutoKeyMiniQueryClient` 创建 `tagUsageQueryClient`
  - [ ] 2.2.2 创建包含查询客户端存储的 `combinedStore`
  - [ ] 2.2.3 实现 `bootstrap()` 方法
  - [ ] 2.2.4 实现 `dispose()` 方法
  - [ ] 2.2.5 实现带有乐观更新的 `handleDeleteTag(tagId: string)` 方法
  - [ ] 2.2.6 实现带有乐观更新的 `handleBulkDeleteUnusedTags()` 方法
  - [ ] 2.2.7 实现带有乐观更新的 `handleCreateTag(name: string)` 方法

- [ ] 2.3 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/context/tags-view-controller-context.tsx` 中创建 Context 提供者
  - [ ] 2.3.1 创建 `TagsViewControllerContext`
  - [ ] 2.3.2 创建 `TagsViewControllerProvider` 组件
  - [ ] 2.3.3 创建 `useTagsViewController()` hook

## 3. Frontend UI Components

- [ ] 3.1 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-group-container.tsx` 中创建 `TagGroupContainer` 组件
  - [ ] 3.1.1 定义 props 接口（title、count、description、tags、actions）
  - [ ] 3.1.2 实现带有标题、徽章和描述的标题
  - [ ] 3.1.3 使用 flex-wrap 布局实现标签列表
  - [ ] 3.1.4 支持可选的 actions 插槽用于批量删除按钮

- [ ] 3.2 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-item.tsx` 中创建 `TagItem` 组件
  - [ ] 3.2.1 使用 `ClosableWrapper` 实现悬停显示删除交互
  - [ ] 3.2.2 显示标签名称和使用计数
  - [ ] 3.2.3 处理删除点击回调
  - [ ] 3.2.4 为系统标签隐藏删除按钮（`is_system=True`）
  - [ ] 3.2.5 为 `usage_count > 0` 的标签隐藏删除按钮（仅未使用的标签可删除）

- [ ] 3.3 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/component/tag-delete-confirm-dialog.tsx` 中创建删除确认对话框
  - [ ] 3.3.1 使用 UI 库中的 AlertDialog 组件
  - [ ] 3.3.2 接受标签名称、计数（用于批量）和 onConfirm 回调的 props
  - [ ] 3.3.3 处理确认和取消操作

- [ ] 3.4 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/component/create-tag-dialog.tsx` 中创建标签创建对话框
  - [ ] 3.4.1 使用 UI 库中的 Dialog 组件
  - [ ] 3.4.2 包含标签名称输入字段
  - [ ] 3.4.3 当输入为空时禁用"Create"按钮
  - [ ] 3.4.4 处理确认和取消操作
  - [ ] 3.4.5 显示来自后端的错误消息

- [ ] 3.5 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/tags-content-panel.tsx` 中创建标签页面内容面板
  - [ ] 3.5.1 通过 context 使用 `TagsViewController`
  - [ ] 3.5.2 在获取数据时显示加载状态
  - [ ] 3.5.3 如果获取失败，显示错误状态
  - [ ] 3.5.4 在右上角区域渲染"Create Tag"按钮（位于任何 Bulk Edit 按钮的左侧）
  - [ ] 3.5.5 为 Your Tags、All Tags、Unused Tags 渲染三个 `TagGroupContainer` 组件
  - [ ] 3.5.6 将删除交互连接到视图控制器方法
  - [ ] 3.5.7 将创建标签交互连接到视图控制器方法

## 4. Frontend Pages and Routing

- [ ] 4.1 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/page/tags-page.tsx` 中创建标签页面入口
  - [ ] 4.1.1 接受 `projectId` prop
  - [ ] 4.1.2 创建 `TagsViewController` 实例
  - [ ] 4.1.3 使用 `useEffect` 管理生命周期
  - [ ] 4.1.4 使用 `TagsViewControllerProvider` 提供 context
  - [ ] 4.1.5 根据断点渲染桌面/移动变体

- [ ] 4.2 在 `webserver/frontend/feature/mushroom/sub-feature/project-management/page/desktop/tags-page/index.tsx` 中创建桌面标签页面
  - [ ] 4.2.1 使用 `TagsContentPanel` 组件
  - [ ] 4.2.2 遵循与 `DesktopAssetPage` 相同的结构

- [ ] 4.3 在 `webserver/frontend/.vite/routes/mushroom/_layout/project/tags.tsx` 中创建路由文件
  - [ ] 4.3.1 定义带有 `projectId` 的 `TagsSearchParams` 类型
  - [ ] 4.3.2 配置路由验证
  - [ ] 4.3.3 将组件设置为 `TagsPage`

- [ ] 4.4 通过运行 `bun run generate-routes` 更新 TanStack Router 路由

## 5. Sidebar Integration

- [ ] 5.1 更新 `sidebar-panel.tsx` 以添加 Label 图标按钮
  - [ ] 5.1.1 导入带有 `icon="label"` 的 `IconButton`
  - [ ] 5.1.2 将按钮定位到 Member 按钮的左侧
  - [ ] 5.1.3 添加点击处理程序以导航到 `/mushroom/project/tags?projectId={projectId}`
  - [ ] 5.1.4 在客户端视图模式中隐藏按钮（与 Member 按钮相同）

## 6. Testing

- [ ] 6.1 Backend testing
  - [ ] 6.1.1 运行 `pytest` 进行标签使用端点测试
  - [ ] 6.1.2 验证系统标签保护
  - [ ] 6.1.3 使用各种标签计数和用户场景进行测试

- [ ] 6.2 Frontend testing
  - [ ] 6.2.1 测试从侧边栏导航到标签页面
  - [ ] 6.2.2 测试标签组渲染
  - [ ] 6.2.3 测试带确认的单个标签删除（仅未使用的标签）
  - [ ] 6.2.4 测试删除按钮对 `usage_count > 0` 的标签隐藏
  - [ ] 6.2.5 测试批量删除未使用的标签
  - [ ] 6.2.6 测试系统标签删除按钮隐藏
  - [ ] 6.2.7 测试创建标签对话框正确打开和关闭
  - [ ] 6.2.8 测试创建标签成功流程
  - [ ] 6.2.9 测试创建重复名称的标签显示错误
  - [ ] 6.2.10 测试创建标签按钮在输入为空时被禁用
  - [ ] 6.2.11 测试加载和错误状态

- [ ] 6.3 Integration testing
  - [ ] 6.3.1 测试从导航到删除的完整流程
  - [ ] 6.3.2 使用实际项目数据进行测试
  - [ ] 6.3.3 验证操作后计数正确更新

## 7. Code Quality

- [ ] 7.1 在前端目录中运行 `bun biome:fix` 进行代码格式化
- [ ] 7.2 运行 `bun precommit` 进行 TypeScript 检查
- [ ] 7.3 确保所有组件遵循 Manager 模式指南
- [ ] 7.4 验证所有导入使用完整文件路径（无索引导出）

## 8. Documentation

- [ ] 8.1 如果需要，更新组件文档
- [ ] 8.2 为任何复杂的业务逻辑添加注释
