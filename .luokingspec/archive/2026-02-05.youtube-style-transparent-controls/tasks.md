# T-001 实现全屏控制面板 YouTube 风格透明效果

## 需求描述

为 `/mushroom/project/preview` 路由的视频和音频预览页面实现 YouTube 风格的全屏控制面板透明效果。

**需求类型**：Enhancement

**涉及领域**：前端

### 功能概述

在全屏模式下，将控制面板从当前深色背景（`bg-bg-2/90`）加圆角阴影的样式，改为 YouTube 风格的透明效果：

1. 移除外层控制面板的背景色、圆角和阴影
2. 为每个控制组添加独立的半透明圆角背景
3. 进度条保持无背景

### 涉及的控制组

#### 视频预览 (video-preview.tsx)
- **缩放控制组**：缩小按钮、百分比显示、放大按钮
- **播放控制组**：播放/暂停按钮、倍速选择、音量控制
- **时间显示组**：当前时间 / 总时长
- **右侧按钮组**：设置按钮、全屏按钮

#### 音频预览 (audio-preview.tsx)
- **播放控制组**：播放/暂停按钮、倍速选择、音量控制
- **时间显示组**：当前时间 / 总时长
- **右侧按钮组**：设置按钮、全屏按钮

### 半透明背景样式规范

```tsx
// 控制组半透明背景样式
className="bg-black/50 backdrop-blur-sm rounded-lg"
```

## 相关指引

**前端规则:**
- `.project-rules/frontend/architecture.md` - 了解组件结构和样式规范
- `.project-rules/frontend/programming-conventions.md` - 了解代码风格和命名规范

**前端Code Point:**
- `webserver/frontend/feature/mushroom/component/preview/video-preview.tsx` - 视频预览组件，第83-136行的 `renderControls` 函数
- `webserver/frontend/feature/mushroom/component/preview/audio-preview.tsx` - 音频预览组件，第66-107行的 `renderControls` 函数
- `webserver/frontend/feature/mushroom/component/preview/asset-player-controls.tsx` - 播放控制组件

**前端路由:**
- `/mushroom/project/preview` - 资产预览页面路由

## 注意点

- 只修改全屏模式（`floating=true`）的样式，非全屏模式保持不变
- 进度条不添加半透明背景
- 控制面板的显示/隐藏逻辑（自动隐藏、鼠标悬停显示）不改变
- 确保控制组之间有适当的间距（使用 `gap-2` 或 `gap-3`）
- 为各控制组添加适当的内边距（`px-3 py-2`）确保内容不被半透明背景裁剪

## Scenario

### Scenario 1: 用户在全屏模式下观看视频预览

    **场景描述：**
    - **前置条件**：用户在 `/mushroom/project/preview` 页面预览视频资产
    - **操作步骤**：
      1. 用户点击全屏按钮进入全屏模式
      2. 移动鼠标，控制面板自动显示
      3. 观察控制面板样式
    - **预期结果**：
      - 控制面板外层没有深色背景和圆角阴影
      - 缩放控制组有独立的半透明圆角背景
      - 播放控制组（播放、倍速、音量）有独立的半透明圆角背景
      - 时间显示有独立的半透明圆角背景
      - 右侧按钮组（设置、全屏）有独立的半透明圆角背景
      - 进度条没有背景

### Scenario 2: 用户在全屏模式下收听音频预览

    **场景描述：**
    - **前置条件**：用户在 `/mushroom/project/preview` 页面预览音频资产
    - **操作步骤**：
      1. 用户点击全屏按钮进入全屏模式
      2. 移动鼠标，控制面板自动显示
      3. 观察控制面板样式
    - **预期结果**：
      - 控制面板外层没有深色背景和圆角阴影
      - 播放控制组（播放、倍速、音量）有独立的半透明圆角背景
      - 时间显示有独立的半透明圆角背景
      - 右侧按钮组（全屏）有独立的半透明圆角背景
      - 进度条没有背景

### Scenario 3: 用户退出全屏模式

    **场景描述：**
    - **前置条件**：用户在全屏模式下观看视频
    - **操作步骤**：
      1. 用户点击退出全屏按钮
      2. 观察控制面板样式
    - **预期结果**：
      - 控制面板恢复为原有的深色背景样式
      - 样式与修改前一致，无变化

## Checklist

- [ ] C-001 修改 `asset-player-controls.tsx`，添加 `floating` prop，为各控制组添加包裹元素和条件半透明背景样式
- [ ] C-002 修改 `video-preview.tsx` 的 `renderControls` 函数，移除外层背景样式，为缩放控制组添加半透明背景，传递 `floating` prop
- [ ] C-003 修改 `audio-preview.tsx` 的 `renderControls` 函数，移除外层背景样式，传递 `floating` prop
- [ ] C-004 测试视频预览全屏模式的控制面板样式，确保各控制组有独立的半透明圆角背景
- [ ] C-005 测试音频预览全屏模式的控制面板样式，确保各控制组有独立的半透明圆角背景
- [ ] C-006 测试非全屏模式的控制面板样式，确保样式与修改前保持一致
- [ ] C-007 测试控制面板的显示/隐藏逻辑，确保在全屏模式下鼠标悬停显示、3秒后自动隐藏
- [ ] C-008 测试不同亮度和对比度的视频内容，确保控制面板始终清晰可读
