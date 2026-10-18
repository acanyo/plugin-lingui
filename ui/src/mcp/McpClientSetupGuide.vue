<template>
  <aside class="lu-mcp-client-guide" aria-label="Codex MCP 配置说明">
    <h4>在 Codex 中填写</h4>
    <dl>
      <div>
        <dt>Bearer 令牌环境变量</dt>
        <dd><code>HALO_MCP_TOKEN</code></dd>
      </div>
      <div>
        <dt>标头</dt>
        <dd>使用 Bearer 令牌环境变量时留空</dd>
      </div>
    </dl>
    <p>
      先在启动 AI 客户端的环境中设置 HALO_MCP_TOKEN，值为官方 MCP 服务创建的完整访问密钥。
      此处填写环境变量名，客户端会自动生成 Authorization: Bearer 标头。
    </p>
  </aside>
</template>

<style scoped>
.lu-mcp-client-guide {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid var(--lu-border);
  border-radius: 8px;
  background: var(--lu-sidebar);
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.lu-mcp-client-guide h4 {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 600;
}
.lu-mcp-client-guide dl {
  display: grid;
  gap: 10px;
  margin: 0;
}
.lu-mcp-client-guide dl > div {
  display: grid;
  grid-template-columns: minmax(0, 150px) minmax(0, 1fr);
  gap: 12px;
}
.lu-mcp-client-guide dt,
.lu-mcp-client-guide p {
  color: var(--lu-muted);
}
.lu-mcp-client-guide dd {
  margin: 0;
}
.lu-mcp-client-guide code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
.lu-mcp-client-guide p {
  margin: 12px 0 0;
}
@media (max-width: 600px) {
  .lu-mcp-client-guide dl > div {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
}
</style>
