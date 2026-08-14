import { redirect } from "next/navigation";
import { adminGate } from "@/lib/admin/service";
import { AdminElevate } from "@/components/admin-elevate";

export const metadata = { title: "Back-office EDENIA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const gate = await adminGate();

  if (gate.state === "ANONYMOUS") redirect("/connexion?suivant=/admin");
  if (gate.state === "NOT_STAFF" || gate.state === "NO_ADMIN_RECORD") redirect("/app/decouvrir");
  if (gate.state === "DISABLED") redirect("/admin/desactive");
  if (gate.state === "SETUP_REQUIRED") redirect("/admin/configuration-requise");
  if (gate.state === "READY") redirect("/admin");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <AdminElevate displayName={gate.displayName} />
    </div>
  );
}
