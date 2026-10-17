import { describe, expect, it, vi } from 'vitest'
import type { GenerationEvent } from '../api/generated'
import { decodeStreamFailure, readGenerationStream } from '../ai-adapter/progress/event-stream'

function frame(event: GenerationEvent) {
  return `event:${event.type}\r\ndata:${JSON.stringify(event)}\r\n\r\n`
}
function bytes(text: string, split = 7) {
  const data = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < data.length; i += split) controller.enqueue(data.slice(i, i + split))
      controller.close()
    },
  })
}
const activity: GenerationEvent = {
  type: 'activity',
  id: 'tool-1',
  label: '读取组件参数',
  state: 'running',
  elapsedMs: 10,
}
const result: GenerationEvent = { type: 'result', content: '{"title":"中文组件"}', elapsedMs: 30 }

describe('generation POST event stream', () => {
  it('shows progress before completion and decodes split UTF-8 and CRLF frames', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value
      },
    })
    const progress = vi.fn()
    const complete = readGenerationStream(stream, progress)
    controller.enqueue(new TextEncoder().encode(frame(activity)))
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith(activity))
    controller.enqueue(new TextEncoder().encode(frame(result)))
    await expect(complete).resolves.toBe(result.content)
    await expect(readGenerationStream(bytes(frame(activity) + frame(result), 1))).resolves.toBe(
      result.content,
    )
  })

  it('supports multi-line data and ignores SSE comments', async () => {
    const text = ': heartbeat\n\ndata:{"type":"result",\ndata:"elapsedMs":3,"content":"{}"}\n\n'
    await expect(readGenerationStream(bytes(text))).resolves.toBe('{}')
  })

  it('retains safe provider diagnostics and reports the failed running stage', async () => {
    const progress = vi.fn()
    const error: GenerationEvent = {
      type: 'error',
      elapsedMs: 20,
      problem: {
        status: 502,
        detail: '认证失败',
        category: 'provider-http',
        providerStatus: 401,
        reference: '12345678',
      },
    }
    await expect(
      readGenerationStream(bytes(frame(activity) + frame(error)), progress),
    ).rejects.toMatchObject({
      response: { status: 502, data: { reference: '12345678', providerStatus: 401 } },
    })
    expect(progress).toHaveBeenLastCalledWith(error)
  })

  it('never treats a disconnect, malformed event, or incomplete terminal frame as success', async () => {
    await expect(readGenerationStream(bytes(frame(activity)))).rejects.toThrow('连接已中断')
    await expect(readGenerationStream(bytes('data:{bad}\n\n'))).rejects.toThrow('格式无效')
    await expect(
      readGenerationStream(bytes('data:{"type":"unexpected","elapsedMs":0}\n\n')),
    ).rejects.toThrow('事件无效')
    await expect(readGenerationStream(bytes(frame(result).trim()))).rejects.toThrow('连接已中断')
  })

  it('cancels a pending network read on stop and cancels after a terminal result', async () => {
    const cancel = vi.fn()
    const controller = new AbortController()
    const pending = readGenerationStream(
      new ReadableStream({ cancel }),
      undefined,
      controller.signal,
    )
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(cancel).toHaveBeenCalledOnce()
    const terminalCancel = vi.fn()
    await readGenerationStream(
      new ReadableStream({
        start(value) {
          value.enqueue(new TextEncoder().encode(frame(result)))
        },
        cancel: terminalCancel,
      }),
    )
    expect(terminalCancel).toHaveBeenCalledOnce()
  })

  it('decodes HTTP failures from the fetch adapter for the existing diagnostics', async () => {
    await expect(
      decodeStreamFailure({ response: { status: 403, data: bytes('{"detail":"无权访问"}') } }),
    ).resolves.toEqual({ response: { status: 403, data: { detail: '无权访问' } } })
  })
})
