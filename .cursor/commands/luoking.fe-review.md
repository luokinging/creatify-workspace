---
description: Frontend code review
---

1. 检查前端仓库 (`main-web-ui`)，当前未提交的代码更改
2. 读取 `.project-rules/frontend/index.md` 规则入口文件提到的所有可读和必读文件，检查是否符合项目规范
3. 如果符合项目规范则回复符合规范，如果不符合项目规范则找出不符合规范的文件，并列出来哪些地方不符合规范，覆盖的方式输出在 .doc/review.md

review意见模版：
```markdown
# 前端代码审查报告

**审查时间：** {日期时间}
**审查范围：** main-web-ui 未提交的代码更改

## 审查结果

{符合规范 / 发现 {N} 个问题}

## 审查详情

### 符合规范的文件
{列出所有符合规范的文件路径}

### 不符合规范的文件

#### {文件路径1}
- **问题位置：** 第 {行号} 行
- **问题描述：** {具体问题说明}
- **违反规范：** `.project-rules/frontend/{规范文件名}.md` - {具体规范条目}

#### {文件路径2}
- **问题位置：** 第 {行号} 行
- **问题描述：** {具体问题说明}
- **违反规范：** `.project-rules/frontend/{规范文件名}.md` - {具体规范条目}
```

## 示例

```markdown
# 前端代码审查报告

**审查时间：** 2024-01-15 14:30:00
**审查范围：** main-web-ui 未提交的代码更改

## 审查结果

发现 2 个问题

## 审查详情

### 符合规范的文件
- main-web-ui/src/features/user/components/UserCard.tsx
- main-web-ui/src/features/user/api/userApi.ts

### 不符合规范的文件

#### main-web-ui/src/features/user/pages/UserListPage.tsx
- **问题位置：** 第 45-50 行
- **问题描述：** 在 Page 组件中直接调用 API，违反了架构设计指南中的分层原则
- **违反规范：** `.project-rules/frontend/architecture.md` - Page 组件应该通过 Manager 或 ViewController 来访问数据，不应该直接调用 API

#### main-web-ui/src/features/user/components/UserForm.tsx
- **问题位置：** 第 12 行
- **问题描述：** 组件文件命名不符合规范，应该使用 PascalCase
- **违反规范：** `.project-rules/frontend/directory-structure.md` - Component 文件应该使用 PascalCase 命名
```

注意：
* 只需要检查未提交的更改，已提交的不用管，防止改动太大
* 只需要检查未提交的改动内部逻辑即可，未提交和已提交边界处的也不用检查，保证不引入大面积修改
* 语言简洁明了
