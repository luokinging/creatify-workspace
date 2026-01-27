# Spec: 修复 Mushroom 路由参数验证错误处理

## 变更概述

修复 `/mushroom/` 模块中多个路由在参数缺失时页面崩溃的问题。当用户访问需要特定参数的路由但缺少必需参数时，不再抛出未捕获的 `SearchParamError` 导致页面崩溃，而是优雅地重定向到 `/mushroom/projects` 页面。

**变更类型**：Bugfix

**影响范围**：前端 `/mushroom/` 模块的路由配置

**相关任务**：[T-001](./tasks.md)

## 问题背景

### 当前问题

1. **问题现象**：
   - 用户A 访问 `/mushroom/project/preview?assetId=xxx&projectId=yyy`
   - 用户A 分享 URL 给用户B，但复制的是 `/mushroom/project/preview`（不带参数）
   - 用户B 访问时页面崩溃，显示 `SearchParamError` 和 `ZodError`

2. **错误信息**：
   ```
   Uncaught SearchParamError: [
     {
       "code": "invalid_type",
       "expected": "string",
       "received": "undefined",
       "path": ["projectId"],
       "message": "Required"
     }
   ]
   ```

3. **根本原因**：
   - TanStack Router 的 `validateSearch` 使用 Zod schema 验证失败时会抛出 `SearchParamError`
   - 项目中没有全局错误处理机制来捕获这类错误
   - 错误发生在路由匹配阶段，早于组件渲染

### 影响范围

以下路由存在此问题：
- `/mushroom/project/preview` - 需要 `assetId`, `projectId`
- `/mushroom/project/compare` - 需要 `projectId`, `assetAId`, `assetBId`
- `/mushroom/project/asset` - 需要 `projectId`
- `/mushroom/share/preview` - 需要 `collectionId`, `assetId`
- `/mushroom/invite` - 需要 `code`

## 用户需求

### 功能需求

1. **不崩溃**：参数缺失时页面不应崩溃
2. **优雅降级**：自动重定向到 `/mushroom/projects` 页面
3. **保持现有功能**：参数完整时功能与修改前完全一致
4. **类型安全**：保持 TypeScript 类型检查

### 非功能需求

- **代码风格**：遵循项目现有的代码规范
- **最小改动**：只修改必要的部分
- **测试覆盖**：确保所有受影响的路由都被正确修改

## 实现方案

### 技术方案

**替换 `validateSearch` 实现**：

修改前（使用 Zod schema）：
```typescript
const previewSchema = z.object({
  assetId: z.string(),
  projectId: z.string(),
  folderId: z.string().optional(),
});

export const Route = createFileRoute('/mushroom/_layout/project/preview')({
  validateSearch: previewSchema,
  component: RouteComponent,
});
```

修改后（使用自定义函数）：
```typescript
import { redirect } from '@tanstack/react-router';

const previewSchema = z.object({
  assetId: z.string(),
  projectId: z.string(),
  folderId: z.string().optional(),
});

export const Route = createFileRoute('/mushroom/_layout/project/preview')({
  validateSearch: (search: Record<string, unknown>) => {
    const result = previewSchema.safeParse(search);
    if (!result.success) {
      throw redirect({
        to: '/mushroom/projects',
      });
    }
    return result.data;
  },
  component: RouteComponent,
});
```

### 设计考虑

1. **为什么选择这个方案**：
   - 项目已有使用 `redirect` 的先例（`/mushroom/_layout/index.tsx`）
   - 保持类型安全，使用 `zod.safeParse()` 进行验证
   - 修改范围最小，只改变 `validateSearch` 的实现方式
   - 不影响组件内部逻辑

2. **为什么不选择其他方案**：
   - **不在组件内处理**：错误发生在组件渲染前，无法在组件内捕获
   - **不使用全局错误边界**：`SearchParamError` 是路由级别的错误，全局错误边界难以针对性处理
   - **不使用 `beforeLoad`**：`validateSearch` 在 `beforeLoad` 之前执行，无法在 `beforeLoad` 中捕获

## 验收标准

### 功能验收

1. **参数缺失时**：
   - 访问不带参数的路由不会崩溃
   - 自动重定向到 `/mushroom/projects`
   - 不显示错误信息

2. **参数完整时**：
   - 页面正常加载
   - 功能与修改前完全一致

### 测试场景

| 场景 | URL | 预期行为 |
|------|-----|----------|
| 预览页面无参数 | `/mushroom/project/preview` | 重定向到 `/mushroom/projects` |
| 预览页面有参数 | `/mushroom/project/preview?assetId=xxx&projectId=yyy` | 正常显示预览页面 |
| 对比页面无参数 | `/mushroom/project/compare` | 重定向到 `/mushroom/projects` |
| 对比页面有参数 | `/mushroom/project/compare?projectId=xxx&assetAId=a&assetBId=b` | 正常显示对比页面 |
| 资产页面无参数 | `/mushroom/project/asset` | 重定向到 `/mushroom/projects` |
| 分享预览无参数 | `/mushroom/share/preview` | 重定向到 `/mushroom/projects` |
| 邀请页面无参数 | `/mushroom/invite` | 重定向到 `/mushroom/projects` |

## 相关资源

### 代码文件

- `webserver/frontend/.vite/routes/mushroom/_layout/project/preview.tsx`
- `webserver/frontend/.vite/routes/mushroom/_layout/project/compare.tsx`
- `webserver/frontend/.vite/routes/mushroom/_layout/project/asset.tsx`
- `webserver/frontend/.vite/routes/mushroom/_layout/share/preview.tsx`
- `webserver/frontend/.vite/routes/mushroom/_layout/invite.tsx`

### 文档

- TanStack Router Search Params Validation: https://tanstack.com/router/latest/docs/framework/react/guide/search-params#validation
- 项目规则：`.project-rules/frontend/workflow-bugfix.md`
