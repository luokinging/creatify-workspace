# CTA Generator Batch Mode Support

## 概述

为 CTA Generator 工具添加 Batch 模式支持，同时保留现有的 Single 模式功能。Batch 模式允许用户从多个 URL/Product 批量生成和预览 CTA HTML。

## 需求类型

Feature - 新功能模块开发

## 涉及领域

前端 - 纯前端功能，使用现有 API

## 功能描述

### 核心功能

1. **双模式支持**
   - Single 模式：与现有功能保持一致
   - Batch 模式：支持批量生成和预览

2. **路由结构**
   - 入口页：`/tool/cta-generator/test` - 模式选择
   - Batch 列表页：`/tool/cta-generator/batch` - 批量任务列表
   - Single 生成页：`/tool/cta-generator/generator` - 单个生成（现有功能）
   - 新建 Batch 页：`/tool/cta-generator/new-batch` - 创建批量任务
   - Batch 预览页：`/tool/cta-generator/batch-preview` - 批量预览

3. **主站与 iframe 通信**
   - 模式管理：PreviewOnly / Generator
   - 功能注册机制：下载、批量生成
   - 保持现有 Comlink 通信方式

### 技术要点

- 使用 MVC 模式（Manager + ViewController）
- 数据暂时使用前端 mock
- 不修改 HTML，假定 HTML 已支持所需功能
- 优先使用 `webserver/frontend/component/ui` 下的公共组件

## 代码参考点

- `webserver/frontend/feature/tool.cta-generator/page/test.tsx` [p1]
- `webserver/frontend/public/iframe/cta-generator-test.html` [p2]
- `webserver/frontend/feature/iframe-controller/creatify-host-controller.ts` [p3]
- `webserver/frontend/feature/tool.ad-delivery/page/choose-launch-new.tsx` - 入口页样式参考
- `webserver/frontend/feature/tool.creative-insight/page/competitor-tracker/index.tsx` - 列表页样式参考

## 设计参考图片

- 列表布局：`.doc/images/list-item.png`
- 新建 Batch 页：`.doc/images/new-batch.png`
- 预览页：`.doc/images/preview.png`

## 约束条件

1. 图片生成和 prefill 等使用现有实现，不新增后端 endpoint
2. 列表数据暂时前端 mock
3. 不需要修改 HTML
4. Batch 列表页面使用完全静态 mock 数据
5. 预览项数量不限制，根据用户填写的 Size 决定
6. 下载功能通过调用 iframe 注册的导出函数实现
7. CreatifyHostController 需要添加模式管理和注册机制
