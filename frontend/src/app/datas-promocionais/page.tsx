import { ResourcePage } from "@/components/admin/resource-page";
import { resources } from "@/config/resources";

export default function DatasPromocionaisPage() {
  return <ResourcePage config={resources["datas-promocionais"]} />;
}
