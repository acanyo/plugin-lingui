import { validateFontFamily, type FontFamilyDefinition } from '@lingui/renderer'

function quote(value: string): string {
  return `"${value.replace(/[\\"]/g, '\\$&').replace(/[\x00-\x1f\x7f]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"`
}
export function exportFontCss(input: FontFamilyDefinition): string {
  const font = validateFontFamily(input)
  return (
    font.faces
      .map(
        (face) =>
          `@font-face {\n  font-family: ${quote(font.name)};\n  src: url(${quote(face.url)}) format(${quote(face.format)});\n  font-weight: ${face.weight};\n  font-style: ${face.style};\n  font-display: swap;${face.unicodeRange ? `\n  unicode-range: ${face.unicodeRange};` : ''}\n}`,
      )
      .join('\n\n') + '\n'
  )
}
export function downloadFontCss(font: FontFamilyDefinition) {
  const url = URL.createObjectURL(
    new Blob([exportFontCss(font)], { type: 'text/css;charset=utf-8' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${font.name.replace(/[^\p{L}\p{N}_-]/gu, '-')}.css`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
