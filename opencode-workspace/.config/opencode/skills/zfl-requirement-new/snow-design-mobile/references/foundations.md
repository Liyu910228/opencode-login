# 基础规范

## 字体

按平台调用系统默认字体。

- iOS：系统默认字体，中文字体规范页展示为 PingFang SC / 苹方-简。
- Android：系统默认字体。
- 中文字重：Regular、Medium、Bold。
- 做网页原型或检查生成 UI 时，可使用 `PingFang SC` 作为回退字体。

### 字号阶梯

| Token | 字号 | 行高 | 字重 | 使用场景 |
| --- | ---: | ---: | ---: | --- |
| 24/Regular | 24 | 140% | 400 | 特大标题 |
| 24/Medium | 24 | 140% | 500 | 需要强调的特大标题 |
| 20/Regular | 20 | 24 | 400 | 正文标题、强调文字、Tab/Tool 标题栏 |
| 20/Medium | 20 | 24 | 500 | 规范页中的分组/表头标题 |
| 18/Regular | 18 | 22 或 27 | 400 | 重要标题 |
| 18/Medium | 18 | 22 | 500 | 重要标题强调 |
| 17/Regular | 17 | 22 或 24 | 400 | 一级标题、导航栏标题 |
| 17/Bold | 17 | 22 | 600 | 一级标题强强调 |
| 16/Regular | 16 | 22 | 400 | 正常按钮、操作类文字 |
| 16/Medium | 16 | 22 | 500 | 大（常规）/特大按钮文字 |
| 16/Bold | 16 | 22 | 600 | 正文或操作强强调 |
| 15/Regular | 15 | 19 或 21 | 400 | 主要文字/正文、正常按钮 |
| 15/Medium | 15 | 19 | 500 | 正文或按钮中等强调 |
| 14/Regular | 14 | 20 | 400 | 次要文字 |
| 14/Medium | 14 | 20 | 500 | 中号按钮文字 |
| 12/Regular | 12 | 18 | 400 | 辅助信息 |
| 11/Regular | 11 | 140% | 400 | 徽标、补充文字 |
| 10/Regular | 10 | 14 | 400 | 徽标、补充文字 |
| 9/Regular | 9 | 11 | 400 | 小标签文字 |

### 字体使用规则

- 导航栏标题和页面一级标题优先使用 17。
- 正文和普通按钮优先使用 15 或 16。
- 次要文字使用 14。
- 辅助元信息使用 12。
- 11/10/9 只用于徽标、紧凑标签或补充微文案。
- 普通内部业务 APP 页面不要使用过大的展示字号。

## 间距

优先使用语义间距 token，不要随意写零散数值。

### 间距阶梯

| Token | 值 | 使用场景 |
| --- | ---: | --- |
| Space-0 | 0 | 无间距、贴合布局 |
| Space-1 | 4 | 图标与文字、紧凑元素之间 |
| Space-2 | 8 | 控件内部小间距、紧凑列表项 |
| Space-3 | 12 | 表单字段内边距、按钮垂直节奏补充 |
| Space-4 | 16 | 页面左右边距、卡片内边距、常规模块间距 |
| Space-5 | 20 | 重要内容区上下间距 |
| Space-6 | 24 | 大模块间距、页面分组间距 |
| Space-8 | 32 | 强分组或页面级区块间距 |

### 间距使用规则

- 移动端页面左右安全边距优先使用 Space-4。
- 同一业务分组内，标题与内容优先使用 Space-2 或 Space-3。
- 不同业务分组之间优先使用 Space-4、Space-5 或 Space-6。
- 图标与文字、徽标与文字之间优先使用 Space-1。
- 列表行内部保持紧凑，优先使用 Space-2 到 Space-4。
- 页面不要混用过多间距值；同一页面优先控制在 3-5 个间距 token 内。

## 圆角

优先使用语义圆角 token，容器类和控件类层级要稳定。

### 圆角阶梯

| Token | 值 | 使用场景 |
| --- | ---: | --- |
| Radius-0 | 0 | 无圆角、直角边界 |
| Radius-1 | 1 | 细指示线、极小装饰线 |
| Radius-2 | 2 | 极小标签或细小元素 |
| Radius-4 | 4 | 分段器、输入框、小型容器 |
| Radius-8 | 8 | 卡片、内容容器、弹层容器 |
| Radius-pill | 999 | 胶囊按钮、标签卡、圆角按钮 |
| Radius-circle | 50% | 头像、圆形图标容器 |

### 圆角使用规则

- 普通业务卡片优先使用 Radius-8。
- 分段器、输入框、小型容器优先使用 Radius-4。
- 按钮和标签卡使用胶囊圆角，可用 Radius-pill 表达；实现时可按组件高度取半径。
- 指示线使用 Radius-1。
- 页面中不要混用过多圆角层级；容器类和控件类要保持稳定。
- 除头像、圆形图标容器外，不要把 Radius-circle 用于普通卡片或按钮。

## 颜色

优先使用语义 token。不要在已有 Snow token 可用时随意选择蓝、灰、绿、橙、红。

### 品牌蓝

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Brand-8 | #004080 | 点击 / active |
| Brand-6 / primary | #0073E5 | 常规主色 |
| Brand-disabled | #93C9F5 | 组件禁用主色 |
| Brand-3 | #80BFFF | 一般禁用 |
| Brand-2 | #B2D9FF | 文字禁用 |
| Brand-1 | #E6F2FF | 浅色 / base 悬浮 |

