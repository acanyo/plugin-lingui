# 宿主回调与公开嵌入

宿主回调由文章页或其他集成方提供，作品只声明名称、在事件中调用并绑定结果；不编写 JavaScript，不再发起同一业务的生成请求。没有用户提供的回调名称时不能虚构回调。

1. 在 document.integrations 中保留 apis 与 callbacks 两个数组。只使用回调时 apis=[]；callbacks 的每项至少包含 name 和 label，responseExample 只说明结构。
2. 根组件的 events.mount 使用 actions:[{"type":"callback","name":"用户提供的回调名称"}]，resultPath 为保存整个回调结果的路径，例如 /summary。
3. state.summary 初始化回调的所有绑定字段；真实内容初始为空，不能把 responseExample 当作已获取的数据。Text.text 使用 {"path":"/summary/content"}，不能直接填写 /summary/content 字符串或 {{summary.content}}。
4. 回调返回的 loading/error 字段是业务快照，应绑定 /summary/loading、/summary/error。事件本身的 loadingPath/errorPath 表示调用过程，不能代替回调返回的业务字段。静态预览不执行回调，不要为预览填入假摘要。
5. 开启公开嵌入是保存项目后的管理操作，不能写进设计 JSON。document 只包含 schemaVersion、title、parameters、state、integrations 和 source；工具提交可用 nodes 代替 source。不要添加 publicEmbed、public、published、visibility、embed 或元数据字段，也不要调用生成工具去开启公开嵌入。

最小作品通常只需 Card、Column、Row、Text、Divider；状态展示按需用 LingUI.Conditional，不必凑够默认节点数量。先完成动态绑定并通过 validate_design(finalize=true)，作者保存项目后在「嵌入代码」中开启「公开嵌入」。

随附的 host-callback.json 范例按智阅 zhiyue.summary 回调契约实现，只有用户指定此回调时才使用该名称；其他宿主用实际约定的名称和返回字段。范例不包含假摘要，也不代替文章页真实验证。
