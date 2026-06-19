import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedAdminFromCookies } from '@/lib/admin-auth'
import { PHOTO_BOOK_BUCKET } from '@/lib/photo-books'
import { createServerSupabaseClient } from '@/lib/server-supabase'

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdminFromCookies()
  if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })

  const { id } = await context.params
  const supabase = createServerSupabaseClient()
  const { data: photos } = await supabase
    .from('photo_book_photos')
    .select('storage_path')
    .eq('book_id', id)

  const paths = (photos || []).map((photo) => photo.storage_path)
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(PHOTO_BOOK_BUCKET).remove(paths)
    if (storageError) {
      return NextResponse.json({ error: 'No se pudieron eliminar las fotos del almacenamiento.' }, { status: 500 })
    }
  }

  const { error } = await supabase.from('photo_books').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar el book.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

