import { GuidePanel } from '@/components/bicitour/GuidePanel'

export default async function AdminBicitourSessionRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GuidePanel sessionId={Number(id)} />
}
