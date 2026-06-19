import PhotoGallery from './PhotoGallery'

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PhotoGallery token={token} />
}

