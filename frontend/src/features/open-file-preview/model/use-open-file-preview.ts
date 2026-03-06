import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { toFolderPath, withPreviewQuery } from '@/shared/routes/dataroom-routes'

export const useOpenFilePreview = (folderId: string) => {
  const navigate = useNavigate()

  return useCallback(
    (fileId: string) => {
      navigate(`${toFolderPath(folderId)}${withPreviewQuery(fileId)}`)
    },
    [folderId, navigate],
  )
}