### 线条

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Line-1 | #E3E5E8 | 深/灰底-分割线 |
| Divider Color | #F0F0F0 | 中性色 Black 6% 分隔线 |

### 填充

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Fill-4 | #D5D9DD | 重/特殊场景 |
| Fill-3 | #E3E5E8 | 深/灰底 |
| Fill-2 | #F1F1F4 | 常规/白色悬浮 |
| Fill-1 | #F7F7F8 | 浅/禁用 |
| White | #FFFFFF | 纯白填充 |

### 文字

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Text-5 | #0B0D0F | 强调/正文标题 |
| Text-4 | #576675 | 次强调/正文标题 |
| Text-3 | #8A99A8 | 次要信息-深 |
| Text-2 | #C4CCD4 | 置灰/禁用信息 |
| Text-1 | #FFFFFF | 纯白文字 |

### 功能色

#### 成功 Success

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Success-5 | #248F24 | 点击 |
| Success-4 | #2EB82E | 常规 |
| Success-3 | #ADEBAD | 禁用 |
| Success-2 | #C2F0C2 | 特殊场景 |
| Success-1 | #EBFAEB | 浅色背景 |

#### 警告 Warning

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Warning-5 | #B25900 | 点击 |
| Warning-4 | #FF8C1A | 常规 |
| Warning-3 | #FFCC99 | 禁用 |
| Warning-2 | #FFD9B2 | 特殊场景 |
| Warning-1 | #F2FFE6 | 浅色背景 |

#### 危险 Danger

| Token | 色值 | 使用场景 |
| --- | --- | --- |
| Danger-5 | #DA0B0B | 点击 |
| Danger-4 | #F53D3D | 常规 |
| Danger-3 | #FA9E9E | 禁用 |
| Danger-2 | #FBB6B6 | 特殊场景 |
| Danger-1 | #FEE7E7 | 浅色背景 |

### 颜色使用规则

- 主操作和关键选中态使用 Brand-6 / primary。
- Brand-8 只用于 active、pressed、点击态。
- Brand-1 或 Brand-2 可用于轻量选中背景或禁用蓝色，不作为主体页面背景。
- Success、Warning、Danger 只用于真实业务状态。
- 重要文字使用 Text-5/Text-4，次要元信息使用 Text-3，禁用文字使用 Text-2。
- 低强调表面使用 Fill-1/Fill-2；分隔线使用 Line-1 或 Divider Color。
- 同一页面内状态颜色语义要稳定，不要一会儿用警告色表示待处理、一会儿又表示异常。

## 语义 Token 对照

组件规则只引用 token，具体值在本节维护。

### 主要颜色

| MasterGo Token | 对应基础 token | 色值 | 用途 |
| --- | --- | --- | --- |
| 主要颜色/primary | Brand-6 / primary | #0073E5 | 主按钮默认态、关键品牌动作 |
| 主要颜色/active | Brand-8 | #004080 | 点击态、按下态 |
| 主要颜色/disabled | Brand-disabled | #93C9F5 | 主按钮禁用态 |
| 主要颜色/light-default | Brand-1 | #E6F2FF | 辅助按钮默认背景、浅品牌背景 |

### 填充

| MasterGo Token | 对应基础 token | 色值 | 用途 |
| --- | --- | --- | --- |
| 填充-fill/0-透明 | Fill-1 | #F7F7F8 | 浅/禁用背景、未选中弱背景 |
| 填充-fill/纯白 | White | #FFFFFF | 白色容器、卡片内容区 |

### 文字与图标

| MasterGo Token | 对应基础 token | 色值 | 用途 |
| --- | --- | --- | --- |
| 文字与图标-text/纯白 | Text-1 | #FFFFFF | 深色/主色背景上的文字和图标 |
| 文字与图标-text/0 | Text-5 | #0B0D0F | 强强调正文或标题 |
| 文字与图标-text/1 | Text-4 | #576675 | 次强调正文或标题 |

### 描边色

| MasterGo Token | 对应基础 token | 色值 | 用途 |
| --- | --- | --- | --- |
| 描边色-border/focus-border | Brand-6 / primary | #0073E5 | 品牌描边、焦点描边 |

### 功能色

| MasterGo Token | 对应基础 token | 色值 | 用途 |
| --- | --- | --- | --- |
| 功能色/危险-danger/danger | Danger-4 | #F53D3D | 常规危险状态 |
| 功能色/警告-warning/warning | Warning-4 | #FF8C1A | 常规警告状态 |

### 间距

| MasterGo/实现 Token | 对应基础 token | 值 | 用途 |
| --- | --- | ---: | --- |
| space/mini | Space-1 | 4 | 极小间距 |
| space/small | Space-2 | 8 | 小间距 |
| space/default | Space-4 | 16 | 常规间距 |
| space/large | Space-6 | 24 | 大间距 |

### 圆角

| MasterGo/实现 Token | 对应基础 token | 值 | 用途 |
| --- | --- | ---: | --- |
| radius/line | Radius-1 | 1 | 指示线圆角 |
| radius/small | Radius-4 | 4 | 分段器、小型控件 |
| radius/default | Radius-8 | 8 | 卡片、内容容器 |
| radius/pill | Radius-pill | 999 | 胶囊按钮、标签卡 |
| radius/circle | Radius-circle | 50% | 圆形元素 |
