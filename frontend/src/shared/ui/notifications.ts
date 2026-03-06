import { notifications } from '@mantine/notifications'

export const notifySuccess = (message: string): void => {
  notifications.show({ color: 'green', message })
}

export const notifyError = (message: string): void => {
  notifications.show({ color: 'red', message })
}
