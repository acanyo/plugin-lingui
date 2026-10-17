export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name.replace(/[^\p{L}\p{N}_-]/gu, '-')}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
