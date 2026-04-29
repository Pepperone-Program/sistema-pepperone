import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function ClientesPage() {
  return <ResourcePage config={resources.clientes} />;
}
