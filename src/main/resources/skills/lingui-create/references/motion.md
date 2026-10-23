# 交互动画

动画属于节点配置的 `motion` 字段，作品仍使用 `lingui.document/2`。先批量查询所用组件的 Schema，不新增文档顶层字段、不输出 JavaScript 或 CSS。

- `enter`、`exit`：`{ "preset": "fade-up", "duration": 300, "delay": 0, "easing": "ease-out" }`。preset 为 fade、fade-up、fade-down、zoom。入场在节点进入 DOM 时播放；离场在状态移除节点时播放，完成后才移除内容。更新一段文字不会重新播放入场。
- `hover`、`focus`：preset 为 lift 或 grow，支持 duration 与 easing。hover 适用于鼠标，focus 跟随键盘焦点，失去悬停或焦点后恢复。
- `press`：preset 只能为 scale-down，支持 duration 与 easing，鼠标或触摸按下、键盘 Enter/空格时播放，释放或取消后恢复。禁用控件不播放反馈。
- `motion.transition`：仅 LingUI.Collapse、LingUI.Accordion、Tabs、LingUI.Tabs 支持。`{ "duration": 240, "easing": "ease-out" }` 对折叠区域做高度过渡，对新选中的标签内容做淡入。仅改变状态，不额外发起请求。
- 所有 duration、delay 为 0–2000 的整数毫秒。duration 为 0 时立即完成。easing 仅 linear、ease、ease-in、ease-out、ease-in-out。
- duration 默认：入场/离场/内容切换 240ms、悬停/聚焦 160ms、按下 100ms。只对确有交互意义的节点添加动画，避免整棵组件树同时播放。
- LingUI.Conditional 的 condition 使用现有表达式，配置其 enter/exit 后可让整段内容出现或离开；保留子节点已有的状态、回调和绑定。exit 是对应 enter 效果的反向播放。
- 此版本不提供无限循环、滚动时间轴、任意关键帧或独立 animate 事件动作。弹窗、抽屉原生 open/close 不等于节点进入/离开 DOM。
- 系统开启 prefers-reduced-motion 时自动跳过动画。宿主可以通过 interactions.motion=false 禁用动画；静态导出自动禁用，确保内容可读。

以下完整范例使用本地 /expanded 状态和真实可操作的折叠组件，不需要 API 或宿主回调。
