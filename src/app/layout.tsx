import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Bus Turístico | Municipalidad de San Miguel de Tucumán',
    template: '%s | Municipalidad de San Miguel de Tucumán',
  },
  description:
    'Circuitos del Bus Turístico de San Miguel de Tucumán: salidas programadas para turistas y vecinos, y turnos institucionales del Bus Educativo para escuelas.',
  keywords: [
    'bus turístico',
    'bus turístico educativo',
    'Municipalidad de San Miguel de Tucumán',
    'circuitos turísticos',
    'turnos escolares',
    'visitas educativas',
    'turismo Tucumán',
  ],
  applicationName: 'Bus Turístico SMT',
  authors: [{ name: 'Municipalidad de San Miguel de Tucumán' }],
  creator: 'Municipalidad de San Miguel de Tucumán',
  publisher: 'Municipalidad de San Miguel de Tucumán',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Bus Turístico | Municipalidad de San Miguel de Tucumán',
    description:
      'Reservá tu lugar en los circuitos del Bus Turístico o solicitá un turno institucional del Bus Educativo.',
    type: 'website',
    locale: 'es_AR',
    siteName: 'Bus Turístico SMT',
    images: [
      {
        url: '/logoMuni-sm.png',
        width: 235,
        height: 235,
        alt: 'Logo de la Municipalidad de San Miguel de Tucumán',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Bus Turístico | Municipalidad de San Miguel de Tucumán',
    description:
      'Reservá tu lugar en los circuitos del Bus Turístico o solicitá un turno institucional del Bus Educativo.',
    images: ['/logoMuni-sm.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: '/logoMuni-sm.png', type: 'image/png' }],
    apple: [{ url: '/logoMuni-sm.png', type: 'image/png' }],
    shortcut: ['/logoMuni-sm.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
