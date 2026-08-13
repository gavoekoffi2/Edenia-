import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { LEVELS, VERIFICATION_LEVELS } from "@/lib/verification/levels";
import { VerificationRequestForm } from "@/components/verification-form";
import { MONEY_WARNING } from "@/lib/trust/signals";
import { SafetyNotice } from "@/components/ui";

export const metadata = { title: "Confiance et sécurité", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();

  const [row, churches, requests] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        phoneVerified: true,
        emailVerified: true,
        identityVerification: { select: { status: true } },
        profileVerification: { select: { status: true } },
        churchVerification: { select: { status: true } },
      },
    }),
    prisma.church.findMany({ where: { isVerified: true }, orderBy: { name: "asc" } }),
    prisma.verificationRequest.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      take: 10,
    }),
  ]);

  const state = {
    phoneVerified: row?.phoneVerified ?? false,
    emailVerified: row?.emailVerified ?? false,
    identityStatus: row?.identityVerification?.status ?? "NONE",
    profileStatus: row?.profileVerification?.status ?? "NONE",
    churchStatus: row?.churchVerification?.status ?? "NONE",
  };

  const achieved = new Set(
    [
      state.phoneVerified ? "PHONE" : null,
      state.emailVerified ? "EMAIL" : null,
      state.identityStatus === "APPROVED" ? "IDENTITY" : null,
      state.profileStatus === "APPROVED" ? "PROFILE" : null,
      state.churchStatus === "APPROVED" ? "CHURCH" : null,
    ].filter(Boolean) as string[],
  );

  const pendingKinds = new Set(
    requests.filter((r) => ["PENDING", "IN_REVIEW", "NEED_MORE_INFO"].includes(r.status)).map((r) => r.kind),
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-xl">🛡️ Confiance et sécurité</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          La vérification est gratuite. Elle ne peut pas être achetée, ni accélérée par un abonnement.
        </p>
      </div>

      <SafetyNotice>{MONEY_WARNING}</SafetyNotice>

      <section className="space-y-2">
        {VERIFICATION_LEVELS.map((level) => {
          const descriptor = LEVELS[level];
          const done = achieved.has(level);
          const kind = level === "IDENTITY" ? "IDENTITY" : level === "PROFILE" ? "PROFILE" : level === "CHURCH" ? "CHURCH" : null;
          const pending = kind ? pendingKinds.has(kind) : false;

          return (
            <div key={level} className="e-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    <span aria-hidden="true">{descriptor.icon}</span> {descriptor.label}
                  </p>
                  <p className="text-sm mt-1">{descriptor.meaning}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
                    {descriptor.limitation}
                  </p>
                </div>
                {done ? (
                  <span className="e-chip e-chip-verified shrink-0">Obtenu</span>
                ) : pending ? (
                  <span className="e-chip shrink-0">En cours</span>
                ) : null}
              </div>

              {!done && !pending && kind && (
                <div className="mt-3">
                  <VerificationRequestForm
                    kind={kind as "IDENTITY" | "PROFILE" | "CHURCH"}
                    churches={churches.map((church) => ({ id: church.id, name: church.name }))}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>

      {requests.length > 0 && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Mes demandes</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {requests.map((request) => (
              <li key={request.id} className="flex justify-between gap-3">
                <span>{request.kind}</span>
                <span style={{ color: "var(--fg-muted)" }}>{request.status}</span>
              </li>
            ))}
          </ul>
          {requests.some((r) => r.messageToUser) && (
            <div className="mt-3 text-sm">
              {requests
                .filter((r) => r.messageToUser)
                .map((r) => (
                  <p key={r.id} style={{ color: "var(--fg-muted)" }}>
                    {r.messageToUser}
                  </p>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
