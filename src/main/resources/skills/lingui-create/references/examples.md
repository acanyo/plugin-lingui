# 可改写的组合范例

这些完整设计使用工具专用 nodes，经过服务端和 Renderer 校验，供 validate_design / submit_design_draft 使用；导出或导入时使用校验返回的标准 source。按需求改写内容、状态和 ID，不把范例的主题或功能强加给用户。保留已有作品未要求修改的节点 ID，有利于逐项审核。

- api-retry：Section + Button + List，展示加载、具体 HTTP 错误、空结果和重试。/__lingui_examples__/health 是工作台已有的本地模拟接口，第一次返回 503，第二次成功；仅演示时保留，用户给了真实地址时替换接口与字段映射，不能把模拟地址当作生产 API。
- quiz：ChoicePicker 的值为数组，使用 includes 显示各选项对应的解析；重试恢复初始状态。没有后端请求。
- metrics：Section + Row + Metric，使用真实语义分组和短说明，不堆叠卡片。静态数据明确标注为示例。

主题可参考 get_guidance(topic="theme") 的完整 ThemeTokens，并延续已有字体、圆角和用户指定色彩。接口及回调适配按 get_guidance(topic="data") 配置，不把 JS 函数体写入作品。
