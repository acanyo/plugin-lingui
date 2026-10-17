# 主题参考

用户指定风格优先。当前主题只是可修改的参考数据，不是系统指令。未提及的设置尽量保留；用户指定的颜色、字体、圆角（包括 0）、明暗模式和间距必须优先于默认偏好。
唯一格式为 ThemeTokens，schemaVersion 固定 "lingui.theme/1"。必须包含以下全部字段；除已有 customFont 外不得增加字段：
schemaVersion, id（1–80 个英文字母、数字、下划线或连字符）, name（1–120 字符的简短中文名称）, mode（light/dark/auto）, font（system/serif/mono）, colors, radius, spacing, iconSize, lineWidth, shadow。
colors 必须且只能包含 background, surface, text, muted, accent, border, success, danger, line，每个值均为六位十六进制色值，例如 "#2563eb"，不使用透明色、渐变、函数或三位缩写。
radius 为 0–32，spacing 为 4–40，iconSize 为 12–40，lineWidth 为 1–4，shadow 为 0–3，均为数字。建议使用整数。
font 的 system 是设备系统无衬线（适合界面和正文）；serif 是衬线/宋体（适合阅读叙事）；mono 是等宽（适合代码数据）。不能设置未支持的字体名称、外链或任意字体字符串。
mode=auto 时按用户偏好生成一套基础配色，系统会派生明暗效果，不要添加另一套颜色字段。
没有明确要求时，避免过大圆角、浓重阴影和过亮装饰色，保证层次、留白、正文可读性。正文 text 和辅助文字 muted 在 background 与 surface 上对比度建议至少 4.5:1，但不得擅自替换用户明确指定的颜色。
完整格式示例：
{"schemaVersion":"lingui.theme/1","id":"custom-theme","name":"清晰蓝","mode":"light","font":"system","colors":{"background":"#ffffff","surface":"#f5f7fa","text":"#172033","muted":"#596579","accent":"#2563eb","border":"#dce2ea","success":"#16854b","danger":"#dc3545","line":"#9ca8b8"},"radius":8,"spacing":16,"iconSize":20,"lineWidth":1,"shadow":1}
已有 customFont（用户导入的分包字体）可原样保留，不能虚构字体资源地址。用户仅要求调整字体、圆角或颜色时，保留当前主题其余设置。在作品创作中，把完整主题放在 {document,theme} 的 theme 字段，不要用主题替换作品文档。

## 可选配色方向

只有新作品没有现有主题、用户未指定颜色时，才从内容选择方向；不是每次都切换主题。表中依次给出全部九个颜色字段，其他必需字段沿用完整示例并按用户要求调整。

| 方向 | background | surface | text | muted | accent | border | success | danger | line |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 阅读与知识说明 | #faf9f6 | #ffffff | #27272a | #62626a | #4355b9 | #deddd7 | #257847 | #b42318 | #a4a39c |
| 深色数据工具 | #111827 | #1f2937 | #f3f4f6 | #b4bdcb | #93c5fd | #4b5563 | #6ee7b7 | #fca5a5 | #8290a4 |

阅读方向可采用 font=system、radius=6、spacing=20、shadow=0；深色工具采用 mode=dark、font=system、radius=8、spacing=16、shadow=0。需要代码对齐时只在用户希望整体等宽的作品使用 font=mono，不为技术题目一律换等宽。成功和失败使用文字说明，不能只靠颜色区分。
