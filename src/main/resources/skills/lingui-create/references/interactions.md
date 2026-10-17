# 状态、条件显示与事件

只说明交互契约，组件属性通过 get_component_schemas 查询。查询名称使用工具返回的 name，例如 LingUI.Conditional；OpenUI 声明使用 sourceName，例如 LingUI_Conditional。不要编造 Conditional、Select 等未注册的基础名称。

## 状态与表达式

文档 state 必须初始化所有绑定字段。value 用 {"path":"/answer"}，绝对 JSON Pointer，不能使用 JS 或模板字符串。
ChoicePicker 是字符串数组（单选也如此），初始 []；LingUI.Select 是字符串。Checkbox/Switch 是布尔值，Tabs/Steps 是数字索引。

条件组件 LingUI.Conditional 的 condition 为受限表达式，child 引用内容节点。表达式直接使用字面量、{"path":"/字段"} 或 {"op":"操作符","args":[表达式,...]}。
判断单选答案：{"op":"includes","args":[{"path":"/answer"},"heap"]}。
ChoicePicker 的值始终是数组，计分、完成判断和解析都用 includes；不能用 eq/neq 把 /answer 与字符串比较。用户未要求时不额外增加计分、排名等功能。
字符串比较：{"op":"eq","args":[{"path":"/mode"},"detail"]}。
支持 eq/neq/gt/gte/lt/lte/and/or/not/if/includes 与受限数值运算；没有任意属性访问、数组索引语法或 JS 函数。
动态文本需要 {"call":"lingui.evaluate","args":{"expression":表达式}}；不能把 op 对象直接用作 Text.text，也不能再包 functionCall 字段。

## 按钮与重试

Button.child 是文本节点 ID，第二个 OpenUI 参数必须引用该声明，不是按钮文案。
单纯的本地按钮可以使用：
{"action":{"functionCall":{"call":"lingui.dispatch","args":{"actions":[{"type":"reset"}]}}}}
reset 恢复作品初始 state，适合重新作答；只清空个别字段时用 setState，value 为受限表达式，不能直接填数组。
例如 {"type":"setState","path":"/visible","value":false}。动作按顺序执行。支持 toggleState、increment/decrement、show/hide、nextStep/previousStep 等，仍须符合查询到的 schema。

## 事件钩子

所有组件支持 mount，含义是每次打开作品自动执行一次；推荐在根容器配置一次自动加载，避免在多个节点重复请求。主题切换与状态更新不会再次执行，媒体的 load 仅表示媒体资源加载，不能代替 mount。自动加载与手动刷新可以组合，也可以只配置 mount 而不提供刷新按钮。天气等只读接口的具体模式见 get_guidance(topic="data")。

输入组件会先自动更新 value 绑定，再发出 change。仅需条件显示解析时，不必配置额外 change 动作，使用 Conditional 与 state 即可。
需要读取事件、调用 API/JS 回调时使用组件允许的 events：
{"events":{"click":{"actions":[{"type":"local","actions":[{"type":"setState","path":"/selected","value":{"$event":"/value"}}]}]}}}
事件动作中的数据占位符为 {"$state":"/字段"}、{"$event":"/value"}、{"$result":"/字段"}；这与 condition 的 {"path":"/..."} 不同，不能混用。事件载荷由组件决定，查询其 schema 和实际支持的事件，不要给静态组件添加 click。

接口动作为 {"type":"api","name":"已配置名称","args":{...},"resultPath":"/response"}；JS 回调为 {"type":"callback","name":"已配置名称","args":{...}}。保留已有 integrations；只有用户提供接口地址或回调名称才加入，凭据由宿主管理，不能写进作品。详细数据绑定用 get_guidance(topic="data")。
事件可设置 onSuccess/onError、loadingPath/errorPath/resultPath，所有状态先初始化；concurrency="latest" 处理搜索竞态，"drop" 防止重复提交。

## 测验的最小组合

用 Column + Text + ChoicePicker + LingUI.Conditional + Button 即可。state.answer=[]；每个答案用 includes 判断，显示对应正确/错误解析；reset 按钮重新作答。
如果设计显式「提交答案」按钮，必须先判断选中了有效选项（用 includes，并用 or 组合）；未选择时禁用提交并显示「请先选择一个答案」。重新作答后恢复禁用状态。不能把空答案判为答错。
源码中让 root 引用题干、选项、各个解析条件、重试按钮；条件节点引用解析文本；重试按钮引用自己的文字。所有节点都连接到 root，引用的节点都列在调用第二个数组中。布局不依赖额外的卡片套层。
先完成用户要求的实际交互，再用 validate_design 提交最终文档。主题通过 ThemeTokens 调整，不生成 CSS。
