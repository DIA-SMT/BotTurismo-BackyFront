import type { Metadata } from 'next'
import { ParticipantExperience } from '@/components/bicitour/ParticipantExperience'

export const metadata: Metadata = {
  title: 'Bicitour en vivo | San Miguel de Tucumán',
  description: 'Sumate al Bicitour de la Municipalidad de San Miguel de Tucumán: historia, juego y recorrido en vivo.',
  robots: { index: false, follow: false },
}

export default async function BicitourSessionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <ParticipantExperience code={code.toUpperCase()} />
}
