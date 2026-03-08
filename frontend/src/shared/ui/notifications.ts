import { notifications } from '@mantine/notifications'

type NotifyOptions = {
  id?: string
}

export const notifySuccess = (message: string, options?: NotifyOptions): void => {
  notifications.show({ color: 'green', message, id: options?.id })
}

export const notifyError = (message: string, options?: NotifyOptions): void => {
  notifications.show({ color: 'red', message, id: options?.id })
}
