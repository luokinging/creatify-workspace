# T-001 修复 Mushroom 路由参数验证错误处理

## 需求描述

**Bugfix：修复路由参数缺失时的页面崩溃问题**

当用户访问带有必需参数的路由（如 `/mushroom/project/preview?assetId=xxx&projectId=yyy`）后分享不带参数的 URL（`/mushroom/project/preview`）给其他用户时，页面会因为 TanStack Router 的 `SearchParamError` 而崩溃。

**问题根源**：
- TanStack Router 的 `validateSearch` 使用 Zod schema 验证失败时会抛出未捕获的 `SearchParamError`
- 错误发生在路由匹配阶段，甚至在组件渲染之前
- 项目中没有全局的错误处理机制来捕获这类错误

**解决方案**：
将各路由的 Zod schema `validateSearch` 替换为自定义 `validateSearch` 函数，在函数内部使用 `zod.safeParse()` 进行验证，验证失败时使用 `redirect` 重定向到 `/mushroom/projects` 页面。

**需求类型**：Bugfix

**涉及领域**：前端

**功能要求**：
- 修改所有存在必需参数验证问题的路由
- 使用自定义 `validateSearch` 函数替代直接使用 Zod schema
- 保持类型安全，使用 `zod.safeParse()` 进行验证
- 验证失败时重定向到 `/mushroom/projects`
- 不改变现有的类型定义和组件逻辑

## 相关指引

**前端规则:**
- `.project-rules/frontend/workflow-bugfix.md` - Bugfix 工作流程
- `.project-rules/frontend/coding-conventions.md` - 代码风格约定

**前端Code Point:**
- `webserver/frontend/.vite/routes/mushroom/_layout/project/preview.tsx` - 预览路由
- `webserver/frontend/.vite/routes/mushroom/_layout/project/compare.tsx` - 对比路由
- `webserver/frontend/.vite/routes/mushroom/_layout/project/asset.tsx` - 资产路由
- `webserver/frontend/.vite/routes/mushroom/_layout/share/preview.tsx` - 分享预览路由
- `webserver/frontend/.vite/routes/mushroom/_layout/invite.tsx` - 邀请路由
- `webserver/frontend/.vite/routes/mushroom/_layout/index.tsx` - 参考现有的 redirect 实现方式

**前端路由:**
- `/mushroom/project/preview` - 需要 `assetId` 和 `projectId`
- `/mushroom/project/compare` - 需要 `projectId`, `assetAId`, `assetBId`
- `/mushroom/project/asset` - 需要 `projectId`
- `/mushroom/share/preview` - 需要 `collectionId` 和 `assetId`
- `/mushroom/invite` - 需要 `code`

**其他:**
- TanStack Router 文档：https://tanstack.com/router/latest/docs/framework/react/guide/search-params#validation

## 注意点

- **保持类型安全**：使用 `zod.safeParse()` 而不是手动类型检查，确保类型推断正确
- **统一 redirect 目标**：所有路由统一重定向到 `/mushroom/projects`
- **不影响现有逻辑**：只修改 `validateSearch` 实现，不改变组件内部的逻辑
- **错误静默处理**：redirect 是静默的，不会显示错误信息给用户（符合预期）
- **可选参数处理**：保留原有的可选参数（如 `folderId`, `token` 等）的验证逻辑

## Scenario

### Scenario 1: 用户分享不带参数的预览链接

    **场景描述：**
    - **前置条件**：用户A 访问 `/mushroom/project/preview?assetId=xxx&projectId=yyy` 页面
    - **操作步骤**：
      1. 用户A 复制 URL 并移除所有参数，得到 `/mushroom/project/preview`
      2. 用户A 将不带参数的 URL 发送给用户B
      3. 用户B 点击链接访问
    - **预期结果**：
      - 页面不会崩溃
      - 自动重定向到 `/mushroom/projects`
      - 用户看到项目列表页面

### Scenario 2: 用户手动修改 URL 参数

    **场景描述：**
    - **前置条件**：用户在任何页面
    - **操作步骤**：
      1. 用户在浏览器地址栏输入 `/mushroom/project/compare`
      2. 不带任何必需参数
    - **预期结果**：
      - 页面不会崩溃
      - 自动重定向到 `/mushroom/projects`

### Scenario 3: 参数完整时正常访问

    **场景描述：**
    - **前置条件**：用户有完整的 URL 和参数
    - **操作步骤**：
      1. 用户访问 `/mushroom/project/preview?assetId=xxx&projectId=yyy`
    - **预期结果**：
      - 页面正常加载
      - 参数被正确验证和使用
      - 功能与修改前完全一致

## Checklist

- [x] C-001 `/mushroom/project/preview` 路由修改完成，参数缺失时重定向到 `/mushroom/projects`
- [x] C-002 `/mushroom/project/compare` 路由修改完成，参数缺失时重定向到 `/mushroom/projects`
- [x] C-003 `/mushroom/project/asset` 路由修改完成，参数缺失时重定向到 `/mushroom/projects`
- [x] C-004 `/mushroom/share/preview` 路由修改完成，参数缺失时重定向到 `/mushroom/projects`
- [x] C-005 `/mushroom/invite` 路由修改完成，参数缺失时重定向到 `/mushroom/projects`
- [ ] C-006 参数完整时，所有路由功能正常，与修改前行为一致
- [x] C-007 类型检查通过（`bun run precommit`）
- [x] C-008 代码格式检查通过（`bun run biome:check`）
- [ ] C-009 手动测试所有场景：带参数正常访问、不带参数重定向、部分可选参数的处理
