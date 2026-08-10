"use client";

import { ResourcePage } from "@/components/admin/resource-page";
import { EntityProductsModal } from "@/components/admin/promotion-products-modal";
import { resources } from "@/config/resources";
import { useState } from "react";

export default function PublicosAlvosPage() {
  const [audience, setAudience] = useState<Record<string, unknown> | null>(null);
  return <><ResourcePage config={resources["publicos-alvos"]} onRowClick={setAudience} />{audience && <EntityProductsModal endpoint="/api/v1/publicos-alvos" entity={audience} entityIdField="id_publico_alvo" entityNameField="publico_alvo" eyebrow="Produtos do público-alvo" onClose={() => setAudience(null)} />}</>;
}
