import DashboardShell from "../_components/dashboard-shell";
import { isCrmSectionSlug } from "../crm-sections";

type DashboardSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function DashboardSectionPage({
  params,
}: DashboardSectionPageProps) {
  const { section } = await params;

  return (
    <DashboardShell
      initialSectionSlug={isCrmSectionSlug(section) ? section : "suppliers"}
    />
  );
}