---
description: 请求相关注意事项 - createAutoKeyMiniClient、PaginatedQueryManager、useAutoKeyQuery 等 API 的使用注意事项和常见陷阱
---

# 请求相关注意事项

本文档说明在使用请求相关 API 时需要注意的重要事项，帮助避免常见错误和性能问题。

## ⚠️ 核心原则：所有 AutoKey 相关 API 必须使用稳定函数引用

**重要**：所有基于 AutoKeyQuery 的 API（包括 `createAutoKeyMiniClient`、`PaginatedQueryManager`、`useAutoKeyQuery`、`useAutoKeyPaginatedInfiniteQuery` 等）都**必须使用稳定的函数引用**作为 `queryFn` 或 `fn` 参数。

### 为什么需要稳定引用？

AutoKeyQuery 系统依赖函数引用来生成稳定的 QueryKey，用于标识查询、管理缓存和避免缓存冲突。如果函数引用发生变化，会导致缓存失效、不必要的重新请求和性能问题。

### 什么是稳定函数引用？

- ✅ 全局定义或静态导入的函数
- ✅ 在模块级别定义的函数
- ❌ **不是** 类中使用箭头函数定义的属性方法
- ❌ **不是**在回调、方法内部动态创建的函数
- ❌ **不是**每次调用都返回新函数引用的方法

## createAutoKeyMiniClient

### ⚠️ 函数引用必须稳定

`fn` 参数必须是稳定的函数引用。如果函数引用发生变化，Query 缓存会被失效，可能导致意外行为。

#### ❌ 错误示例

```typescript
class MyManager {
  private readonly userDataClient = createAutoKeyMiniQueryClient(() => ({
    // ❌ 错误：每次调用都会创建新的函数引用
    fn: async (userId: string) => {
      return await fetchUserData(userId);
    },
    fnParams: [this.userId],
  }));
}
```

#### ✅ 正确示例

```typescript
import { fetchUserData } from '@/api/user';

class MyManager {
  private readonly userDataClient = createAutoKeyMiniQueryClient(() => ({
    fn: fetchUserData, // ✅ 稳定的函数引用
    fnParams: [this.userId],
  }));
}
```

## PaginatedQueryManager

### ⚠️ queryFn 必须是稳定的函数引用

`PaginatedQueryManager` 的构造函数参数 `queryFn` 必须是稳定的函数引用。

#### ❌ 错误示例

```typescript
class MyViewController {
  // ❌ 错误：每次实例化都会创建新的函数引用
  private readonly paginatedManager = new PaginatedQueryManager(
    async (page: number) => {
      return await fetchPaginatedData(page);
    }
  );
}
```

#### ✅ 正确示例

```typescript
import { fetchPaginatedData } from '@/api/data';

class MyViewController {
  private readonly paginatedManager = new PaginatedQueryManager(
    fetchPaginatedData // ✅ 稳定的函数引用
  );
}
```

### ⚠️ 不要在组件中直接创建实例

`PaginatedQueryManager` 应该在 Manager 或 ViewController 中创建，而不是在 React 组件中直接创建，以避免每次渲染都创建新实例。

## useAutoKeyQuery

### ⚠️ queryFn 必须是稳定的函数引用

`useAutoKeyQuery` 的 `queryFn` 参数必须是稳定的函数引用。

#### ❌ 错误示例

```typescript
function UserProfile({ userId }: { userId: string }) {
  // ❌ 错误：每次渲染都会创建新的函数引用
  const { data } = useAutoKeyQuery({
    queryFn: async () => {
      return await fetchUserData(userId);
    },
    fnParams: [],
  });
}
```

#### ✅ 正确示例

```typescript
import { fetchUserData } from '@/api/user';

function UserProfile({ userId }: { userId: string }) {
  const { data } = useAutoKeyQuery({
    queryFn: fetchUserData, // ✅ 稳定的函数引用
    fnParams: [userId],
  });
}
```

## 通用注意事项

### 1. ⚠️ 函数引用稳定性（核心要求）

**这是所有 AutoKey 相关 API 的核心要求**：所有基于 AutoKeyQuery 的 API 都**必须使用稳定的函数引用**。

确保：
- ✅ 使用全局定义或静态导入的函数
- ❌ 避免在回调中创建新函数
- ❌ 避免使用普通类方法作为 queryFn（除非使用 `.bind()` 或箭头函数属性）
- ❌ 避免在方法内部动态创建函数引用

### 2. 缓存管理

AutoKeyQuery 基于 TanStack Query，会自动管理缓存。QueryKey 由函数引用和参数自动生成，相同函数引用和参数会共享缓存。**函数引用变化会导致缓存失效**（这就是为什么必须使用稳定函数引用的原因）。

