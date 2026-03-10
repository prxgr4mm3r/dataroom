import { useCallback, useEffect, useReducer } from 'react'

type PreviewRenderState = {
  isRendered: boolean
  isOpen: boolean
  displayPreviewItemId: string | null
  isOpeningAnimationPending: boolean
  canRenderHeavyPreview: boolean
}

type PreviewRenderAction =
  | { type: 'show_preview_from_closed'; previewItemId: string }
  | { type: 'show_preview_from_open'; previewItemId: string }
  | { type: 'show_preview_while_rendered_closed'; previewItemId: string }
  | { type: 'set_open' }
  | { type: 'begin_close' }
  | { type: 'set_closed' }
  | { type: 'finish_close' }
  | { type: 'mark_ready' }

type UsePreviewRenderStateParams = {
  previewItemId: string | null
  animationMs: number
}

const createInitialPreviewRenderState = (previewItemId: string | null): PreviewRenderState => ({
  isRendered: Boolean(previewItemId),
  isOpen: Boolean(previewItemId),
  displayPreviewItemId: previewItemId,
  isOpeningAnimationPending: false,
  canRenderHeavyPreview: Boolean(previewItemId),
})

const previewRenderReducer = (
  state: PreviewRenderState,
  action: PreviewRenderAction,
): PreviewRenderState => {
  if (action.type === 'show_preview_from_closed') {
    return {
      ...state,
      isRendered: true,
      isOpen: false,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: true,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'show_preview_from_open') {
    return {
      ...state,
      isRendered: true,
      isOpen: true,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: true,
    }
  }

  if (action.type === 'show_preview_while_rendered_closed') {
    return {
      ...state,
      displayPreviewItemId: action.previewItemId,
      isOpeningAnimationPending: true,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'set_open') {
    return {
      ...state,
      isOpen: true,
    }
  }

  if (action.type === 'begin_close') {
    return {
      ...state,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: false,
    }
  }

  if (action.type === 'set_closed') {
    return {
      ...state,
      isOpen: false,
    }
  }

  if (action.type === 'finish_close') {
    return {
      ...state,
      isRendered: false,
      displayPreviewItemId: null,
    }
  }

  if (action.type === 'mark_ready') {
    return {
      ...state,
      isOpeningAnimationPending: false,
      canRenderHeavyPreview: true,
    }
  }

  return state
}

export const usePreviewRenderState = ({
  previewItemId,
  animationMs,
}: UsePreviewRenderStateParams) => {
  const [renderState, dispatchRender] = useReducer(
    previewRenderReducer,
    previewItemId,
    createInitialPreviewRenderState,
  )

  const markReady = useCallback(() => {
    dispatchRender({ type: 'mark_ready' })
  }, [])

  useEffect(() => {
    let closeTimer: number | null = null
    let animationFrame: number | null = null

    const cancelScheduledFrame = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
    }

    const clearCloseTimer = () => {
      if (closeTimer !== null) {
        window.clearTimeout(closeTimer)
        closeTimer = null
      }
    }

    const queueOpenOneFrame = () => {
      animationFrame = window.requestAnimationFrame(() => {
        dispatchRender({ type: 'set_open' })
        animationFrame = null
      })
    }

    const queueOpenTwoFrames = () => {
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = window.requestAnimationFrame(() => {
          dispatchRender({ type: 'set_open' })
          animationFrame = null
        })
      })
    }

    cancelScheduledFrame()

    if (previewItemId) {
      clearCloseTimer()

      if (!renderState.isRendered) {
        dispatchRender({
          type: 'show_preview_from_closed',
          previewItemId,
        })
        queueOpenTwoFrames()
      } else if (renderState.isOpen) {
        dispatchRender({
          type: 'show_preview_from_open',
          previewItemId,
        })
      } else {
        dispatchRender({
          type: 'show_preview_while_rendered_closed',
          previewItemId,
        })
        queueOpenOneFrame()
      }

      return () => {
        cancelScheduledFrame()
        clearCloseTimer()
      }
    }

    if (!renderState.isRendered) {
      return () => {
        cancelScheduledFrame()
        clearCloseTimer()
      }
    }

    dispatchRender({ type: 'begin_close' })
    animationFrame = window.requestAnimationFrame(() => {
      dispatchRender({ type: 'set_closed' })
      animationFrame = null
    })

    closeTimer = window.setTimeout(() => {
      dispatchRender({ type: 'finish_close' })
      closeTimer = null
    }, animationMs)

    return () => {
      cancelScheduledFrame()
      clearCloseTimer()
    }
  }, [animationMs, previewItemId, renderState.isOpen, renderState.isRendered])

  useEffect(() => {
    if (!renderState.isOpeningAnimationPending) {
      return
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeoutMs = prefersReducedMotion ? 0 : animationMs + 34
    const timeoutId = window.setTimeout(() => {
      markReady()
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [animationMs, markReady, renderState.isOpeningAnimationPending])

  return {
    ...renderState,
    markReady,
  }
}
