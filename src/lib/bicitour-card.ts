// ── Tarjeta de recuerdo del Bicitour (dibujo en canvas, lado cliente) ──
// Genera una imagen vertical 1080x1350 lista para compartir. No captura el
// mapa Leaflet (evita CORS de las teselas): el trazado se dibuja estilizado
// a partir de las coordenadas GPS sobre un fondo institucional. La función
// de dibujo es pura respecto de sus datos: se puede validar con datos
// locales controlados sin tocar la base.

export interface BicitourMemoryCardData {
  routeTitle: string
  nickname: string
  team: string | null
  dateLabel: string
  score: number
  /** Posición final en el ranking (0 = no mostrar). */
  position: number
  totalParticipants: number
  stopsCompleted: number
  totalStops: number
  distanceKm: number
  badges: { emoji: string; name: string }[]
  /** Trazado GPS [lat, lng] (puede estar vacío). */
  track: [number, number][]
  /** Paradas [lat, lng] para marcar sobre el trazado. */
  stops: [number, number][]
}

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

const BLUE_DEEP = '#0b3e91'
const BLUE = '#126ff5'
const SKY = '#7db4f8'
const AMBER = '#ffc53d'
const WHITE = '#ffffff'

function projectPoints(points: [number, number][], box: { x: number; y: number; w: number; h: number }) {
  if (points.length === 0) return [] as { x: number; y: number }[]
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lat, lng] of points) {
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
  }
  const latSpan = Math.max(maxLat - minLat, 0.0005)
  const lngSpan = Math.max(maxLng - minLng, 0.0005)
  // Se conserva la proporción del recorrido dentro de la caja.
  const scale = Math.min(box.w / lngSpan, box.h / latSpan)
  const offsetX = box.x + (box.w - lngSpan * scale) / 2
  const offsetY = box.y + (box.h - latSpan * scale) / 2
  return points.map(([lat, lng]) => ({
    x: offsetX + (lng - minLng) * scale,
    y: offsetY + (maxLat - lat) * scale, // norte arriba
  }))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Dibuja la tarjeta completa. `logo` es opcional (si falla la carga, la
// tarjeta sale igual, sin romper).
export function drawBicitourMemoryCard(
  canvas: HTMLCanvasElement,
  data: BicitourMemoryCardData,
  logo: HTMLImageElement | null,
) {
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas sin contexto 2d')

  const font = (weight: string, size: number) => `${weight} ${size}px Arial, Helvetica, sans-serif`

  // Fondo institucional con degradado.
  const gradient = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT)
  gradient.addColorStop(0, BLUE_DEEP)
  gradient.addColorStop(0.55, '#0d55c4')
  gradient.addColorStop(1, BLUE)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // Encabezado: logo real de la muni (sin deformar) + marca.
  if (logo) {
    const logoHeight = 110
    const logoWidth = (logo.width / logo.height) * logoHeight
    ctx.fillStyle = 'rgba(255,255,255,0.95)'
    roundRect(ctx, 70, 60, logoWidth + 36, logoHeight + 28, 24)
    ctx.fill()
    ctx.drawImage(logo, 88, 74, logoWidth, logoHeight)
  }
  ctx.fillStyle = WHITE
  ctx.textAlign = 'right'
  ctx.font = font('800', 40)
  ctx.fillText('BICITOUR', CARD_WIDTH - 70, 110)
  ctx.font = font('400', 28)
  ctx.fillStyle = SKY
  ctx.fillText('San Miguel de Tucumán', CARD_WIDTH - 70, 150)

  // Título del recorrido + participante.
  ctx.textAlign = 'left'
  ctx.fillStyle = SKY
  ctx.font = font('700', 26)
  ctx.fillText(data.dateLabel.toUpperCase(), 70, 270)
  ctx.fillStyle = WHITE
  ctx.font = font('300', 56)
  const title = data.routeTitle.length > 34 ? `${data.routeTitle.slice(0, 33)}…` : data.routeTitle
  ctx.fillText(title, 70, 335)
  ctx.font = font('800', 44)
  ctx.fillStyle = AMBER
  const rider = data.team ? `${data.nickname} · ${data.team}` : data.nickname
  ctx.fillText(rider.length > 30 ? `${rider.slice(0, 29)}…` : rider, 70, 400)

  // Trazado estilizado del recorrido.
  const mapBox = { x: 110, y: 470, w: CARD_WIDTH - 220, h: 360 }
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, 70, 440, CARD_WIDTH - 140, 420, 28)
  ctx.fill()
  const trackPoints = projectPoints(data.track, mapBox)
  if (trackPoints.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.lineWidth = 18
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    trackPoints.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
    ctx.stroke()
    ctx.strokeStyle = AMBER
    ctx.lineWidth = 8
    ctx.stroke()
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = font('400', 30)
    ctx.textAlign = 'center'
    ctx.fillText('Recorrido guiado por la ciudad', CARD_WIDTH / 2, 660)
    ctx.textAlign = 'left'
  }
  // Paradas sobre el trazado (proyectadas junto con el track para compartir escala).
  if (data.stops.length > 0 && data.track.length > 1) {
    const combined = projectPoints([...data.track, ...data.stops], mapBox)
    const stopPoints = combined.slice(data.track.length)
    for (const point of stopPoints) {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 14, 0, Math.PI * 2)
      ctx.fillStyle = WHITE
      ctx.fill()
      ctx.beginPath()
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2)
      ctx.fillStyle = BLUE_DEEP
      ctx.fill()
    }
  }

  // Estadísticas.
  const stats: { value: string; label: string }[] = [
    { value: String(data.score), label: 'puntos' },
    { value: `${data.stopsCompleted}/${data.totalStops}`, label: 'paradas' },
    { value: `${data.distanceKm} km`, label: 'recorridos' },
  ]
  if (data.position > 0 && data.totalParticipants > 1) {
    stats.push({ value: `${data.position}º`, label: `de ${data.totalParticipants}` })
  }
  const statWidth = (CARD_WIDTH - 140) / stats.length
  stats.forEach((stat, index) => {
    const centerX = 70 + statWidth * index + statWidth / 2
    ctx.textAlign = 'center'
    ctx.fillStyle = WHITE
    ctx.font = font('800', 64)
    ctx.fillText(stat.value, centerX, 975)
    ctx.fillStyle = SKY
    ctx.font = font('400', 28)
    ctx.fillText(stat.label, centerX, 1015)
  })

  // Insignias obtenidas.
  ctx.textAlign = 'left'
  if (data.badges.length > 0) {
    let badgeX = 70
    const badgeY = 1075
    ctx.font = font('700', 30)
    for (const badge of data.badges.slice(0, 4)) {
      const text = `${badge.emoji} ${badge.name}`
      const width = ctx.measureText(text).width + 44
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      roundRect(ctx, badgeX, badgeY, width, 62, 31)
      ctx.fill()
      ctx.fillStyle = WHITE
      ctx.fillText(text, badgeX + 22, badgeY + 42)
      badgeX += width + 16
      if (badgeX > CARD_WIDTH - 200) break
    }
  }

  // Cierre institucional.
  ctx.textAlign = 'center'
  ctx.fillStyle = WHITE
  ctx.font = font('800', 40)
  ctx.fillText('¡Completé el Bicitour de San Miguel de Tucumán!', CARD_WIDTH / 2, 1230)
  ctx.fillStyle = SKY
  ctx.font = font('400', 28)
  ctx.fillText('busturistico.smt.gob.ar · @turismosmt', CARD_WIDTH / 2, 1280)
}

export async function loadCardLogo(src = '/logoMuni-sm.png'): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
}
