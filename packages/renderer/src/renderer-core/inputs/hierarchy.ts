import type { ComponentNode } from '../../protocol/types'
export type TreeItem = NonNullable<ComponentNode['treeItems']>[number]
/** Catalog validation guarantees safe IDs and an acyclic hierarchy of at most eight levels. */
export function ancestry(items: TreeItem[], id: string): TreeItem[] {
  const path: TreeItem[] = []
  let current = items.find((item) => item.id === id)
  while (current && path.length < 8) {
    path.unshift(current)
    current = items.find((item) => item.id === current?.parent)
  }
  return path
}
export function treeDisabled(items: TreeItem[], item: TreeItem) {
  return ancestry(items, item.id).some((parent) => parent.disabled)
}
export function visibleTree(
  items: TreeItem[],
  expanded: string[],
  query: string,
): { item: TreeItem; level: number }[] {
  const result: { item: TreeItem; level: number }[] = []
  function visit(parent: string | undefined, level: number) {
    for (const item of items.filter((item) => item.parent === parent)) {
      if (
        !query ||
        ancestry(items, item.id).some((part) =>
          part.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
      )
        result.push({ item, level })
      if (query || expanded.includes(item.id)) visit(item.id, level + 1)
    }
  }
  visit(undefined, 1)
  return result
}
