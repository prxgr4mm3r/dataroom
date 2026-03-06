import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type PropsWithChildren } from 'react'

const makeClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  })

export const AppQueryClientProvider = ({ children }: PropsWithChildren) => {
  const [client] = useState(makeClient)

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
