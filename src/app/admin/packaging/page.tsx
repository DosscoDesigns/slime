import { requireAdmin } from "@/lib/admin-session";
import Planner from "./planner";

export const dynamic = "force-dynamic";

export default async function Packaging() {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Packaging planner</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter the pouches you have of each color, pick a starting plan, then adjust
          the kit counts. Every kit is 20, 40 or 80 gallons at one pouch per 5 gallons.
        </p>
      </header>
      <Planner />
    </main>
  );
}
