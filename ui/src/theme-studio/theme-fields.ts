export const colorFields = [
  { key: 'background', label: '页面背景' },
  { key: 'surface', label: '次级表面' },
  { key: 'text', label: '正文文字' },
  { key: 'muted', label: '辅助文字' },
  { key: 'accent', label: '强调色' },
  { key: 'border', label: '边框' },
  { key: 'success', label: '成功反馈' },
  { key: 'danger', label: '错误反馈' },
  { key: 'line', label: '连接线' },
] as const
export const shapeFields = [
  { key: 'radius', label: '圆角', min: 0, max: 32, unit: 'px' },
  { key: 'spacing', label: '内容间距', min: 4, max: 40, unit: 'px' },
  { key: 'iconSize', label: '图标尺寸', min: 12, max: 40, unit: 'px' },
  { key: 'lineWidth', label: '连接线宽', min: 1, max: 4, unit: 'px' },
  { key: 'shadow', label: '阴影层次', min: 0, max: 3, unit: '级' },
] as const

export function normalizeHex(value: string): string | undefined {
  const color = value.trim()
  if (/^#[\da-f]{6}$/i.test(color)) return color.toLowerCase()
  if (/^#[\da-f]{3}$/i.test(color))
    return (
      '#' +
      [...color.slice(1)]
        .map((char) => char + char)
        .join('')
        .toLowerCase()
    )
  return undefined
}
