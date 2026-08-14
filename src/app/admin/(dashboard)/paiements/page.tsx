import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db/client";
import { formatXof } from "@/lib/premium/entitlements";
import { PAYMENT_STATUSES, STATUS_LABEL, type PaymentStatus } from "@/lib/payments/status";
import { formatPhone } from "@/lib/geo/phone";

export const dynamic = "force-dynamic";

/**
 * §20 — suivi des paiements.
 *
 * Ce que cet écran n'affiche JAMAIS : les clés API, le secret webhook, ou quoi
 * que ce soit permettant de rejouer une transaction. Il montre les références
 * de rapprochement, pas les moyens d'agir sur le compte marchand.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdminPage("payments.read");
  const params = await searchParams;

  const query = (params.q ?? "").trim();
  const status = (PAYMENT_STATUSES as readonly string[]).includes(params.status ?? "")
    ? (params.status as PaymentStatus)
    : null;

  // Recherche par référence EDENIA, référence GeniusPay, téléphone ou e-mail.
  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { orderRef: { contains: query } },
            { providerRef: { contains: query } },
            { user: { phone: { contains: query } } },
            { user: { email: { contains: query } } },
            { user: { profile: { firstName: { contains: query } } } },
          ],
        }
      : {}),
  };

  const [payments, totals] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        plan: true,
        subscription: true,
        user: { select: { id: true, phone: true, email: true, profile: { select: { firstName: true } } } },
        transactions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.payment.groupBy({ by: ["status"], _count: true, _sum: { amountCents: true } }),
  ]);

  const encaisse = totals.find((t) => t.status === "COMPLETED");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Paiements</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {formatXof(encaisse?._sum.amountCents ?? 0)} encaissés sur {encaisse?._count ?? 0} paiement
          {(encaisse?._count ?? 0) > 1 ? "s" : ""} confirmé{(encaisse?._count ?? 0) > 1 ? "s" : ""}.
        </p>
      </div>

      <form className="e-card p-3 flex flex-wrap gap-2 items-end" method="get">
        <div className="flex-1" style={{ minWidth: "14rem" }}>
          <label className="e-label" htmlFor="q">
            Rechercher
          </label>
          <input
            id="q"
            name="q"
            className="e-input"
            defaultValue={query}
            placeholder="Référence, téléphone, e-mail, prénom…"
          />
        </div>
        <div>
          <label className="e-label" htmlFor="status">
            Statut
          </label>
          <select id="status" name="status" className="e-input" defaultValue={status ?? ""}>
            <option value="">Tous</option>
            {PAYMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="e-btn e-btn-primary">
          Filtrer
        </button>
        {(query || status) && (
          <Link href="/admin/paiements" className="e-btn e-btn-ghost">
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        {totals.map((row) => (
          <div key={row.status} className="e-card p-3">
            <p className="e-display text-xl">{row._count}</p>
            <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
              {STATUS_LABEL[row.status as PaymentStatus] ?? row.status}
            </p>
          </div>
        ))}
      </div>

      {payments.length === 0 ? (
        <p className="e-card p-6 text-center text-sm" style={{ color: "var(--fg-muted)" }}>
          Aucun paiement.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <article key={payment.id} className="e-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {payment.user.profile?.firstName ?? "Sans profil"} · {formatXof(payment.amountCents)}{" "}
                    {payment.currency}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {payment.plan?.nameFr ?? payment.planCode ?? "—"} ·{" "}
                    {payment.createdAt.toLocaleString("fr-FR")} · {payment.method ?? "moyen non renseigné"}
                  </p>
                  <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--fg-muted)" }}>
                    EDENIA {payment.orderRef}
                    {payment.providerRef && ` · GeniusPay ${payment.providerRef}`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                    {payment.user.phone ? formatPhone(payment.user.phone) : (payment.user.email ?? "—")} ·{" "}
                    {payment.gateway} / {payment.environment}
                    {payment.subscription && ` · abonnement ${payment.subscription.status}`}
                  </p>
                </div>
                <span
                  className="e-chip shrink-0"
                  style={
                    payment.status === "COMPLETED"
                      ? { background: "var(--color-success-100)", color: "var(--color-success-600)" }
                      : payment.status === "FAILED" || payment.status === "EXPIRED"
                        ? { background: "var(--color-danger-100)", color: "var(--color-danger-500)" }
                        : undefined
                  }
                >
                  {STATUS_LABEL[payment.status as PaymentStatus] ?? payment.status}
                </span>
              </div>

              {payment.transactions.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs cursor-pointer" style={{ color: "var(--fg-muted)" }}>
                    Journal ({payment.transactions.length})
                  </summary>
                  <ul className="mt-1.5 text-xs space-y-1" style={{ color: "var(--fg-muted)" }}>
                    {payment.transactions.map((tx) => (
                      <li key={tx.id}>
                        {tx.createdAt.toLocaleString("fr-FR")} · {tx.source}
                        {tx.event && ` · ${tx.event}`} · {tx.fromStatus ?? "—"} → {tx.toStatus}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
        Les clés API et le secret webhook GeniusPay ne sont jamais affichés ici, ni accessibles depuis
        le back-office. Ils vivent uniquement dans les variables d'environnement du serveur.
      </p>
    </div>
  );
}
