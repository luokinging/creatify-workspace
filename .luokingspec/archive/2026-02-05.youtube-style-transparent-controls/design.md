## Context

当前 `/mushroom/project/preview` 路由的视频和音频预览页面，在全屏模式下使用以下控制面板样式：

```tsx
// 视频预览 - video-preview.tsx (第83-136行)
const renderControls = (floating = false) => (
  <div className={cn('flex shrink-0 flex-col overflow-hidden bg-bg-2', floating && 'rounded-lg shadow-xl')}>
    {/* 缩放控制区 */}
    <div className={cn('flex h-10 ...', floating ? 'bg-bg-2/90 backdrop-blur-sm' : 'bg-bg-2')}>
      ...
    </div>
    {/* 播放控制区 */}
    <AssetPlayerControls className={floating ? 'bg-bg-2/90 backdrop-blur-sm' : ''} ... />
  </div>
);
```

用户希望改为 YouTube 风格的透明效果，移除外层深色背景，为每个控制组添加独立的半透明背景。

## Goals / Non-Goals

### Goals

- 实现全屏模式下控制面板的透明效果
- 为每个控制组添加独立的半透明圆角背景
- 保持非全屏模式的控制面板样式不变
- 保持控制面板的交互行为（自动隐藏、显示）不变

### Non-Goals

- 修改非全屏模式的控制面板样式
- 修改控制面板的显示/隐藏逻辑
- 修改其他页面的控制面板样式
- 修改控制面板的功能和交互行为

## Decisions

### 1. 半透明背景样式

**决策**：使用 `bg-black/50 backdrop-blur-sm rounded-lg` 作为控制组的半透明背景样式

**理由**：
- `bg-black/50` 提供 50% 黑色半透明背景，既能保证文字可读性，又不会过度遮挡视频内容
- `backdrop-blur-sm` 提供轻微的毛玻璃效果，增强视觉层次感
- `rounded-lg` 提供与整体设计一致的圆角效果

**考虑的替代方案**：
- 纯透明背景：被拒绝，因为会导致控制元素难以辨识，影响可用性
- 更高透明度的背景（如 `bg-black/30`）：被拒绝，因为可能在亮色视频内容上难以看清
- 白色半透明背景（`bg-white/10`）：被拒绝，因为与整体深色主题不一致

### 2. 组件结构调整

**决策**：在 `AssetPlayerControls` 组件中为各控制组添加包裹元素

**理由**：
- 保持组件的职责单一，`AssetPlayerControls` 负责渲染播放控制相关 UI
- 通过 props 传递 `floating` 参数来控制是否应用半透明样式
- 最小化对现有代码的修改

**考虑的替代方案**：
- 在父组件中重构整个控制面板结构：被拒绝，因为会增加代码复杂度，不利于维护
- 创建新的组件来包裹控制组：被拒绝，因为当前改动规模较小，不需要新增组件

### 3. 进度条样式

**决策**：进度条不添加半透明背景，保持原样

**理由**：
- 进度条本身已经具有足够的视觉识别度
- 用户明确指出进度条不需要增加半透明背景
- 参考 YouTube 的设计，进度条也是独立于控制组背景的

## Data Model

无需修改数据模型。

## Component Structure

### 修改的文件

```
webserver/frontend/feature/mushroom/component/preview/
├── video-preview.tsx          # 修改 renderControls 函数
├── audio-preview.tsx          # 修改 renderControls 函数
└── asset-player-controls.tsx  # 为控制组添加包裹元素和半透明背景
```

### 组件结构变化

#### video-preview.tsx

**变化前**：
```tsx
<div className={cn('flex shrink-0 flex-col overflow-hidden bg-bg-2', floating && 'rounded-lg shadow-xl')}>
  <div className={cn('...', floating ? 'bg-bg-2/90 backdrop-blur-sm' : 'bg-bg-2')}>
    {/* 缩放控制 */}
  </div>
  <AssetPlayerControls className={floating ? 'bg-bg-2/90 backdrop-blur-sm' : ''} ... />
</div>
```

