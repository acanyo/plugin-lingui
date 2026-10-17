# 动态数据与业务能力

动态数据与已配置业务能力：
- document.integrations（可选）包含 apis 与 callbacks 数组。每条的 name 为事件引用标识，label/description 说明用途，inputExample/responseExample 仅描述业务数据格式。保持已有配置；未经用户要求不要修改接口地址或标识，不要虚构接口和 JS 函数。
- 调用已配置接口使用 {"type":"api","name":"searchArticles","args":{"q":{"$state":"/query"}},"resultPath":"/response"}；GET args 成为查询参数，其余方法成为 JSON 请求体。普通接口默认通过浏览器请求，仍须满足 CORS；宿主可提供专用适配器或限制。
- 组件可用 bindings 对集合字段绑定状态。例如 List 使用 items:[], children:[], bindings:{items:{path:"/response/items",map:{id:"/id",label:"/title",description:"/summary"}}}。List 的 select 事件提供 $event /item、/index、/value，可写入 /selected 来显示详情。
- Table rows 的映射示例 {path:"/response/items",map:{label:"/name",cells:["/status","/email"]}}。BarChart/LineChart/DonutChart 等 data 的映射示例 {path:"/response/items",map:{label:"/name",value:"/count"}}。映射路径相对于单条数据，/ 表示该条本身。数组数量、字段类型仍需符合组件 schema。
- dataState:{loading:{path:"/loading"},error:{path:"/error"},emptyText:"没有找到结果"} 显示加载、具体错误和空数据。对应事件设置 loadingPath/errorPath/resultPath。配置 retry 事件可让读者重新加载。
- 输入使用现有状态绑定，详情用 Text/Metric/Conditional 等基础组件组合。表单用 FormGroup.submit 调用接口。使用 latest 处理搜索竞态、drop 防止重复提交。凭据始终由宿主提供。

## 用户提供 GET 地址时

无需另找“接口组件”或专用天气组件。保留用户给出的完整 URL（含查询参数），定义 integrations.apis。天气、统计、列表等只读展示默认在根容器 root.events.mount 自动加载一次；需要手动更新时，另设 Button.events.click 调用相同接口，文案使用“刷新天气”等。用户要求只自动获取、不允许刷新时，只保留 mount，不生成刷新按钮或 retry 入口；用户指定手动获取时，只使用 click。不能自动执行表单提交、付款、删除等写入操作。真实数据初始为空，不用演示数据冒充已获取结果。

最小接口与状态：
`"integrations":{"apis":[{"name":"loadInfo","label":"获取信息","method":"GET","url":"用户给出的完整地址"}],"callbacks":[]}`
`"state":{"response":{},"loading":false,"error":""}`

根容器的自动加载绑定：
`"events":{"mount":{"actions":[{"type":"api","name":"loadInfo","args":{}}],"resultPath":"/response","loadingPath":"/loading","errorPath":"/error","concurrency":"drop"}}`
可选的刷新按钮使用相同绑定，仅把事件名 mount 改为 click；不要同时在根容器和按钮配置 mount，否则首次打开会重复请求。resultPath/loadingPath/errorPath 在事件绑定这一层。按钮 loading 可绑定 /loading，防止自动加载过程中重复点击。

mount 每次作品实例打开时执行一次，状态变化、主题切换不触发；重新打开或重新载入作品可再次执行。它不是媒体 load，也不是定时轮询，不携带输入值，参数须使用固定值或 $state，不能依赖 $event /value。缩略图、版本对比和静态导出不自动执行。无刷新入口表示本次打开不提供手动重试，不能承诺永远不再请求。

使用 `Text.text:{"path":"/response/某字段"}` 或 `LingUI.Metric.value:{"path":"/response/某数值字段"}` 显示结果；不支持模板拼接，单位写在 Metric.label（如“温度 · °C”）、description 或单独 Text，不能虚构 unit 属性。用 Conditional 控制加载、错误及结果可见性，错误文字绑定 /error。查询这些基础类型的 schema 后实现完整文档并 validate_design，不要为了接口另找新组件或额外查询主题。

请求成功不代表有业务数据。根据响应中的实际字段显示结果、空状态和重试入口；处理 `{}`、`null` 和部分字段缺失。数值字段用 `neq(path,null)` 判断是否缺失，不能用字段的真假值判断（0°C、0 风速、代码 0 都是有效数据）。数值计算用 `if` 先排除缺失字段，不能用 and/or 包住可能报错的计算，因为它们会求值全部参数。缺失的指标显示「—」，昼夜等枚举只匹配明确取值，不能把缺失值当作夜间。提供有代表性的 responseExample 供 AI 和绑定编辑器识别结构，真实 state.response 保持为空，不冒充已加载数据。
