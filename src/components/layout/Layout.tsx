import { Outlet } from 'react-router-dom'
import { ToastContainer } from '@/components/ui/Toast'

export function Layout() {
  return (
    <div className="flex h-dvh flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <Outlet />
      <ToastContainer />
    </div>
  )
}
