import type { Metadata } from 'next'
import { TouristExperience } from '@/components/tourist-bus/TouristExperience'

export const metadata: Metadata = {
  title: 'Bus Turístico | San Miguel de Tucumán',
  description:
    'Reservá tu lugar en los circuitos del Bus Turístico de San Miguel de Tucumán: salidas programadas, cupos limitados y reserva gratuita.',
}

export default function TouristBusPage() {
  return <TouristExperience />
}
