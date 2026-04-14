import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Bus Turístico Educativo | Municipalidad de San Miguel de Tucumán',
    template: '%s | Bus Turístico Educativo',
  },
  description:
    'Solicitud digital de turnos para visitas educativas en el Bus Turístico Educativo de la Municipalidad de San Miguel de Tucumán.',
  keywords: [
    'bus turístico educativo',
    'Municipalidad de San Miguel de Tucumán',
    'turnos escolares',
    'visitas educativas',
    'escuelas',
    'instituciones educativas',
    'turismo educativo',
  ],
  applicationName: 'Bus Turístico Educativo',
  authors: [{ name: 'Municipalidad de San Miguel de Tucumán' }],
  creator: 'Municipalidad de San Miguel de Tucumán',
  publisher: 'Municipalidad de San Miguel de Tucumán',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bus Turístico Educativo | Municipalidad de San Miguel de Tucumán',
    description:
      'Completá la solicitud de turnos para visitas educativas del Bus Turístico Educativo municipal.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'Bus Turístico Educativo',
    images: [
      {
        url: '/logo-muni.jpeg',
        width: 235,
        height: 235,
        alt: 'Logo de la Municipalidad de San Miguel de Tucumán',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Bus Turístico Educativo | Municipalidad de San Miguel de Tucumán',
    description:
      'Solicitud digital de turnos para visitas educativas del Bus Turístico Educativo municipal.',
    images: ['/logo-muni.jpeg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: '/icon.jpeg', type: 'image/jpeg' },
      { url: '/logo-muni.jpeg', type: 'image/jpeg' },
    ],
    apple: [{ url: '/icon.jpeg', type: 'image/jpeg' }],
    shortcut: ['/icon.jpeg'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
