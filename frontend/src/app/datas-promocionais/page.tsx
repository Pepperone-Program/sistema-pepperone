"use client";
import { ResourcePage } from "@/components/admin/resource-page";
import { PromotionProductsModal } from "@/components/admin/promotion-products-modal";
import { resources } from "@/config/resources";
import { useState } from "react";

export default function DatasPromocionaisPage() {
  const [promotion, setPromotion] = useState<Record<string, unknown> | null>(null);
  return <><ResourcePage config={resources["datas-promocionais"]} onRowClick={setPromotion} />{promotion && <PromotionProductsModal promotion={promotion} onClose={() => setPromotion(null)} />}</>;
}
