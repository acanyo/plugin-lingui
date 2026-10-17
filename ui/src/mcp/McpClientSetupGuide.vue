<template>
  <aside class="lu-mcp-client-guide" aria-label="Codex MCP 配置说明">
    <h4>在 Codex 中填写</h4>
    <dl>
      <div>
        <dt>Bearer 令牌环境变量</dt>
        <dd>留空</dd>
      </div>
      <div>
        <dt>标头</dt>
        <dd>
          键：<code>X-Lingui-MCP-Key</code><br />
          值：创建密钥时复制的完整 <code>lgu_mcp_…</code> 密钥
        </dd>
      </div>
    </dl>
    <p>
      直接粘贴密钥请使用「标头」，不要添加 Bearer
      前缀。「来自环境变量的标头」用于填写已设置的环境变量名，不能直接粘贴密钥。
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
