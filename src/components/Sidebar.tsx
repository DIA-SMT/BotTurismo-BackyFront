'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Bot, HelpCircle, LayoutDashboard, LogOut, Menu, MessageSquare, X } from 'lucide-react'

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'Resumen' },
  { href: '/admin/interactions', icon: MessageSquare, label: 'Interacciones' },
  { href: '/admin/faqs', icon: HelpCircle, label: 'Preguntas frecuentes' },
  { href: '/admin/solicitudes', icon: HelpCircle, label: 'Solicitudes educativas' },
]

export default function Sidebar({ currentUserEmail }: { currentUserEmail?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <>
      <button className="hamburger" onClick={() => setOpen((current) => !current)} aria-label={open ? 'Cerrar menú' : 'Abrir menú'}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} style={{ pointerEvents: open ? 'auto' : 'none' }} aria-hidden />

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/Logo%20SMT%20blanco%402x.png"
            alt="Logo SMT"
            style={{ width: 160, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 10px' }}
          />
          <h1>Bus turístico educativo</h1>
          <p>Panel de monitoreo y gestión</p>
          {currentUserEmail ? <p style={{ marginTop: 10, color: 'var(--text-secondary)' }}>{currentUserEmail}</p> : null}
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Panel</div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className={`nav-link ${isActive ? 'active' : ''}`}>
                <Icon />
                {item.label}
              </Link>
            )
          })}

          <div className="sidebar-section-label" style={{ marginTop: 20 }}>
            Accesos rápidos
          </div>
          <a href="https://manychat.com/live" target="_blank" rel="noopener noreferrer" className="nav-link">
            <Bot />
            ManyChat Live Chat
            <span className="badge">↗</span>
          </a>
          <a href="https://agendaculturalsmt.com" target="_blank" rel="noopener noreferrer" className="nav-link">
            <span style={{ fontSize: 18 }}>🎭</span>
            Agenda Cultural
            <span className="badge">↗</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout} disabled={loggingOut}>
            <LogOut size={14} />
            {loggingOut ? 'Saliendo...' : 'Cerrar sesión'}
          </button>
        </div>
      </aside>
    </>
  )
}