**变化后**：
```tsx
<div className={cn('flex shrink-0 flex-col overflow-hidden p-4 gap-3')}>
  <div className={cn('...', 'bg-black/50 backdrop-blur-sm rounded-lg')}>
    {/* 缩放控制 */}
  </div>
  <AssetPlayerControls floating={floating} ... />
</div>
```

#### asset-player-controls.tsx

**变化前**：
```tsx
<div className={cn('flex flex-col bg-bg-2', className)}>
  <div className="border-line-1 border-t px-4 pt-2">
    {/* 进度条 */}
  </div>
  <div className="flex h-12 shrink-0 items-center justify-between px-4">
    <div className="flex items-center gap-3">
      {/* 播放/暂停、倍速、音量 */}
    </div>
    <div className="flex items-center">
      {/* 时间 */}
    </div>
    <div className="flex items-center gap-2">
      {/* 设置、全屏 */}
    </div>
  </div>
</div>
```

**变化后**：
```tsx
<div className={cn('flex flex-col', className)}>
  <div className="px-2 pt-2">
    {/* 进度条 - 无背景 */}
  </div>
  <div className="flex h-12 shrink-0 items-center justify-between gap-2 px-2">
    <div className={cn('flex items-center gap-3 px-3 py-2', floating && 'bg-black/50 backdrop-blur-sm rounded-lg')}>
      {/* 播放/暂停、倍速、音量 */}
    </div>
    <div className={cn('flex items-center px-3 py-2', floating && 'bg-black/50 backdrop-blur-sm rounded-lg')}>
      {/* 时间 */}
    </div>
    <div className={cn('flex items-center gap-2 px-3 py-2', floating && 'bg-black/50 backdrop-blur-sm rounded-lg')}>
      {/* 设置、全屏 */}
    </div>
  </div>
</div>
```

## Architecture Patterns

- **组件组合模式**：通过为控制组添加包裹元素来实现样式分组，而不是创建新的组件
- **条件样式**：使用 `floating` 参数来控制是否应用半透明样式，保持非全屏模式的原有样式

## Risks / Trade-offs

### Risk: 视觉可读性

**风险**：半透明背景可能在某些视频内容上难以看清控制元素

**缓解措施**：
- 使用 `backdrop-blur-sm` 增强背景对比度
- 确保 `bg-black/50` 的透明度足够低，保证文字可读性
- 测试不同亮度/对比度的视频内容，确保控制面板始终可用

### Trade-off: 代码复杂度

**决策**：在现有组件中添加包裹元素，而不是创建新组件

**影响**：
- 优点：最小化代码修改，保持组件结构简单
- 缺点：组件内的 JSX 结构稍显复杂
- 权衡：对于这种简单的样式调整，不需要引入新的抽象层

## Open Questions

无开放问题。

## Migration Plan

### Steps

1. **修改 `asset-player-controls.tsx`**
   - 添加 `floating` prop
   - 为各控制组添加包裹元素和条件样式
   - 移除外层背景色（仅在 floating 模式下）

2. **修改 `video-preview.tsx`**
   - 移除 `renderControls` 中外层 `div` 的背景、圆角、阴影样式
   - 为缩放控制组添加半透明背景样式
   - 传递 `floating` prop 给 `AssetPlayerControls`

3. **修改 `audio-preview.tsx`**
   - 移除 `renderControls` 中外层 `div` 的背景、圆角、阴影样式
   - 传递 `floating` prop 给 `AssetPlayerControls`

4. **测试**
   - 测试视频预览全屏模式的控制面板样式
   - 测试音频预览全屏模式的控制面板样式
   - 确保非全屏模式的样式不受影响
   - 测试控制面板的显示/隐藏逻辑正常工作

### Rollback

- **代码回滚**：通过 Git 回滚到之前的版本
- **无数据库变更**：无需数据库回滚
- **无 API 变更**：无需后端回滚
- **功能降级**：如果样式出现问题，可以通过 CSS 类名快速回滚到原有样式

## References

- `.project-rules/frontend/architecture.md` - 前端架构规范
- `webserver/frontend/feature/mushroom/component/preview/video-preview.tsx` - 视频预览组件
- `webserver/frontend/feature/mushroom/component/preview/audio-preview.tsx` - 音频预览组件
- `webserver/frontend/feature/mushroom/component/preview/asset-player-controls.tsx` - 播放控制组件
