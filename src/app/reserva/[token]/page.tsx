import type { Metadata } from 'next'
import { BookingCancelClient } from './BookingCancelClient'

export const metadata: Metadata = {
  title: 'Mi reserva | Bus Turístico',
  robots: { index: false, follow: false },
}

export default async function BookingCancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <BookingCancelClient token={token} />
}
