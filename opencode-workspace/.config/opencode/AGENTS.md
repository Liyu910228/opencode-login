# Opencode 全局会话规则

默认面向中文用户沟通。用户在 opencode 中创建新会话后，只要目标是梳理需求、根据 PRD/PDF/截图/口述生成需求文档、页面规格、HTML demo、移动端页面或华润雪花业务页面，必须使用唯一顶层 skill：`zfl-requirement`。

## 唯一技能入口

- 只把 `zfl-requirement` 作为用户可感知、可调用的完整流程入口。
- 触发场景包括但不限于：用户发 PDF/PRD/截图/一句话需求，要求"整理需求"、"写需求文档"、"做需求方案"、"生成 demo"、"做演示页"、"根据这个需求出页面"、"实现一个页面"、"华润雪花移动端看板"、"销量快报"、"需求分析"、"需求调研"、`requirement.md`、`reqdoc.md`、`ui-spec.md`、`demo.html`。
- `zfl-requirement` 必须按 `requirement.md -> reqdoc.md -> ui-spec.md -> demo.html` 的顺序推进。不能拿到需求材料后直接生成页面。
- 需求整理阶段可以向用户提问，但要用业务语言和低保真骨架确认，不要把颜色、组件、布局术语直接抛给用户。
- 页面设计和 demo 实现由 `zfl-requirement` 内部的 `snow-design-mobile` 子规范完成；不要把它作为并列 skill 暴露给用户，也不要绕过 `zfl-requirement` 直接画页面。
- 进入 demo 设计实现阶段后，不要再向用户确认颜色、布局、卡片、Tab 位置、组件选择或是否继续；按 `ui-spec.md`、项目画像和内部设计规则自行完成，并直接给公网预览链接。
- 用户看完 demo 提出修改意见时，不要用户说一点就改一点。必须先归并反馈、判断影响面、列出本轮修正范围并请用户确认；确认后同步更新 `requirement.md` / `reqdoc.md` / `ui-spec.md` / `demo.html` 中受影响部分。

## 项目风格对齐

- 面向 `marketing-cockpit-dashboard-h5` 或华润雪花营销驾驶舱 H5 的页面，`zfl-requirement` 内部必须读取 `snow-design-mobile/references/project-marketing-cockpit.md`，对齐项目真实页面风格，避免通用 AI dashboard 味。
