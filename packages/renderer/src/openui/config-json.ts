/** JSON.parse validates syntax; this pass also rejects ambiguous duplicate object keys. */
export function parseConfigJson(source: string): unknown {
  const value: unknown = JSON.parse(source)
  const frames: Array<{ keys: Set<string>; expectKey: boolean } | null> = []
  for (const match of source.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],:]/g)) {
    const token = match[0]
    if (token === '{') frames.push({ keys: new Set(), expectKey: true })
    else if (token === '[') frames.push(null)
    else if (token === '}' || token === ']') frames.pop()
    else {
      const frame = frames.at(-1)
      if (token === ',' && frame) frame.expectKey = true
      else if (token.startsWith('"') && frame?.expectKey) {
        const key = JSON.parse(token) as string
        if (frame.keys.has(key)) throw new Error(`OpenUI 配置字段重复：${key}`)
        frame.keys.add(key)
        frame.expectKey = false
      }
    }
  }
  return value
}
