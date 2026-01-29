# CTA批量生成前端实现

## 需求背景

当前CTA Generator只支持单个产品的CTA生成，需要扩展支持批量生成功能，允许用户一次性输入多个产品URL和对应的变体数量，后端并行处理生成所有CTA，前端提供完整的用户界面和交互体验。

## 需求概述

### 功能范围

实现CTA批量生成的前端界面和交互逻辑，包括：

1. **模式选择入口** - 用户可以选择Single（单个）或Batch（批量）模式
2. **批量任务创建** - 支持输入最多5个URL，每个URL可指定1-10个变体数量
3. **任务列表管理** - 展示所有批量任务，支持查看任务状态、进度和预览
4. **任务预览** - 查看批量任务中所有生成的CTA预览，支持Edit和View操作
5. **实时状态更新** - 自动轮询后端API获取任务和CTA的实时状态

### UI参考

参考文档中的UI设计稿，要求90%以上的一致性：
- `.doc/reference/mode-entry.tsx` - 入口页参考
- `.doc/reference/model-card.tsx` - 模式卡片参考
- `.doc/reference/new-task.tsx` - 创建页参考
- `.doc/reference/cta-task-list.tsx` - 列表页参考
- `.doc/reference/cta-task-item.tsx` - 列表项参考
- `.doc/reference/preview.tsx` - 预览页参考

### 技术约束

1. **不允许修改现有线上代码** - `webserver/frontend/feature/tool.cta-generator/page/prod.tsx`及相关文件
2. **使用后端API** - 对接已实现的后端批量CTA API（`CTAGenerationJob`、`CTAInfo`）
3. **移除Mock数据** - 完全移除前端Mock数据结构，使用后端定义的数据结构
4. **iframe通信** - 使用Comlink和CreatifyHostController进行iframe-host通信

## 页面流程

```
入口页 (/tool/cta-generator/test) - ✅ 已实现，无需修改
  ├─ Single → 跳转到现有的单个生成页面
  └─ Batch → 跳转到列表页

列表页 (/tool/cta-generator/cta-list) - 需要实现
  ├─ Create New Batch → 创建页
  └─ View All → 预览页

创建页 (/tool/cta-generator/new-cta) - 需要实现
  ├─ 填写URL和变体数量
  ├─ 点击Generate
  └─ 成功后跳转到列表页

预览页 (/tool/cta-generator/cta-preview) - 需要实现
  ├─ 显示所有CTA预览
  ├─ View → 查看CTA详情
  └─ Edit → 编辑CTA内容
```

## 数据模型（对接后端）

### CTAGenerationJob
```typescript
{
  id: string;
  name: string;  // 格式: [Username]-CTA-[yyyy-mm-dd hh:ss]
  input: Array<{url: string, variant: number}>;
  cta_infos: CTAInfo[];
  success_count: number;
  failed_count: number;
  total_count: number;
  is_completed: boolean;
  user: string;
  workspace: string;
  created_at: string;
  updated_at: string;
}
```

### CTAInfo
```typescript
{
  id: string;
  job: string;
  url: string;
  product: {
    id: string;
    name: string;
    thumbnail: string;
    // ... 其他product字段
  } | null;
  suggestion: {
    background_image_url: string;  // AI生成的背景图片URL（通过image-to-image生成）
    background_prompt: string;
    headline: string;
    headline_color: string;
    subtitle: string;
    subtitle_color: string;
    cta_button_text: string;
    cta_button_color: string;
    cta_text_color: string;
    cta_button_link: string;
    social_proof: {enabled: boolean, text: string, position: string} | null;
    discount_badge: {enabled: boolean, text: string, position: string} | null;
    special_offer_timer: {enabled: boolean, text: string, position: string} | null;
    top_banner: {enabled: boolean, text: string, position: string} | null;
    visual_vibe: string;
    logo_url?: string;
  };
  status: 'pending' | 'analyzing' | 'generating_image' | 'generating_suggestion' | 'done' | 'failed';
  retry_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
```

## API接口

### 创建批量任务
```
POST /tools/llm_editor/cta-batch/jobs/
Request: {input: [{url: string, variant: number}]}
Response: {task_id: string, ...CTAGenerationJob}
```

### 获取任务列表
```
GET /tools/llm_editor/cta-batch/jobs/
Response: {count: number, next: string, previous: string, results: CTAGenerationJob[]}
```

