import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function ProdutosPage() {
  return <ResourcePage config={resources.produtos} />;
}
