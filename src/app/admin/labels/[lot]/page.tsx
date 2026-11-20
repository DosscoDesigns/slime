import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { traceabilityConfigured, listPackLots } from "@/lib/traceability";
import { PACK_VARIANTS } from "@/lib/packaging";
import { fnskuBarcodeSvg, labelTitle } from "@/lib/fba-label";
import LabelSheet, { type LabelItem } from "./label-sheet";

export const dynamic = "force-dynamic";

export default async function Labels({ params }: { params: Promise<{ lot: string }> }) {
  await requireAdmin();
  if (!traceabilityConfigured()) notFound();
  const { lot } = await params;
  const lotCode = decodeURIComponent(lot);
  if (!/^MP-\d{6}-\d{2,}$/.test(lotCode)) notFound();

  const rows = await listPackLots(lotCode);
  if (rows.length === 0) notFound();

  const items: LabelItem[] = rows
    .filter((r) => r.fnsku)
    .map((r) => {
      const v = PACK_VARIANTS.find((x) => x.id === r.variantId);
      return {
        variantId: r.variantId,
        name: v?.name ?? r.variantId,
        title: labelTitle(v?.title ?? r.variantId),
        fnsku: r.fnsku!,
        kits: r.kits,
        svg: fnskuBarcodeSvg(r.fnsku!),
      };
    });

  return <LabelSheet lotCode={lotCode} packedOn={rows[0].packedOn} items={items} />;
}