### 获取单个任务
```
GET /tools/llm_editor/cta-batch/jobs/{id}/
Response: CTAGenerationJob
```

### 获取任务的所有CTAInfo
```
GET /tools/llm_editor/cta-batch/jobs/{id}/cta_infos/
Response: CTAInfo[]
```

### 更新CTAInfo的suggestion
```
PATCH /tools/llm_editor/cta-batch/cta-infos/{id}/
Request: {suggestion: {...}}
Response: CTAInfo
```

### 删除任务
```
DELETE /tools/llm_editor/cta-batch/jobs/{id}/
Response: 204 No Content
```

## 核心组件设计

### CTAPreview组件
- 创建全新的组件，保留现有的`CtaPreviewOnlyIframe`组件不变
- 使用iframe + Comlink + CreatifyHostController通信
- 显示状态信息（pending/analyzing/generating_image/generating_suggestion/done/failed）
- done状态时显示Edit和View按钮
- 支持通过props传入controller实例

### Edit/View Dialog
- 基于BasicDialog实现
- View模式：9:16的CTA预览组件居中显示
- Edit模式：iframe铺满，支持实时编辑
- Edit时通过hostController.updateSuggestion通知更新，前端使用500ms debounce同步到后端API

### iframe通信规则
- 统一使用事件注册方式
- iframe注册：`hostController.registerXxx(callback)`
- host调用：`controller.callXxx({...})`
- iframe调用host：`hostController.xxx`
- 一个CreatifyHostController实例对应一个iframe

## 用户体验设计

### 自动轮询
- 列表页和预览页都实现自动轮询机制
- 轮询间隔：2-3秒
- 当任务完成（is_completed=true）时停止轮询
- 页面卸载时停止轮询

### 错误处理
- 失败的CTA显示错误状态
- 显示错误信息（error_message）
- 不影响其他成功的CTA显示

### 加载状态
- 创建任务时显示loading状态
- 列表加载时显示loading
- 预览加载时显示loading
- 每个CTA预览显示对应的状态

## 路由设计

- `/tool/cta-generator/test` - 入口页（模式选择）
- `/tool/cta-generator/cta-list` - 列表页
- `/tool/cta-generator/new-cta` - 创建页
- `/tool/cta-generator/cta-preview` - 预览页（通过query参数传递jobId）

## 代码位置

### 前端Code Point
- `webserver/frontend/feature/tool.cta-generator/` - 主要功能代码
- `webserver/frontend/feature/iframe-controller/` - iframe控制器
- `webserver/frontend/public/iframe/cta-generator-test.html` - iframe页面

### 需要修改的文件
- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` - ✅ 已实现（模式选择页），无需修改
- `webserver/frontend/feature/tool.cta-generator/page/new-batch.tsx` - 更新为创建页
- `webserver/frontend/feature/tool.cta-generator/page/batch/index.tsx` - 更新为列表页
- `webserver/frontend/feature/tool.cta-generator/page/batch-preview.tsx` - 更新为预览页

### 新增文件
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview.tsx` - 新的CTA预览组件（不修改现有组件）
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-dialog.tsx` - Edit/View对话框组件
- `webserver/frontend/public/iframe/cta-generator-test.html` - 新的iframe页面

### 保持不变的文件
- `webserver/frontend/feature/tool.cta-generator/component/cta-preview-only-iframe.tsx` - 现有预览组件（保持不变）

### 需要更新的文件
- `webserver/frontend/feature/tool.cta-generator/manager/batch-list-view-controller.ts` - 移除Mock数据，对接后端API
- `webserver/frontend/feature/tool.cta-generator/context/batch-list-view-controller-context.tsx` - 更新类型定义
- `webserver/frontend/feature/tool.cta-generator/api/index.ts` - 添加批量任务API
- `webserver/frontend/feature/tool.cta-generator/type.ts` - 添加后端数据类型定义
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` - 扩展updateSuggestion方法

## 技术要点

1. **状态管理** - 使用现有的MVC架构（ViewController模式）
2. **路由配置** - 使用TanStack Router
3. **iframe通信** - 使用Comlink + CreatifyHostController
4. **实时更新** - 使用轮询机制（后端已实现异步任务）
5. **类型安全** - 使用TypeScript严格类型定义
6. **错误处理** - 统一的错误处理和用户提示
7. **性能优化** - 使用虚拟化列表、懒加载等优化手段
