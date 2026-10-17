<script lang="ts">
  import { openuiChildren } from '../openui/render-context'
  let { id }: { id: string } = $props()
  const { nodes, renderNode } = openuiChildren()
</script>
{#key id}{@render renderNode(nodes.get(id))}{/key}
