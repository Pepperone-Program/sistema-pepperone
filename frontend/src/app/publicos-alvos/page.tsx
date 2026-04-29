import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function PublicosAlvosPage() {
  return <ResourcePage config={resources["publicos-alvos"]} />;
}
