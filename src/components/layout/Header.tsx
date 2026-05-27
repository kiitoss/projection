import { Menu, Zap, LogOut, Settings, WifiOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useAppStore } from '@/store/useAppStore'
import { useOffline } from '@/hooks/useOffline'
import { Button } from '@/components/ui/Button'
import { useState, useRef, useEffect } from 'react'

interface HeaderProps {
  onNewProject?: () => void
  onRegenerateAll?: () => void
  hasWidgets?: boolean
}

export function Header({ onNewProject, onRegenerateAll, hasWidgets }: HeaderProps) {
  const { user, signOut } = useAuth()
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const isOffline = useOffline()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { t } = useTranslation()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const initials = user?.email?.charAt(0).toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
        aria-label={t('header.menu')}
      >
        <Menu size={20} />
      </button>

      <Link to="/" className="text-base font-semibold text-slate-900 dark:text-slate-100 mr-auto">
        Projection
      </Link>

      {isOffline && (
        <span className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
          <WifiOff size={12} />
          {t('header.offline')}
        </span>
      )}

      {hasWidgets && onRegenerateAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRegenerateAll}
          className="hidden sm:inline-flex"
          title={t('header.regenerateWidgets')}
        >
          <Zap size={15} />
          <span className="hidden md:inline">{t('header.widgets')}</span>
        </Button>
      )}

      {onNewProject && (
        <Button variant="primary" size="sm" onClick={onNewProject}>
          {t('header.newProject')}
        </Button>
      )}

      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          aria-label={t('header.userMenu')}
        >
          {initials}
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
            <hr className="my-1 border-slate-100 dark:border-slate-700" />
            <button
              onClick={() => { navigate('/settings'); setMenuOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Settings size={14} />
              {t('header.settings')}
            </button>
            <button
              onClick={() => { signOut(); setMenuOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <LogOut size={14} />
              {t('header.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
