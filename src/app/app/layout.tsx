import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { BrandLink } from "@/components/brand";
import { TabBar } from "@/components/tabbar";
import { getSetting } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "EDENIA",
  // §54 : l'application n'est jamais indexee.
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  if (user.status === "SUSPENDED") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="e-card p-6 max-w-sm text-center">
          <h1 className="e-display text-xl">Votre compte est suspendu</h1>
          <p className="text-sm mt-3" style={{ color: "var(--fg-muted)" }}>
            Un examen est en cours. Vous serez informé(e) de la décision. Pour toute question :
            support@edenia.app
          </p>
        </div>
      </div>
    );
  }

  const [unreadNotifications, unreadMessages, banner] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.message.count({
      where: {
        readAt: null,
        senderId: { not: user.id },
        conversation: {
          match: { OR: [{ userAId: user.id }, { userBId: user.id }], status: "ACTIVE" },
        },
      },
    }),
    // §22 — bandeau d'information posé depuis le back-office. Vide = rien.
    getSetting("comm.banner"),
  ]);

  return (
    <div className="min-h-screen flex flex-col" style={{ paddingBottom: "4.5rem" }}>
      <header
        className="sticky top-0 z-30 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg)" }}
      >
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
          <BrandLink href="/app/decouvrir" />
          <div className="flex items-center gap-1">
            <Link href="/app/notifications" className="e-btn e-btn-ghost relative" aria-label="Notifications">
              🔔
              {unreadNotifications > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 text-[0.625rem] rounded-full px-1.5 font-bold"
                  style={{ background: "var(--color-clay-500)", color: "#fff" }}
                >
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </Link>
            <Link href="/app/parametres" className="e-btn e-btn-ghost" aria-label="Paramètres">
              ⚙️
            </Link>
          </div>
        </div>
      </header>

      {banner.trim() && (
        <p
          className="mx-auto w-full max-w-2xl px-4 py-2.5 text-sm"
          role="status"
          style={{ background: "var(--color-gold-100)", color: "#7a5216" }}
        >
          {banner}
        </p>
      )}

      <main id="contenu" className="flex-1 mx-auto w-full max-w-2xl px-4 py-5">
        {children}
      </main>

      <TabBar unreadMessages={unreadMessages} />
    </div>
  );
}
