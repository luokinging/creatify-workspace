# 归档需求文档

## 前提条件

- 读取 `.luokingspec/changes` 目录下的直接子目录，每一个子目录都是一个change，目录名为 change-id
- 用户必须指定 change-id，用户可选指定 Task 序号
- 如果用户没有指定 change-id，需要列出所有change，提醒用户选择，在确定change-id之前不能继续

## 执行流程

1. 确定要归档的变更 ID
2. 使用 `mv` 命令把 `.luokingspec/changes/<change-id>` 目录 移动到 `.luokingspec/archive/<date>.<change-id>`
3. `<date>` 是日期，依次递增，比如  `2026-01-01`