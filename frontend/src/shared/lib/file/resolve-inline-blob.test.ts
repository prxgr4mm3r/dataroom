import { describe, expect, it } from 'vitest'

import { resolveInlineBlob } from './resolve-inline-blob'

describe('resolveInlineBlob', () => {
  it('keeps blob when it already has a specific content type', () => {
    const blob = new Blob(['x'], { type: 'application/pdf' })

    const result = resolveInlineBlob(blob, {
      headerContentType: 'application/octet-stream',
      fallbackContentType: 'text/plain',
    })

    expect(result).toBe(blob)
    expect(result.type).toBe('application/pdf')
  })

  it('uses header content type when blob type is generic', () => {
    const blob = new Blob(['x'], { type: 'application/octet-stream' })

    const result = resolveInlineBlob(blob, {
      headerContentType: 'application/pdf; charset=binary',
      fallbackContentType: 'text/plain',
    })

    expect(result).not.toBe(blob)
    expect(result.type).toBe('application/pdf')
  })

  it('falls back to expected content type when header is generic', () => {
    const blob = new Blob(['x'], { type: 'application/octet-stream' })

    const result = resolveInlineBlob(blob, {
      headerContentType: 'application/octet-stream',
      fallbackContentType: 'application/pdf',
    })

    expect(result.type).toBe('application/pdf')
  })

  it('keeps blob when no preferred type is available', () => {
    const blob = new Blob(['x'], { type: 'application/octet-stream' })

    const result = resolveInlineBlob(blob, {
      headerContentType: 'application/octet-stream',
      fallbackContentType: null,
    })

    expect(result).toBe(blob)
    expect(result.type).toBe('application/octet-stream')
  })
})
