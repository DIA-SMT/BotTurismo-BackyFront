'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, MessageSquare, HelpCircle, Bot, Menu, X } from 'lucide-react'

const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Resumen' },
    { href: '/interactions', icon: MessageSquare, label: 'Interacciones' },
    { href: '/faqs', icon: HelpCircle, label: 'Preguntas Frecuentes' },
]

export default function Sidebar() {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)

    // Close sidebar on route change (mobile nav)
    useEffect(() => { setOpen(false) }, [pathname])

    // Close on Escape key
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Prevent body scroll when sidebar open on mobile
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : ''
        return () => { document.body.style.overflow = '' }
    }, [open])

    return (
        <>
            {/* Hamburger button — only visible on mobile via CSS */}
            <button
                className="hamburger"
                onClick={() => setOpen(o => !o)}
                aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            >
                {open ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Overlay — closes sidebar when tapping outside */}
            <div
                className={`sidebar-overlay ${open ? 'open' : ''}`}
                onClick={() => setOpen(false)}
                style={{ pointerEvents: open ? 'auto' : 'none' }}
                aria-hidden
            />

            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/Logo%20SMT%20blanco%402x.png"
                        alt="Logo SMT"
                        style={{ width: 160, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 10px' }}
                    />
                    <h1>Bot Turístico SMT</h1>
                    <p>Panel de Monitoreo</p>
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-section-label">Panel</div>
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-link ${isActive ? 'active' : ''}`}
                            >
                                <Icon />
                                {item.label}
                            </Link>
                        )
                    })}

                    <div className="sidebar-section-label" style={{ marginTop: 20 }}>Accesos Rápidos</div>
                    <a
                        href="https://manychat.com/live"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-link"
                    >
                        <Bot />
                        ManyChat Live Chat
                        <span className="badge">↗</span>
                    </a>
                    <a
                        href="https://agendaculturalsmt.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="nav-link"
                    >
                        <span style={{ fontSize: 18 }}>🎭</span>
                        Agenda Cultural
                        <span className="badge">↗</span>
                    </a>
                </nav>

                <div className="sidebar-footer">
                    <p><span className="status-dot" />Bot activo · SMT Tucumán</p>
                </div>
            </aside>
        </>
    )
}
