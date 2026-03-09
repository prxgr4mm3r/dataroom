import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import {
  getIntersectedSelectionIds,
  normalizeClientRect,
  resolveDragSelectionIds,
  toOverlayRect,
  type ClientPoint,
  type DragSelectionMode,
  type OverlayRect,
  type SelectableItemRect,
} from './drag-selection'

type DragState = {
  pointerId: number
  startPoint: ClientPoint
  currentPoint: ClientPoint
  mode: DragSelectionMode
  baseIds: string[]
  selectableItemRects: SelectableItemRect[]
  hasMoved: boolean
  hasPointerCapture: boolean
}

type UseDragSelectionControllerParams = {
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onOverlayRectChange?: (rect: OverlayRect | null) => void
  getContainerElement: () => HTMLElement | null
  getItemRects: () => SelectableItemRect[]
  isEnabled?: boolean
  movementThresholdPx?: number
  canStartSelection?: (event: PointerEvent<HTMLElement>) => boolean
}

type UseDragSelectionControllerResult = {
  isSelecting: boolean
  previewSelectedIds: string[] | null
  onPointerDown: (event: PointerEvent<HTMLElement>) => void
  onPointerMove: (event: PointerEvent<HTMLElement>) => void
  onPointerUp: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void
  onClickCapture: (event: MouseEvent<HTMLElement>) => void
}

const DEFAULT_MOVEMENT_THRESHOLD_PX = 4

const hasReachedMovementThreshold = (startPoint: ClientPoint, currentPoint: ClientPoint, thresholdPx: number): boolean =>
  Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) >= thresholdPx

const isPrimaryLeftPointer = (event: PointerEvent<HTMLElement>): boolean => event.isPrimary && event.button === 0

const areArraysEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index])

export const useDragSelectionController = ({
  selectedIds,
  onSelectionChange,
  onOverlayRectChange,
  getContainerElement,
  getItemRects,
  isEnabled = true,
  movementThresholdPx = DEFAULT_MOVEMENT_THRESHOLD_PX,
  canStartSelection,
}: UseDragSelectionControllerParams): UseDragSelectionControllerResult => {
  const [isSelecting, setIsSelecting] = useState(false)
  const [previewSelectedIds, setPreviewSelectedIds] = useState<string[] | null>(null)

  const dragStateRef = useRef<DragState | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const shouldSuppressClickRef = useRef(false)
  const lastPreviewSelectionRef = useRef<string[]>(selectedIds)

  useEffect(() => {
    if (!isSelecting) {
      lastPreviewSelectionRef.current = selectedIds
    }
  }, [isSelecting, selectedIds])

  const clearFrame = () => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }

  const commitSelection = (dragState: DragState) => {
    const containerElement = getContainerElement()
    if (!containerElement) {
      return
    }

    const selectionRect = normalizeClientRect(dragState.startPoint, dragState.currentPoint)
    const containerRect = containerElement.getBoundingClientRect()
    const nextOverlayRect = toOverlayRect(selectionRect, containerRect)
    onOverlayRectChange?.(nextOverlayRect)

    const hitIds = getIntersectedSelectionIds(selectionRect, dragState.selectableItemRects)
    const nextSelectedIds = resolveDragSelectionIds(dragState.mode, dragState.baseIds, hitIds)
    if (areArraysEqual(nextSelectedIds, lastPreviewSelectionRef.current)) {
      return
    }
    lastPreviewSelectionRef.current = nextSelectedIds
    setPreviewSelectedIds(nextSelectedIds)
  }

  const scheduleCommitSelection = () => {
    if (rafIdRef.current !== null) {
      return
    }

    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null
      const dragState = dragStateRef.current
      if (!dragState || !dragState.hasMoved) {
        return
      }
      commitSelection(dragState)
    })
  }

  const finishSelection = () => {
    clearFrame()
    const dragState = dragStateRef.current
    if (dragState?.hasPointerCapture) {
      const containerElement = getContainerElement()
      if (containerElement?.hasPointerCapture(dragState.pointerId)) {
        containerElement.releasePointerCapture(dragState.pointerId)
      }
    }
    dragStateRef.current = null
    setIsSelecting(false)
    setPreviewSelectedIds(null)
    onOverlayRectChange?.(null)
  }

  useEffect(() => {
    return () => {
      clearFrame()
    }
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!isEnabled || !isPrimaryLeftPointer(event)) {
      return
    }
    if (canStartSelection && !canStartSelection(event)) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startPoint: {
        x: event.clientX,
        y: event.clientY,
      },
      currentPoint: {
        x: event.clientX,
        y: event.clientY,
      },
      mode: event.ctrlKey || event.metaKey ? 'add' : 'replace',
      baseIds: [...selectedIds],
      selectableItemRects: getItemRects(),
      hasMoved: false,
      hasPointerCapture: false,
    }
    lastPreviewSelectionRef.current = selectedIds
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current
    if (!isEnabled || !dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    dragState.currentPoint = {
      x: event.clientX,
      y: event.clientY,
    }

    if (!dragState.hasMoved) {
      const reachedThreshold = hasReachedMovementThreshold(
        dragState.startPoint,
        dragState.currentPoint,
        movementThresholdPx,
      )
      if (!reachedThreshold) {
        return
      }

      dragState.hasMoved = true
      const targetElement = event.currentTarget as HTMLElement
      targetElement.setPointerCapture(event.pointerId)
      dragState.hasPointerCapture = true
      if (dragState.mode === 'replace' && dragState.baseIds.length) {
        lastPreviewSelectionRef.current = []
        setPreviewSelectedIds([])
      }
      shouldSuppressClickRef.current = true
      setIsSelecting(true)
    }

    event.preventDefault()
    scheduleCommitSelection()
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    dragState.currentPoint = {
      x: event.clientX,
      y: event.clientY,
    }

    if (dragState.hasMoved) {
      commitSelection(dragState)
      const nextSelectedIds = lastPreviewSelectionRef.current
      if (!areArraysEqual(nextSelectedIds, selectedIds)) {
        onSelectionChange(nextSelectedIds)
      }
    }

    finishSelection()
  }

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    finishSelection()
  }

  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!shouldSuppressClickRef.current) {
      return
    }

    shouldSuppressClickRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    isSelecting,
    previewSelectedIds,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture,
  }
}
