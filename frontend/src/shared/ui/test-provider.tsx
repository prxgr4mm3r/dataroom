import { MantineProvider } from '@mantine/core'
import type { PropsWithChildren } from 'react'

export const TestProvider = ({ children }: PropsWithChildren) => {
  return <MantineProvider>{children}</MantineProvider>
}
