/** Positions themed overlays within the visual viewport, including mobile keyboard offsets. */
export function positionFloatingPanel(
  anchor: HTMLElement,
  panel: HTMLElement,
  preferredWidth?: number,
) {
  const rect = anchor.getBoundingClientRect()
  const viewport = window.visualViewport
  const x = viewport?.offsetLeft ?? 0,
    y = viewport?.offsetTop ?? 0
  const width = viewport?.width ?? window.innerWidth,
    height = viewport?.height ?? window.innerHeight
  const gap = 6,
    edge = 8
  panel.style.width = `${Math.max(0, Math.min(preferredWidth ?? rect.width, width - edge * 2))}px`
  const below = y + height - edge - rect.bottom - gap,
    above = rect.top - y - edge - gap
  const placeAbove = below < Math.min(320, panel.scrollHeight + 2) && above > below
  panel.style.maxHeight = `${Math.max(0, Math.min(320, placeAbove ? above : below))}px`
  panel.style.left = `${Math.max(x + edge, Math.min(rect.left, x + width - panel.offsetWidth - edge))}px`
  panel.style.top = `${Math.max(y + edge, placeAbove ? rect.top - gap - panel.getBoundingClientRect().height : rect.bottom + gap)}px`
}
