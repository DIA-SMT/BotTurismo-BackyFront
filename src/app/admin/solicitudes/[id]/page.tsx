import EducationalRequestDetailPage from '@/components/admin/EducationalRequestDetailPage'

export default async function AdminEducationalRequestDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EducationalRequestDetailPage requestId={id} />
}
