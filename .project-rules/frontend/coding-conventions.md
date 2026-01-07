---
description: 编码规范 - 组件 Props 解构、函数签名等代码风格约定
---

# 编码规范

本文档定义了前端代码的编码规范和风格约定，确保代码风格统一和可维护性。

## 组件 Props 解构规范

### 规范要求

**所有 React 组件必须遵循以下 Props 解构方式：**

1. **函数签名：** 使用 `(props: PropsType)` 或 `(props: PropsType, ref)` 的形式
2. **函数体内：** 在函数体内使用 `const { prop1, prop2 } = props;` 进行解构

### 正确示例

```typescript
// ✅ 正确：在函数签名中使用 props，在函数体内解构
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
  showBackButton?: boolean;
}

export function MyComponent(props: MyComponentProps) {
  const { value, onChange, showBackButton = true } = props;
  // 使用解构后的变量
  return <div>{value}</div>;
}

// ✅ 正确：forwardRef 组件也遵循相同规范
const MyComponent = forwardRef<IMyComponentManager, MyComponentProps>(
  (props, ref) => {
    const { externalManager, value } = props;
    // ...
  }
);

// ✅ 正确：Dialog 组件
function YourDialog(
  props: WithResolve<ReturnType, ModalProps & YourDialogProps>
) {
  const { onResolve, onReject, open, onOpenChange, ...rest } = props;
  // ...
}
```

### 错误示例

```typescript
// ❌ 错误：在函数签名中直接解构
export function MyComponent({ value, onChange }: MyComponentProps) {
  // ...
}

// ❌ 错误：forwardRef 中在函数签名解构
const MyComponent = forwardRef<IMyComponentManager, MyComponentProps>(
  ({ externalManager }, ref) => {
    // ...
  }
);
```

### 原因说明

1. **一致性：** 所有组件（包括普通组件、forwardRef 组件、Dialog 组件）都使用统一的解构方式
2. **可读性：** 函数签名保持简洁，类型信息清晰
3. **灵活性：** 在函数体内解构可以更好地处理默认值和条件解构
4. **维护性：** 统一的代码风格便于代码审查和维护

### 特殊情况

- **默认值处理：** 在函数体内解构时可以使用默认值，如 `const { showBackButton = true } = props;`
- **剩余参数：** 可以使用 `const { prop1, ...rest } = props;` 处理剩余参数
- **条件解构：** 可以根据需要在函数体内进行条件解构

