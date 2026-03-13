import { splitFileName } from '@/shared/lib/file/split-file-name'

const MIDDLE_ELLIPSIS = '...'
const MIN_VISIBLE_PREFIX = 4
const MIN_VISIBLE_SUFFIX = 4
const TARGET_SUFFIX = 10

const clampVisibleLength = (length: number, maxLength: number) => Math.max(1, Math.min(length, maxLength))

type ComputeMiddleEllipsisTextParams = {
  text: string
  availableWidth: number
  preserveExtension?: boolean
  measureWidth: (value: string) => number
}

export const computeMiddleEllipsisText = ({
  text,
  availableWidth,
  preserveExtension = false,
  measureWidth,
}: ComputeMiddleEllipsisTextParams): string => {
  if (!availableWidth || measureWidth(text) <= availableWidth) {
    return text
  }

  const { base, extension } = preserveExtension ? splitFileName(text) : { base: text, extension: '' }
  const minSuffixLength = clampVisibleLength(
    preserveExtension && extension ? extension.length : MIN_VISIBLE_SUFFIX,
    text.length - 1,
  )
  const preferredSuffixLength = clampVisibleLength(
    preserveExtension && extension
      ? extension.length + Math.min(MIN_VISIBLE_SUFFIX, Math.max(0, base.length))
      : TARGET_SUFFIX,
    text.length - 1,
  )

  const makeCandidate = (prefixLength: number, suffixLength: number) =>
    `${text.slice(0, prefixLength)}${MIDDLE_ELLIPSIS}${text.slice(-suffixLength)}`

  let bestSuffixLength = minSuffixLength
  let suffixLow = minSuffixLength
  let suffixHigh = preferredSuffixLength

  while (suffixLow <= suffixHigh) {
    const middle = Math.floor((suffixLow + suffixHigh) / 2)
    if (measureWidth(makeCandidate(MIN_VISIBLE_PREFIX, middle)) <= availableWidth) {
      bestSuffixLength = middle
      suffixLow = middle + 1
    } else {
      suffixHigh = middle - 1
    }
  }

  let bestPrefixLength = 1
  let prefixLow = 1
  let prefixHigh = Math.max(1, text.length - bestSuffixLength - 1)

  while (prefixLow <= prefixHigh) {
    const middle = Math.floor((prefixLow + prefixHigh) / 2)
    if (measureWidth(makeCandidate(middle, bestSuffixLength)) <= availableWidth) {
      bestPrefixLength = middle
      prefixLow = middle + 1
    } else {
      prefixHigh = middle - 1
    }
  }

  return makeCandidate(bestPrefixLength, bestSuffixLength)
}

