---
description: Feature 目录结构规范 - api、manager、component、block、page 等目录的职责和组织方式
---

# Feature 目录结构规范 (Directory Structure)

参考 `feature/my-ads`，标准的 Feature 目录结构必须严格遵守以下定义：

## 1. `api/` (API 层)

*   **职责：** 存放纯粹的 API 请求函数定义。
*   **文件组织：**
    *   可以包含多个文件，按领域拆分（如 `campaign.api.ts`, `report.api.ts`）。
    *   **禁止**在 API 函数中包含业务逻辑（如数据转换、错误处理），只负责透传请求。
*   **类型定义：**
    *   内部可以创建 `type.ts` 用于定义请求/响应类型。
    *   如果类型定义过于复杂，应拆分为多个 `xxx-type.ts`。

## 2. `manager/` (业务逻辑层)

*   **职责：** 存放 Manager 类，是 Feature 的"大脑"。
*   **内容：** 包含状态管理 (State)、数据获取 (Fetching)、业务规则 (Business Logic)。
*   **形式：** 必须是 Class 形式，实现 `bootstrap` 和 `dispose` 方法。

## 3. `context/` (上下文层)

*   **职责：** 存放当前 Feature 范围内的 React Context。
*   **内容：** 例如 ViewController 的 Provider，或者需要跨组件共享但不需要 Manager 那么重的数据。

## 4. `component/` (纯组件层)

*   **职责：** 存放**可复用**的、**纯粹**的 UI 组件。
*   **原则：**
    *   **无副作用：** 不应该包含 API 调用或复杂的 `useEffect`。
    *   **Props 驱动：** 数据完全由 Props 传入。
    *   **通用性：** 应当尽量与具体业务解耦，方便在 Feature 内部不同地方复用。

## 5. `block/` (业务组件层)

*   **职责：** 存放**带副作用**的、**业务相关**的可复用组件。
*   **特点：**
    *   一定是可复用的，不可复用的放在 对应page目录下
    *   可以依赖全局状态、Context 或 Manager。
    *   通常作为列表项 (Item) 或特定业务区块。
    *   **例子：** 一个 `CampaignCard`，它可能需要从 Context 获取当前的 `ViewController` 来处理点击跳转，或者订阅 Manager 的状态来显示实时数据。
    *   **区别：** 与 `component` 的区别在于 `block` 是"聪明"的，知道业务上下文；而 `component` 是"笨"的，只知道 Props。

## 6. `page/` (页面层)

*   **职责：** 存放页面入口组件。
*   **组织方式：**
    *   **简单页面：** 直接放 `my-page.tsx`。
    *   **复杂页面：** 创建子目录（如 `page/dashboard/`），并在其中创建 `index.tsx` 作为入口。
    *   **拆分：** 如果页面复杂，应将页面的不同部分（Section）拆分为独立组件放在同一目录下（如 `page/dashboard/header-section.tsx`），由 `index.tsx` 组装。

## 7. `type/` (类型定义)

*   **职责：** 存放 Feature 级别的通用类型定义。

## 8. `util/` (工具函数)

*   **职责：** 存放纯函数工具类。

