export type FileNameParts = {
  base: string
  extension: string
}

export const splitFileName = (fileName: string): FileNameParts => {
  const lastDotIndex = fileName.lastIndexOf('.')

  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return {
      base: fileName,
      extension: '',
    }
  }

  return {
    base: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}
