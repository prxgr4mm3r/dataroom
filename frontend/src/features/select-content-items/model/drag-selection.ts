export type ClientPoint = {
  x: number
  y: number
}

export type RectSides = {
  left: number
  right: number
  top: number
  bottom: number
}

export type OverlayRect = {
  x: number
  y: number
  width: number
  height: number
}

export type DragSelectionMode = 'replace' | 'add'

export type SelectableItemRect = {
  id: string
  rect: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>
}

export const normalizeClientRect = (start: ClientPoint, end: ClientPoint): RectSides => ({
  left: Math.min(start.x, end.x),
  right: Math.max(start.x, end.x),
  top: Math.min(start.y, end.y),
  bottom: Math.max(start.y, end.y),
})

export const toOverlayRect = (
  rect: RectSides,
  containerRect: Pick<DOMRectReadOnly, 'left' | 'top'>,
): OverlayRect => ({
  x: rect.left - containerRect.left,
  y: rect.top - containerRect.top,
  width: rect.right - rect.left,
  height: rect.bottom - rect.top,
})

export const intersectsRect = (
  a: RectSides,
  b: Pick<DOMRectReadOnly, 'left' | 'right' | 'top' | 'bottom'>,
): boolean => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom)

export const getIntersectedSelectionIds = (
  selectionRect: RectSides,
  itemRects: SelectableItemRect[],
): string[] =>
  itemRects
    .filter((itemRect) => intersectsRect(selectionRect, itemRect.rect))
    .map((itemRect) => itemRect.id)

export const resolveDragSelectionIds = (
  mode: DragSelectionMode,
  baseIds: string[],
  hitIds: string[],
): string[] => {
  if (mode === 'replace') {
    return [...new Set(hitIds)]
  }

  return [...new Set([...baseIds, ...hitIds])]
}
