export function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('操作已取消', 'AbortError'))
    if (signal.aborted) {
      abort()
      return
    }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
export async function timed<T>(
  run: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  timeoutMs: number,
) {
  const controller = new AbortController()
  const abort = () => controller.abort(parent.reason)
  parent.addEventListener('abort', abort, { once: true })
  if (parent.aborted) abort()
  const timer = setTimeout(
    () => controller.abort(new Error(`执行超时（${timeoutMs} 毫秒）`)),
    timeoutMs,
  )
  try {
    return await abortable(
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw controller.signal.reason
        return run(controller.signal)
      }),
      controller.signal,
    )
  } finally {
    clearTimeout(timer)
    parent.removeEventListener('abort', abort)
  }
}
