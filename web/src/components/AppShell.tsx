import { Outlet } from 'react-router-dom'
import { Hero } from './Hero'
import { Sidebar } from './Sidebar'
import { CoachBubble } from './CoachBubble'

export function AppShell() {
  return (
    <div className="flex h-full flex-col bg-bg">
      <Hero />
      <div className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-[1100px]">
          <Sidebar />
          <main className="flex-1 overflow-y-auto px-5 pb-10 pt-5">
            <Outlet />
          </main>
        </div>
      </div>
      <CoachBubble />
    </div>
  )
}
