import type { GenerationEvent } from '../../api/generated'

/** Read POST SSE incrementally, including split UTF-8, CRLF and multi-line data frames. */
export async function readGenerationStream(
  stream: ReadableStream<Uint8Array>,
  onProgress?: (event: GenerationEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let data: string[] = []
  let totalBytes = 0
  let terminal = false
  const abort = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal?.addEventListener('abort', abort, { once: true })
  function consume(line: string): string | undefined {
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
    if (line !== '' || !data.length) return
    const raw = data.join('\n')
    data = []
    let event: GenerationEvent
    try {
      event = JSON.parse(raw)
    } catch {
      throw new Error('AI 进度数据格式无效，请重试。')
    }
    if (
      !event ||
      !['activity', 'heartbeat', 'result', 'error'].includes(event.type ?? '') ||
      !Number.isFinite(event.elapsedMs) ||
      (event.elapsedMs ?? 0) < 0
    )
      throw new Error('AI 进度事件无效，请重试。')
    if (
      event.type === 'activity' &&
      (typeof event.id !== 'string' ||
        event.id.length > 100 ||
        typeof event.label !== 'string' ||
        event.label.length > 160 ||
        !['running', 'done', 'warning', 'error'].includes(event.state ?? ''))
    )
      throw new Error('AI 执行步骤格式无效，请重试。')
    if (event.type === 'error') {
      terminal = true
      onProgress?.(event)
      // Match the existing diagnostic formatter; never surface arbitrary response properties.
      throw {
        response: {
          status: event.problem?.status ?? 502,
          data: event.problem ?? { detail: 'AI 生成未完成，请重试。' },
        },
      }
    }
    if (event.type === 'result') {
      if (
        typeof event.content !== 'string' ||
        !event.content.trim() ||
        new TextEncoder().encode(event.content).length > 262144
      )
        throw new Error('AI 返回的设计为空或超过 256 KiB，请重试。')
      terminal = true
      return event.content
    }
    onProgress?.(event)
  }
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError')
      const { done, value } = await reader.read()
      if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError')
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > 2 * 1024 * 1024) throw new Error('AI 进度响应过大，请缩小需求后重试。')
      buffer += decoder.decode(value, { stream: true })
      if (buffer.length > 1048576) throw new Error('AI 进度帧过大，请重试。')
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        const result = consume(line)
        if (result !== undefined) return result
      }
    }
    if (!terminal) throw new Error('AI 连接已中断，尚未收到完整设计。当前作品已保留，请重试。')
    throw new Error('AI 未返回完整设计，请重试。')
  } finally {
    signal?.removeEventListener('abort', abort)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** With the fetch adapter, HTTP error bodies are also ReadableStreams. */
export async function decodeStreamFailure(cause: unknown): Promise<unknown> {
  const error = cause as { response?: { status?: number; data?: unknown } }
  const stream = error?.response?.data
  if (!stream || typeof stream !== 'object' || !('getReader' in stream)) return cause
  const reader = (stream as ReadableStream<Uint8Array>).getReader()
  let text = ''
  const decoder = new TextDecoder()
  try {
    while (text.length < 16384) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    return { response: { status: error.response?.status, data: JSON.parse(text) } }
  } catch {
    return { response: { status: error.response?.status } }
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
