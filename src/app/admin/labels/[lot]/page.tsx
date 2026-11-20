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
  // The path segment is the packing run number.
  if (!/^\d{1,6}$/.test(lot)) notFound();

  const rows = await listPackLots(Number(lot));
  if (rows.length === 0) notFound();

  const items: LabelItem[] = rows
    .filter((r) => r.fnsku)
    .map((r) => {
      const v = PACK_VARIANTS.find((x) => x.id === r.variantId);
      return {
        key: String(r.id),
        lotCode: r.lotCode,
        variantId: r.variantId,
        name: v?.name ?? r.variantId,
        title: labelTitle(v?.title ?? r.variantId),
        fnsku: r.fnsku!,
        kits: r.kits,
        svg: fnskuBarcodeSvg(r.fnsku!),
      };
    });

  return <LabelSheet packedOn={rows[0].packedOn} items={items} />;
}
