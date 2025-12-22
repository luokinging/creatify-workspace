---
description: Dialog 管理系统使用指南 - 统一的 Dialog 打开、关闭和生命周期管理机制
---

# Dialog 管理系统

## 核心功能

Dialog 管理系统提供了统一的 Dialog 打开、关闭和生命周期管理机制。核心功能包括：

- **统一管理**：所有 Dialog 通过统一 API 打开，避免手动状态管理
- **基于 Promise**：Dialog 打开返回 Promise，支持使用 `await` 等待用户操作结果
- **生命周期控制**：通过 `dialogManager.show` 打开 Dialog
- **自动清理**：Dialog 关闭时自动清理资源

## 使用约定

### 基本用法

```typescript
// Open a simple confirmation dialog
const result = await dialogManager.show(AlertDialogPreset, {
  title: "Confirm Delete",
  description: "This operation cannot be undone",
  confirmText: "Delete",
  cancelText: "Cancel",
});

// result is the value passed when user clicks confirm, if cancelled it will be rejected
```

### Dialog 组件要求

Dialog 组件必须实现以下 props：

**类型定义：**

应该使用 `WithResolve<T, R>` 类型来定义 Dialog 组件的 props，其中：
- `T` - resolve 的返回值类型
- `R` - 组件的其他 props 类型，通常是 `ModalProps & YourCustomProps`

```typescript
import type { ModalProps, WithResolve } from '@/component/ui/modal/type';

interface YourDialogProps {
  // 自定义 props
}

export function YourDialog(
  props: WithResolve<ReturnType, ModalProps & YourDialogProps>
) {
  const { onResolve, onReject, open, onOpenChange, ...rest } = props;
  // ...
}
```

**必需 props（通过 WithResolve 自动包含）：**

- `open?: boolean` - 控制 Dialog 可见性（来自 ModalProps）
- `onOpenChange?: (open: boolean) => void` - Dialog 状态改变时触发（来自 ModalProps）
- `onResolve?: (value: T) => void` - 确认时调用，传递返回值
- `onReject?: (reason: unknown) => void` - 取消时调用

### 返回值 API

`dialogManager.show()` 返回一个包含以下方法和属性的对象：

```typescript
const dialogHandler = dialogManager.show(MyDialog, props);

// Control methods
dialogHandler.close();      // Close Dialog
dialogHandler.open();        // Open Dialog
dialogHandler.hide();        // Hide Dialog (don't destroy)
dialogHandler.update(props); // Update Dialog props

```

## 预设 Dialog 组件

项目提供了符合设计标准的预设 Dialog 组件，应优先使用：

- **AlertDialogPreset** - 标准确认对话框，包含标题、描述、确认和取消按钮
- **CommonDialog** - 通用对话框，支持自定义内容和操作按钮
- **CustomDialogPreset** - 自定义对话框，支持自定义标题、图标和内容
- **ActionSheetPreset** - 移动端操作列表对话框
- **FullScreenPreset** - 全屏对话框

## 使用场景

### 场景 1：简单确认对话框

```typescript
// Using in Service or Manager
async function deleteItem(id: string) {
    await dialogManager.show(AlertDialogPreset, {
      title: "Confirm Delete",
      description: "This operation cannot be undone, are you sure you want to delete?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    // Continue execution after user clicks confirm
    await api.deleteItem(id);
}
```

### 场景 2：带返回值的 Dialog

```typescript

// Dialog component definition
interface MySelectDialogProps {
  // 自定义 props
}

export function MySelectDialog(
  props: WithResolve<string, ModalProps & MySelectDialogProps>
) {
  const { onResolve, open, onOpenChange, ...rest } = props;

  const handleConfirm = () => {
    onResolve?.('selected-value');
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {/* ... */}
      <Button onClick={handleConfirm}>Confirm</Button>
    </Modal>
  );
}

// Usage
const selectedValue = await dialogManager.show(MySelectDialog, {});
console.log(selectedValue); // 'selected-value'
```

### 场景 3：动态更新 Dialog 内容

```typescript
const dialogHandler = dialogManager.show(LoadingDialog, {
  message: "Processing...",
});

await processData();
dialogHandler.update({ message: "Processing complete!" });
setTimeout(() => dialogHandler.close(), 1000);

// 如果用户取消 Dialog，会自动抛出错误中断流程，无需手动 try-catch
```

## 约束条件

1. **不要在全局变量初始化时同步调用**：Service 初始化需要时间，可能导致 Dialog 无法正常显示
2. **优先使用预设组件**：预设组件符合设计标准，减少样式问题
3. **用户取消自动中断流程**：直接 `await dialogManager.show()` 即可，用户取消会自动抛出错误中断后续流程，无需手动 try-catch
