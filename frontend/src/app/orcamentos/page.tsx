import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function OrcamentosPage() {
  return <ResourcePage config={resources.orcamentos} />;
}
