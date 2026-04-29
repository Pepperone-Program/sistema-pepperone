import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function UsuariosPage() {
  return <ResourcePage config={resources.usuarios} />;
}
