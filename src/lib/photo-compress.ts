// Compresión de fotos en el navegador del guía, ANTES de subirlas.
//
// Por qué: las fotos salían del celular con 4 a 12 MB y se guardaban tal cual.
// La galería pública las servía enteras a cada turista, lo que agotó la cuota
// de egress de Supabase (2026-10-10) y además hacía lentísima la carga desde
// datos móviles. Ahora de cada foto se suben dos versiones livianas.
//
// Solo corre en el cliente (usa canvas).

export const PHOTO_FULL_MAX_SIDE = 1920
export const PHOTO_THUMB_MAX_SIDE = 600
const FULL_QUALITY = 0.82
const THUMB_QUALITY = 0.7

export interface CompressedPhoto {
  full: Blob
  thumb: Blob
  originalName: string
  originalSize: number
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap decodifica fuera del hilo principal (no traba la UI) y
  // entiende el EXIF de orientación de los celulares.
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  }
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('no se pudo leer la imagen'))
    }
    image.src = url
  })
}

function drawResized(source: ImageBitmap | HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const width = 'width' in source ? source.width : 0
  const height = 'height' in source ? source.height : 0
  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('sin canvas 2d'))
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('no se pudo comprimir'))),
      'image/jpeg',
      quality,
    )
  })
}

// Devuelve la versión grande (para ver y descargar) y la miniatura (grilla).
// Si algo falla, se devuelve null y el llamador sube el archivo original.
export async function compressPhoto(file: File): Promise<CompressedPhoto | null> {
  try {
    const bitmap = await loadBitmap(file)
    const [full, thumb] = await Promise.all([
      drawResized(bitmap, PHOTO_FULL_MAX_SIDE, FULL_QUALITY),
      drawResized(bitmap, PHOTO_THUMB_MAX_SIDE, THUMB_QUALITY),
    ])
    if ('close' in bitmap) bitmap.close()
    // Si comprimir no achicó nada (foto ya chica), igual sirve: unifica el
    // formato a JPEG y garantiza que exista miniatura.
    return { full, thumb, originalName: file.name, originalSize: file.size }
  } catch {
    return null
  }
}

// Nombre que se guarda: siempre .jpg porque la compresión unifica el formato
// (importante para los HEIC de iPhone, que muchos navegadores no muestran).
export function compressedFileName(originalName: string) {
  const base = originalName.replace(/\.[^/.]+$/, '') || 'foto'
  return `${base}.jpg`
}
