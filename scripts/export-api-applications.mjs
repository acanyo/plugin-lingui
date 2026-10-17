import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { apiExamples, createInstance } from "../packages/renderer/dist/lingui-renderer.js";

const target = new URL("../output/market-applications/", import.meta.url);
await mkdir(target, { recursive: true });
for (const app of apiExamples) {
  const work = {
    schemaVersion: "lingui.marketplace/1",
    kind: "component",
    title: app.title,
    description: app.description,
    category: "接口应用",
    author: "灵构 UI",
    version: "1.1.0",
    license: "GPL-3.0",
    notes: `来源：灵构 UI 内置作品（${app.id}）。${app.steps.join(" ")}\n工作台与市场预览使用本地模拟接口，不发送网络请求、不保存输入。使用后在「接口与回调」替换为自己的 API，并调整数据映射。发布到文章前由宿主允许真实接口；模拟接口仅用于试用。`,
    instance: createInstance(app.create()),
  };
  await writeFile(new URL(`${app.id}.json`, target), JSON.stringify(work, null, 2) + "\n");
}
await writeFile(
  new URL("README.md", target),
  `# 接口应用市场作品\n\n这 ${apiExamples.length} 件作品可直接通过管理端「导入作品」导入，审核、上架后出现在应用市场的组件列表中，分类为「接口应用」。也可更新管理端共享 Renderer 后，从「导入内置作品」选择。不会自动写入或上架生产市场。\n\n工作台和市场预览返回本地模拟数据；不会发送网络请求或保存表单输入。用于真实业务或文章前，请替换接口地址、核对响应映射，并由宿主允许调用。\n`,
);
console.log(`已导出 ${apiExamples.length} 件市场作品：${fileURLToPath(target)}`);
