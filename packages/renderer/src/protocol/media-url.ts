/** Only passive media sources; never executable URLs, embedded documents or credentials. */
export function safeMediaUrl(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    /[\s\\\u0000-\u001f\u007f]/.test(value)
  )
    return
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.username || url.password || !url.hostname) return
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return
    return url.href
  } catch {
    return
  }
}
