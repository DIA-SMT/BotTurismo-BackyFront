'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './bicitour-map.css'
import type { BicitourStopStatus } from '@/lib/bicitour'

// Mapa Leaflet con tiles de OpenStreetMap (sin API key). Importarlo siempre
// con next/dynamic y ssr:false, porque Leaflet necesita window.

export interface BicitourMapStop {
  id: number
  position: number
  title: string
  status: BicitourStopStatus
  lat: number
  lng: number
}

interface BicitourMapProps {
  stops: BicitourMapStop[]
  /** Traza preconfigurada del recorrido (gris punteado). */
  path?: [number, number][]
  /** Trazado real registrado por el GPS del guía (azul). */
  track?: [number, number][]
  /** Posición actual del guía (solo en el panel del guía). */
  guidePosition?: [number, number] | null
  onMapClick?: (lat: number, lng: number) => void
  height?: number
  /** Centro inicial si todavía no hay datos (default: centro de SMT). */
  fallbackCenter?: [number, number]
}

const SMT_CENTER: [number, number] = [-26.8305, -65.2038]

function markerClass(status: BicitourStopStatus) {
  if (status === 'open' || status === 'question_active' || status === 'question_closed') return 'bt-marker bt-marker--open'
  if (status === 'completed') return 'bt-marker bt-marker--completed'
  if (status === 'skipped') return 'bt-marker bt-marker--skipped'
  return 'bt-marker'
}

export default function BicitourMap({
  stops,
  path = [],
  track = [],
  guidePosition = null,
  onMapClick,
  height = 260,
  fallbackCenter = SMT_CENTER,
}: BicitourMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const didFitRef = useRef(false)
  const clickHandlerRef = useRef(onMapClick)
  clickHandlerRef.current = onMapClick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
    map.setView(fallbackCenter, 14)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => {
      clickHandlerRef.current?.(event.latlng.lat, event.latlng.lng)
    })
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
      didFitRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    if (path.length > 1) {
      L.polyline(path, { color: '#64748b', weight: 3, dashArray: '6 8', opacity: 0.7 }).addTo(layer)
    }
    if (track.length > 1) {
      L.polyline(track, { color: '#126ff5', weight: 4, opacity: 0.9 }).addTo(layer)
    }

    for (const stop of stops) {
      const icon = L.divIcon({
        className: '',
        html: `<span class="${markerClass(stop.status)}">${stop.status === 'completed' ? '✓' : stop.position}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })
      L.marker([stop.lat, stop.lng], { icon }).bindTooltip(stop.title, { direction: 'top' }).addTo(layer)
    }

    if (guidePosition) {
      const icon = L.divIcon({
        className: '',
        html: '<span class="bt-marker bt-marker--guide"></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })
      L.marker(guidePosition, { icon }).bindTooltip('Guía', { direction: 'top' }).addTo(layer)
    }

    // Encuadre inicial: una sola vez, cuando hay algo para mostrar.
    if (!didFitRef.current) {
      const boundsPoints: [number, number][] = [
        ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
        ...path,
        ...track,
      ]
      if (boundsPoints.length > 0) {
        didFitRef.current = true
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [30, 30], maxZoom: 16 })
      }
    }
  }, [stops, path, track, guidePosition])

  return <div ref={containerRef} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden' }} />
}
