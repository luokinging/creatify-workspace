---
description: AI Agent 规则文档索引 - 列出必须阅读的文档和可选文档
---

## 测试环境

### 开发环境

* **虚拟环境**: 使用 Anaconda 的 base 环境（conda base）
* **测试项目路径**: `playwright-test`
* **测试框架**: Playwright、pytest、pytest-playwright
* **设计模式**: Page Object Model (POM)

### 认证配置

测试时需要注入以下 cookie：

* `access-token`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzY2ODY3ODM2LCJpYXQiOjE3NjY0ODg0MjMsImp0aSI6Ijg2NzY5N2M4ZGI3NzQ3MjQ4MGQ4ODllNjM3NWNjYzcyIiwidXNlcl9pZCI6NjE5MDB9.3eB5l4d2mh5U9QPcVl6B_YViN9hROG-0bDRTNWAEiF8`
* `refresh-token`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc2NzA5MzIyMywiaWF0IjoxNzY2NDg4NDIzLCJqdGkiOiIzZDY3ZWUyZDg1MDI0YmFlOTNjNjYwNWFjYjA5OWQzZSIsInVzZXJfaWQiOjYxOTAwfQ.Q93QQj-h-AQLkZ2iNmQkm7nQXv2gqPmkHXIH9CBYYGw`
* `app-env`: `production`
* `server-url`: `https://api.creatify.ai`
* `posthog-flag`: `1`

## 测试思路

### 核心策略

采用 **源代码侵入 + Playwright 混合测试** 的方式，**源代码侵入作为主要原则**：

* **主要原则**: 尽可能从源代码入手做测试，这种方式**稳健且方便**
  - 通过源代码侵入可以直接访问组件内部状态和方法，避免依赖脆弱的 DOM 选择器
  - 测试代码与源代码紧密结合，维护成本低，稳定性高
  - 可以充分利用 React 组件特性，如 ref、useEffect 等，实现精确的元素定位和状态验证
* **测试入口**: 从前端作为测试入口
* **元素定位**: 优先使用源代码侵入方式，Playwright 定位器仅作为备选
* **测试控制器**: 通过源代码侵入实现元素定位和操作
* **Playwright 作用**: 
  - 浏览器环境控制（网络请求、页面导航等）
  - 测试断言和验证
  - 测试框架相关功能

### 元素定位优先级

**优先级顺序（从高到低）：**

1. **React + DOM + 现有组件支持的功能** - 优先使用
2. **Playwright 定位器** - 作为备选方案

在验证部分，可以直接在 Playwright 脚本中从 `window` 获取信息进行测试和验证。

### 功能测试注意事项

* **接口验证**: 验证接口是否成功发出且正确响应
* **Mock 请求**: 对于和接口相关的功能，如果有不同 case 的处理，可能需要编写 mock 请求
* **代码查找**: 查找现有代码的功能，然后再生成测试

## 测试流程

### 基本要求

* 测试代码写在 `playwright-test` 目录
* Python 环境使用 conda 的 base 环境
* 测试代码应该简洁、健壮且正确
* 使用 Page Object Model (POM) 设计模式

### 测试编写步骤

1. **查找现有功能**: 先查找现有代码的功能，理解实现逻辑
2. **创建测试控制器**: 在源代码合适位置创建测试控制器
3. **挂载到 window**: 将测试控制器挂载到 `window` 对象
4. **绑定元素**: 使用 ref 等方式绑定需要测试的元素
5. **编写测试用例**: 在 `playwright-test` 目录编写 Playwright 测试用例
6. **清理测试代码**: 测试完成后清除测试相关的侵入代码

## 示例

### 测试控制器创建和挂载

在源代码中创建测试控制器：

```typescript
export const xxxTestController = new XxxTestController()
```

挂载到 window：

```typescript
(window as any).xxxTestController = xxxTestController
```

### 元素定位示例

使用 ref 方式绑定元素：

```typescript
<Button ref={elem => (window as any).xxxTestController.setXxxButton(elem)}>
  xxx
</Button>
```

**注意**: 尽可能利用一切 React 或组件特性，用于验证元素是否出现、选中等特殊行为。

### 测试操作示例

**点击操作**:

```typescript
xxxTestController.xxxButton.click() // 或 doubleClick() 等
```

**元素挂载状态验证**:

```typescript
useEffect(() => {
  (window as any).isXxxMount = true
  return () => {
    (window as any).isXxxMount = false
  }
}, [])
```

**日志记录**:

```typescript
xxxTestController.log(xxxx)
```

测试控制器可以添加 log 用于记录操作，可以用于 debug 来读取也可以用于流程验证。
