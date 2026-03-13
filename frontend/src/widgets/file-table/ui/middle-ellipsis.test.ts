import { describe, expect, it } from 'vitest'

import { computeMiddleEllipsisText } from './middle-ellipsis'

const monospacedMeasure = (value: string) => value.length

describe('computeMiddleEllipsisText', () => {
  it('returns original text when there is enough width', () => {
    expect(
      computeMiddleEllipsisText({
        text: 'cover.png',
        availableWidth: 100,
        preserveExtension: true,
        measureWidth: monospacedMeasure,
      }),
    ).toBe('cover.png')
  })

  it('adds middle ellipsis when width is constrained', () => {
    expect(
      computeMiddleEllipsisText({
        text: 'wallet-recovery-0xc1e985ca72c165e64a1a6778e99aa6fa2b84c412ac049cf559b9a6a18ab9ba72-DO_NOT_DELETE',
        availableWidth: 24,
        measureWidth: monospacedMeasure,
      }),
    ).toContain('...')
  })

  it('preserves extension inside the visible suffix for file names', () => {
    const result = computeMiddleEllipsisText({
      text: 'IntegrationsTakehome(1).docx',
      availableWidth: 16,
      preserveExtension: true,
      measureWidth: monospacedMeasure,
    })

    expect(result).toContain('...')
    expect(result.endsWith('.docx')).toBe(true)
  })

  it('does not split short file names when width is sufficient', () => {
    expect(
      computeMiddleEllipsisText({
        text: 'wEwaYaqh.zip',
        availableWidth: 20,
        preserveExtension: true,
        measureWidth: monospacedMeasure,
      }),
    ).toBe('wEwaYaqh.zip')
  })
})

