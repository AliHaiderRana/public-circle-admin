import TemplateEditorPage from '@/components/templates/TemplateEditorPage';

export default async function EditSampleTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorPage templateId={id} />;
}
