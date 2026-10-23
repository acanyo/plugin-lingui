# 组件交互动画

在手动编辑器中选择节点，打开「交互动画」即可配置入场、离场、悬停、按下和聚焦效果。也可以让 AI 按自然语言生成，例如：

> 卡片淡入上移，鼠标经过轻微抬升；按钮按下时略微缩小，点击后平滑展开详情。保留现有的数据绑定和宿主回调。

作品继续使用 `lingui.document/2`，动画放在对应组件配置的 `motion` 属性中：

```json
{
  "motion": {
    "enter": { "preset": "fade-up", "duration": 300 },
    "hover": { "preset": "lift", "duration": 160 },
    "press": { "preset": "scale-down", "duration": 100 },
    "focus": { "preset": "grow" },
    "exit": { "preset": "fade", "duration": 180 }
  }
}
```

以上是节点属性片段；作品的 `source` 中将其放在 Card、Button 或其他组件的第一个配置参数里。工具创作时可以直接在 `nodes` 数组的对应节点中添加。

| 配置 | 预设 | 触发方式 |
| --- | --- | --- |
| `enter` / `exit` | `fade`、`fade-up`、`fade-down`、`zoom` | 节点进入 / 离开 DOM；离场效果反向播放，结束后移除节点 |
| `hover` | `lift`、`grow` | 鼠标进入 / 离开 |
| `press` | `scale-down` | 鼠标、触摸或 Enter / 空格按下与释放 |
| `focus` | `lift`、`grow` | 节点内获得 / 失去键盘焦点 |
| `transition` | 无需 preset | 折叠、手风琴或标签页内容切换 |

所有效果支持 `duration` 和 `easing`；入场、离场还支持 `delay`。时长与延迟均为 0–2000 的整数毫秒，时长为 0 时立即完成。`easing` 支持 `linear`、`ease`、`ease-in`、`ease-out`、`ease-in-out`。

入场、离场与内容切换默认 240ms；悬停、聚焦默认 160ms；按下默认 100ms。

## 状态切换

`LingUI.Collapse`、`LingUI.Accordion`、`Tabs`、`LingUI.Tabs` 可添加：

```json
{ "motion": { "transition": { "duration": 240, "easing": "ease-out" } } }
```

折叠与手风琴使用高度过渡，关闭动画期间内容不可操作；再次切换会取消前一次动画并从当前尺寸继续。标签页只保留选中的面板参与布局，并在切换后淡入。

对 `LingUI.Conditional` 配置 `enter` / `exit`，可以让绑定条件控制整段内容的出现与离场。仅在启用动画时增加一个内容容器；已有作品不配置动画时保持原有结构。内容本身已有动画时，也可把配置放在其根节点上。

入场、离场针对 DOM 生命周期，文字更新不会反复触发；原生弹窗或抽屉的 open / close 不属于 DOM 移除。此版本提供上述预设与状态过渡，不包含滚动时间轴、无限循环或任意 CSS / JavaScript 关键帧。

## 宿主与静态展示

系统开启减少动态效果（`prefers-reduced-motion`）时自动跳过动画。禁用控件不播放交互反馈，触屏不保持鼠标悬停状态。

宿主可在 `mountRenderer` 或嵌入标签的 `interactions` 中设置 `motion: false` 禁用作品动画。`renderStatic` 自动禁用动画，避免导出的内容处于入场透明状态。作品预览与文章嵌入共用同一套渲染实现。

AI 可以通过 `get_guidance(topic="motion")` 读取完整规范和范例；所有字段会经过前后端共用目录的严格校验。
