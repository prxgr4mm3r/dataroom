import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from 'react'

import { usePreviewRenderState } from '@/shared/lib/preview/use-preview-render-state'

const PREVIEW_MIN_WIDTH = 320
const PREVIEW_MAX_WIDTH = 760
const PREVIEW_DEFAULT_WIDTH = 480

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

const getPreviewMaxWidth = (): number => {
  if (typeof window === 'undefined') {
    return PREVIEW_MAX_WIDTH
  }

  return clamp(Math.floor(window.innerWidth * 0.62), PREVIEW_MIN_WIDTH + 24, PREVIEW_MAX_WIDTH)
}

type UsePreviewPaneLayoutParams = {
  previewItemId: string | null
  animationMs: number
}

export type PreviewPaneLayoutState = {
  isRendered: boolean
  isOpen: boolean
  isResizing: boolean
  displayPreviewItemId: string | null
  isOpeningAnimationPending: boolean
  canRenderHeavyPreview: boolean
  paneClassName: string
  slidePanelClassName: string
  panelStyle: CSSProperties
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPaneTransitionEnd: (event: ReactTransitionEvent<HTMLDivElement>) => void
}

export const usePreviewPaneLayout = ({
  previewItemId,
  animationMs,
}: UsePreviewPaneLayoutParams): PreviewPaneLayoutState => {
  const [width, setWidth] = useState(PREVIEW_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const { isRendered, isOpen, displayPreviewItemId, isOpeningAnimationPending, canRenderHeavyPreview, markReady } =
    usePreviewRenderState({
      previewItemId,
      animationMs,
    })

  const resizeAnimationFrameRef = useRef<number | null>(null)
  const pendingResizeWidthRef = useRef<number | null>(null)
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const cancelResizeFrame = () => {
    if (resizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeAnimationFrameRef.current)
      resizeAnimationFrameRef.current = null
    }
    pendingResizeWidthRef.current = null
  }

  useEffect(() => {
    const handleResize = () => {
      setWidth((currentWidth) => clamp(currentWidth, PREVIEW_MIN_WIDTH, getPreviewMaxWidth()))
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isResizing || !isOpen) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStartRef.current) {
        return
      }

      const deltaX = dragStartRef.current.startX - event.clientX
      pendingResizeWidthRef.current = clamp(
        dragStartRef.current.startWidth + deltaX,
        PREVIEW_MIN_WIDTH,
        getPreviewMaxWidth(),
      )
      if (resizeAnimationFrameRef.current !== null) {
        return
      }

      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null
        if (pendingResizeWidthRef.current === null) {
          return
        }
        setWidth(pendingResizeWidthRef.current)
        pendingResizeWidthRef.current = null
      })
    }

    const stopResizing = () => {
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current)
        resizeAnimationFrameRef.current = null
      }
      if (pendingResizeWidthRef.current !== null) {
        setWidth(pendingResizeWidthRef.current)
        pendingResizeWidthRef.current = null
      }
      setIsResizing(false)
      dragStartRef.current = null
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)
    window.addEventListener('pointercancel', stopResizing)

    return () => {
      cancelResizeFrame()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
      window.removeEventListener('pointercancel', stopResizing)
    }
  }, [isOpen, isResizing])

  useEffect(() => {
    if (!isResizing) {
      return
    }

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isResizing])

  const onResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isOpen || event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      startX: event.clientX,
      startWidth: clamp(width, PREVIEW_MIN_WIDTH, getPreviewMaxWidth()),
    }
    setIsResizing(true)
  }

  const onPaneTransitionEnd = (event: ReactTransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return
    }

    if (!isOpen || !isOpeningAnimationPending) {
      return
    }

    markReady()
  }

  const paneClassName = [
    'relative h-full min-w-0 flex-[0_0_auto] overflow-visible will-change-[width] transition-[width] duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
    isOpen ? '' : 'pointer-events-none',
    isResizing ? 'transition-none' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const slidePanelClassName = [
    'absolute inset-y-0 right-0 flex w-[var(--preview-pane-open-width,100%)] flex-col border-l border-[var(--separator-soft)] bg-[var(--bg-sidebar)] will-change-transform transition-transform duration-[220ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
    isOpen ? 'translate-x-0' : 'translate-x-full',
    isResizing ? 'transition-none' : '',
  ]
    .filter(Boolean)
    .join(' ')
  const openWidth = clamp(width, PREVIEW_MIN_WIDTH, getPreviewMaxWidth())
  const panelStyle = useMemo(
    () =>
      ({
        width: isOpen ? openWidth : 0,
        '--preview-pane-open-width': `${openWidth}px`,
      }) as CSSProperties,
    [isOpen, openWidth],
  )

  return {
    isRendered,
    isOpen,
    isResizing,
    displayPreviewItemId,
    isOpeningAnimationPending,
    canRenderHeavyPreview,
    paneClassName,
    slidePanelClassName,
    panelStyle,
    onResizeStart,
    onPaneTransitionEnd,
  }
}
