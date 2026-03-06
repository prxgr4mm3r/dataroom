import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { toFolderPath } from '@/shared/routes/dataroom-routes'

export const useCloseFilePreview = (folderId: string) => {
  const navigate = useNavigate()

  return useCallback(() => {
    navigate(toFolderPath(folderId))
  }, [folderId, navigate])
}
