# OpenUI 组件配置目录

运行时使用 `@openuidev/svelte-lang` 和 `@openuidev/lang-core` 0.4.1；许可证为 MIT，副本见 `OpenUI-LICENSE`。官方文档：https://www.openui.com/docs/api-reference/svelte-lang 。

`catalog.json` 由 `scripts/generate-catalog.py` 及领域注册模块生成，标识为 `urn:lingui:openui:1`。它描述 100 种组件的严格配置、状态绑定、受限表达式和本地动作。组件样式由本项目提供。

`src/openui/definitions.ts` 将全部组件注册到 OpenUI Library。Lang 使用每行 `name = Component(JSON配置, [子组件引用])`；组件配置独立经过预编译 AJV 校验。`LingUI.*` 在 Lang 中使用 `LingUI_*` 名称。

运行 `pnpm generate:catalog` 重新生成目录和 `src/protocol/generated/validators.*`；禁止手改生成文件。浏览器只使用预编译校验器。市场管理端通过 `scripts/sync-renderer.py` 同步同一目录、共享渲染器和 Java Schema。

旧协议 Schema 和运行时已删除；旧作品只通过 `src/migration/` 做数据转换，不加载旧渲染器。
