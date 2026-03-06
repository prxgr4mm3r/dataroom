import type { ReactNode } from 'react'

import './app-shell.css'

type AppShellProps = {
  sidebar: ReactNode
  toolbar: ReactNode
  breadcrumbs: ReactNode
  content: ReactNode
  bulkActions: ReactNode
}

export const AppShell = ({ sidebar, toolbar, breadcrumbs, content, bulkActions }: AppShellProps) => (
  <div className="dataroom-shell">
    <div className="dataroom-shell__frame">
      <aside className="dataroom-shell__sidebar">{sidebar}</aside>
      <header className="dataroom-shell__toolbar">{toolbar}</header>
      <section className="dataroom-shell__breadcrumbs">{breadcrumbs}</section>
      <main className="dataroom-shell__body">{content}</main>
      <footer className="dataroom-shell__bulk">{bulkActions}</footer>
    </div>
  </div>
)
