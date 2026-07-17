---
name: snow-design-mobile
description: 华润雪花 Snow Design-Mobile 移动端设计规范助手。用于生成、调整或检查华润雪花内部业务移动 APP 页面；适用于根据一句话需求、PRD、截图、MasterGo 参考或现有前端代码生成页面，也适用于检查订单详情、移动端看板、审批、列表、表单、首页工作台等 Snow Mobile 功能页面是否符合基础规范、页面模板、图标规范和按钮、徽标、表格、分页器、选项卡等组件规则。
---

# Snow Design Mobile

## 目标

使用本 skill，让 AI 生成或修改的移动端业务页面符合 Snow Design-Mobile。优先服务华润雪花内部 APP 功能页面：业务优先、信息清晰、可快速扫读、交互可预期，并与提供的 MasterGo 设计系统保持一致。

## 首先判断

先识别任务类型：

- **按需求生成页面**：把“生成一个订单详情页”这类简短需求转成页面结构、视觉方案和实现。
- **按 PRD 生成页面**：先提取页面目标、用户角色、字段、状态、操作和跳转关系，再设计页面。
- **调整已有页面**：对照 Snow Design-Mobile 规则检查当前页面，再做聚焦修改。
- **检查/评审页面**：按影响程度输出问题和具体修复建议。

然后按任务和页面类型路由，只读取当前任务需要的参考文件：

| 场景 | 必读 | 按需读取 |
| --- | --- | --- |
| 基础视觉规范 | `references/foundations.md` | - |
| 通用页面结构 | `references/page-guidelines.md`、`references/layout-rules.md` | `references/foundations.md` |
| 看板页、数据看板、月报、日报、经营分析、库存分析、销量分析、风险监控 | `references/dashboard-pattern.md`、`references/layout-rules.md` | `references/dashboard-banners.md`、`references/icon-rules.md`、`references/component-rules.md`、`references/foundations.md` |
| 首页、工作台、功能入口、导航图标、状态图标 | `references/icon-rules.md`、`references/layout-rules.md` | `references/component-rules.md`、`references/foundations.md` |
| 按钮、徽标、表格、分页器、选项卡 | `references/component-rules.md` | `references/foundations.md` |
| 页面检查或评审 | `references/checklist.md` | 对应页面类型模板和相关组件规则 |

页面类型模板是具体页面的唯一事实来源；不要在通用页面规则中重复维护某个页面类型的硬规则。后续新增列表页、详情页、表单页、首页/工作台模板时，按同样方式加入路由表。

## 工作流

1. 只有在关键信息缺失且无法合理推断时才追问。常见内部移动端业务页面可以基于业务常识先做合理假设。
2. 先梳理业务结构和布局结构，再做视觉设计：页面目的、主要用户、关键数据、主操作、次操作、空/加载/错误状态、入口和出口，以及模块顺序、承载方式、间距和对齐。
3. 选择合适的 Snow Mobile 页面模式：
   - **详情页**：订单、门店、审批、发票、拜访、库存、任务等实体记录；
   - **列表页**：可搜索、可筛选、可分组的业务集合；
   - **看板页**：KPI、趋势、排行、异常提醒和下钻；
   - **表单页**：新建、编辑、提交、审批录入；
   - **结果/状态页**：成功、失败、待处理、无权限等反馈。
4. 先应用布局规则，再应用基础规范、页面模板和组件规则。
5. 实现 UI 时，首屏要像真实 APP 功能页，不要把 APP 功能需求做成营销落地页。
6. 交付前使用检查清单。涉及代码修改时，条件允许则在本地应用中验证。

## 输出规则

- 用户或 PRD 已提供的 Snow Design-Mobile 术语要保留。
- 页面风格要偏业务、清晰、紧凑、可扫读，避免装饰化构图。
- 组件用法要一致；除非业务确实需要，不要随意创造新的视觉变体。
- 做评审时，先给高影响问题，并说明具体位置、违反点和修复方式。
