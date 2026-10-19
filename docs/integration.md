# 在其他插件或主题中选择灵构 UI 作品

灵构 UI 提供 FormKit 输入、全局 Vue 选择器、全局 Vue 展示组件和轻量查询 API。接入方保存选择器返回的项目 ID，再用同一个 ID 展示作品；不需要复制项目文档或版本历史，也不需要安装额外的 npm 或 Maven SDK。

## 接入前提

- Halo 2.26.0 或更高版本，并安装、启用灵构 UI 1.0.3 或更高的兼容版本。
- 配置页面的当前用户拥有灵构 UI「查看和使用组件与主题」权限。
- 面向访客展示的作品已经由管理员在灵构 UI 中开启公开嵌入。选择作品不会自动开启公开嵌入。

接入只需要作品 ID。ID 是接口返回的 `id`，例如 `component-weather`，不要额外添加 `component-` 前缀。

## 插件依赖和 UI 就绪状态

如果灵构 UI 是接入插件的必需功能，可在接入方的 `plugin.yaml` 中声明依赖。版本范围应使用接入方实际验证过的最低灵构 UI 版本：

```yaml
spec:
  requires: ">=2.26.0"
  pluginDependencies:
    plugin-lingui: ">=1.0.3 & <2.0.0"
```

如果只是增强功能，也可以将键写为 `plugin-lingui?`，在灵构 UI 未安装或未就绪时显示提示并提供其他配置方式。Halo 的插件依赖机制详见[依赖其他插件](https://docs.halo.run/developer-guide/plugin/interaction/dependency)。

依赖声明不能代替当前页面的 UI 就绪检查。使用 Halo 提供的 `stores.uiPlugins()`，在 `isRegistered('plugin-lingui')` 为 `true` 后挂载选择器或含有该输入类型的 FormKit 表单。`isEnabled()` 仅表示当前页面发现了 provider；加载失败、仍在加载时都不应挂载依赖它的表单。参见 [Halo UI provider 状态](https://docs.halo.run/developer-guide/plugin/api-reference/ui/shared#uiplugins)。

```vue
<script setup lang="ts">
import { stores } from '@halo-dev/ui-shared'
import { computed, ref } from 'vue'

const providers = stores.uiPlugins()
const linguiReady = computed(() => providers.isRegistered('plugin-lingui'))
const projectId = ref('')
</script>

<template>
  <LinguiProjectSelect v-if="linguiReady" v-model="projectId" />
  <p v-else>灵构 UI 选择器尚未就绪，请检查插件是否已启用。</p>
</template>
```

这是 Halo 宿主 Vue App 中注册的全局组件，接入插件的 Console 页面无需导入组件源码。自行 `createApp()` 的独立 Vue 应用不会继承宿主的组件和 FormKit 注册；站外应用也不能直接使用这些注册。同源独立页面可使用自己的选择界面和下文的查询接口。`uiPlugins` 只提供状态，不提供其他插件的组件对象或 `PluginModule`。

## FormKit 表单

在 Halo 的插件设置、主题设置或其他使用宿主 FormKit 的表单中，将字段类型设为 `linguiProjectSelect`：

```yaml
- $formkit: linguiProjectSelect
  name: componentId
  label: 灵构 UI 作品
  help: 选择已开启公开嵌入的作品，保存后按项目 ID 引用。
  publicOnly: true
  clearable: true
  placeholder: 请选择作品
  pageSize: 20
  showPreview: true
```

字段值是字符串项目 ID，清空时为 `''`。可使用 FormKit 的 `validation: required` 等校验规则。选中作品后只保存字段值，不会复制作品内容或更改公开状态。FormKit 的注册方式参见 [Halo FormKit 扩展](https://docs.halo.run/developer-guide/plugin/api-reference/ui/formkit)。

Vue 页面也可以使用 `<FormKit type="linguiProjectSelect" v-model="projectId" />`，同样应在灵构 UI 的 UI provider 注册完成后挂载。

## Vue 选择器参数

```vue
<LinguiProjectSelect
  v-model="projectId"
  :public-only="true"
  :clearable="true"
  :show-preview="true"
  placeholder="选择页脚作品"
/>
```

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `modelValue` / `v-model` | `string` | 未选择 | 项目 ID，清空时发送空字符串 |
| `publicOnly` | `boolean` | `true` | 仅查询已开启公开嵌入的作品 |
| `category` | `string` | 无 | 固定按分类名称过滤，可与关键词搜索组合 |
| `clearable` | `boolean` | `true` | 允许清空当前选择 |
| `disabled` | `boolean` | `false` | 禁用选择器 |
| `placeholder` | `string` | `选择灵构 UI 作品` | 未选择时的提示 |
| `pageSize` | `number` | `20` | 每页数量，限制在 1–100 |
| `showPreview` | `boolean` | `false` | 展示所选作品的预览 |

选择器支持搜索和分页。`category` 用于接入方限制选项范围。FormKit 输入接受同名参数，`disabled` 沿用 FormKit 的禁用行为。更新事件为 `update:modelValue`，只返回字符串 ID。

`publicOnly: false` 适合内部引用配置：具有查询权限的用户可以选择尚未公开的作品。它不会赋予访客读取权限；公开页面使用这些 ID 时，仍必须先由管理员开启对应作品的公开嵌入。

已有 ID 被删除，或在 `publicOnly: true` 时关闭公开嵌入，选择器保留字段中的原始 ID 并提示不可用，不会静默清空配置。搜索、分页和分类筛选也不会自动修改已保存的 ID；接入方可以保留待恢复的引用，也可以让用户重新选择。

## 使用自己的选择界面

轻量接口使用当前 Halo 登录态和权限，位于 Console API 下。插件 UI 发起请求时应复用 Halo 的 `axiosInstance`；无需把管理凭据传给展示作品的页面。

```ts
import { axiosInstance } from '@halo-dev/api-client'

const { data } = await axiosInstance.get(
  '/apis/console.api.lingui.acanyo.com/v1alpha1/projectoptions',
  {
    params: {
      page: 1,
      size: 20,
      keyword: '天气',
      publicOnly: true,
    },
  },
)

// 将 data.items 中用户选中的 item.id 保存到自己的设置。
```

| 接口 | 用途 |
| --- | --- |
| `GET /apis/console.api.lingui.acanyo.com/v1alpha1/projectoptions` | 查询作品选项 |
| `GET /apis/console.api.lingui.acanyo.com/v1alpha1/projectoptions/{name}` | 按 ID 读取已有选项，用于表单值回显 |

列表查询参数：

| 参数 | 说明 |
| --- | --- |
| `page` | 页码，从 1 开始，默认 1 |
| `size` | 每页数量，默认 20，范围 1–100 |
| `keyword` | 可选关键词，匹配项目名称、ID、分类或描述，最多 120 字符 |
| `category` | 可选分类名称，精确匹配，最多 80 字符 |
| `publicOnly` | 默认 `true`，仅返回已开启公开嵌入的作品 |

详情接口也支持 `publicOnly`，默认 `true`。将 ID 放入路径前使用 `encodeURIComponent(id)`；已经失效或不符合公开条件的引用返回 `404`。参数无效时返回 `400`。两个接口都需要当前用户的作品查询权限，匿名访客不能列出作品。

列表响应示例：

```json
{
  "items": [
    {
      "id": "component-weather",
      "displayName": "天气卡片",
      "category": "侧边栏",
      "description": "展示当前天气",
      "revision": 3,
      "embedEnabled": true
    }
  ],
  "page": 1,
  "size": 20,
  "total": 1
}
```

详情返回单个选项对象，字段与 `items` 中的条目相同。接口仅包含选择所需的摘要，不包含项目文档、源码和历史版本。接入方需要处理权限不足、请求失败和列表为空的状态；不要通过通用模型接口加载完整历史来填充下拉框。

## 按保存的 ID 展示作品

在 Halo 宿主 Vue 页面中，可以直接使用全局展示组件：

```vue
<LinguiProjectRender
  v-if="linguiReady && projectId"
  :project-id="projectId"
  :preview="true"
  fallback="此作品暂时不可用，请重新选择。"
/>
```

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `projectId` | `string` | 必填 | 选择器返回的项目 ID |
| `preview` | `boolean` | `false` | 预览模式，关闭作品自动启动和交互 API 请求 |
| `fallback` | `string` | `此作品暂时无法展示` | 作品读取失败时显示的文字 |

配置页面推荐开启 `preview`，阻止预览中的交互 API 请求。项目读取和图片、字体等资源仍正常加载。这个组件读取已开启公开嵌入的作品；它也不会自动公开项目。与选择器相同，使用前应检查灵构 UI 的 UI provider 已注册。

作品读取失败时默认显示错误详情和重新加载按钮，也可使用 `fallback` 插槽自行展示空状态，插槽参数为 `error` 和 `refresh`。组件实例还暴露 `refresh()`，可用于主动重新读取最新版本。

在同一 Halo 站点的 HTML 中输出以下标签，`data-lingui` 直接使用保存的 ID：

```html
<lingui-component data-lingui="component-weather"></lingui-component>
```

例如，主题中保存字段名为 `componentId` 时，可以通过 Thymeleaf 的属性绑定输出 ID，避免自行拼接 HTML：

```html
<lingui-component
  th:if="${not #strings.isEmpty(theme.config.general.componentId)}"
  th:attr="data-lingui=${theme.config.general.componentId}"
></lingui-component>
```

灵构 UI 会通过 Halo 的主题 Head 处理器注入 reader 样式和 loader，主题页面遵循 Halo 的 Head 输出约定即可。loader 检测到引用标签后才加载渲染器，也支持页面后续插入的引用标签。

如果是同站点中自行输出、不经过主题 Head 处理器的独立 HTML 页面，需要额外引入资源，每页引入一次：

```html
<link
  rel="stylesheet"
  href="/plugins/plugin-lingui/assets/reader/lingui-reader.css"
/>
<script defer src="/plugins/plugin-lingui/assets/reader/lingui-loader.js"></script>
```

可以在资源 URL 后附加当前插件版本作为缓存版本，例如 `?v=1.0.3`。reader 使用当前页面同源的公开接口，不支持将上述脚本地址改成其他站点后跨站读取作品。

展示端按 ID 读取最新保存版本。`revision` 是查询时的摘要信息，不是版本锁定参数；作品保存后，新页面访问或重新挂载会读取新版本，已经打开的页面不会实时推送更新。

作品被删除或关闭公开嵌入后，reader 显示不可用提示并提供重新加载按钮。灵构 UI 停用时资源和选择器无法加载，接入方应根据 UI 就绪状态隐藏配置入口，并为展示位置保留自己的空状态。需要对外展示时，默认保持 `publicOnly: true`，让用户在配置阶段就能发现不可用引用。

## 本仓库维护接口客户端

选择器的 TypeScript 客户端在 `ui/src/api/project-selection/`，由 Java DTO 生成，避免与工作台的既有客户端混用生成输入。修改接口后，在仓库根目录运行：

```sh
./gradlew generateApiClient -I scripts/project-selection-api.gradle -x generateOpenApiDocs
```

此命令复用项目的 API 生成任务，使用离线契约导出器生成选择器客户端。服务端路由、DTO、导出器和接口测试应一起维护。
