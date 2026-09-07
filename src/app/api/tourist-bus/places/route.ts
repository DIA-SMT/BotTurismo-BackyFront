import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

// Autocompletado de procedencia (pedido de turismo, 2026-09-07): busca
// localidades reales de todo el mundo en Photon (geocoder libre sobre datos de
// OpenStreetMap, sin API key) y las devuelve como "Ciudad / Provincia / País".
// Es un proxy para no exponer el servicio externo al navegador y para filtrar
// el ruido (plazas, museos, etc.). Si Photon no responde, el formulario acepta
// texto libre para no bloquear reservas.

const localityTypes = new Set([
  'city',
  'town',
  'village',
  'hamlet',
  'municipality',
  'suburb',
  'borough',
  'quarter',
  'locality',
])

interface PhotonFeature {
  properties?: {
    name?: string
    state?: string
    country?: string
    osm_value?: string
  }
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2 || q.length > 80) {
    return NextResponse.json({ data: [] })
  }

  try {
    const url = new URL('https://photon.komoot.io/api/')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '12')
    url.searchParams.set('lang', 'default')
    url.searchParams.set('osm_tag', 'place')
    // Sesgo geográfico hacia San Miguel de Tucumán: los lugares cercanos
    // aparecen primero (la mayoría de los visitantes son de la región).
    url.searchParams.set('lat', '-26.83')
    url.searchParams.set('lon', '-65.2')

    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error(`photon ${response.status}`)
    const payload = (await response.json()) as { features?: PhotonFeature[] }

    const labels: string[] = []
    for (const feature of payload.features || []) {
      const props = feature.properties || {}
      if (!props.name || !localityTypes.has(props.osm_value || '')) continue
      const parts = [props.name, props.state, props.country]
        .filter((part): part is string => Boolean(part && part.trim()))
        // Evita "Buenos Aires / Buenos Aires / Argentina".
        .filter((part, index, all) => all.indexOf(part) === index)
      const label = parts.join(' / ')
      if (!labels.includes(label)) labels.push(label)
      if (labels.length >= 6) break
    }

    return NextResponse.json({ data: labels })
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
}
