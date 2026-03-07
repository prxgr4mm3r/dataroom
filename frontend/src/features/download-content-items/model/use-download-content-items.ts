import { useMutation } from '@tanstack/react-query'

import { downloadBlob } from '@/shared/lib/file/download-blob'

import { downloadContentItems } from '../api/download-content-items'

export const useDownloadContentItems = () =>
  useMutation({
    mutationFn: downloadContentItems,
    onSuccess: ({ blob, filename }) => {
      downloadBlob(blob, filename)
    },
  })
