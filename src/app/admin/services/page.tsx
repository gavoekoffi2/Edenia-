import { requirePermission } from "@/lib/auth/current-user";
import { DEV_OTP_CODE, isDevAuth, serviceStatuses } from "@/lib/config/mode";

export const dynamic = "force-dynamic";

/**
 * §10 de la phase pilote — état des services externes.
 *
 * Cet écran existe pour qu'on ne puisse jamais se demander « est-ce que les SMS
 * partent vraiment ? ». Chaque service dit son mode, ce qu'il fait réellement,
 * et s'il reste à brancher avant la bêta.
 */
export default async function Page() {
  await requirePermission("analytics.read");
  const services = serviceStatuses();
  const pending = services.filter((service) => service.pendingRealIntegration);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-2xl">Services externes</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {pending.length} service{pending.length > 1 ? "s" : ""} à brancher avant la bêta.
        </p>
      </div>

      <div className="space-y-2">
        {services.map((service) => (
          <div key={service.key} className="e-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{service.label}</p>
                <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                  {service.detail}
                </p>
              </div>
              <span
                className="e-chip shrink-0"
                style={
                  service.mode === "development"
                    ? { background: "var(--color-gold-100)", borderColor: "var(--color-gold-400)", color: "#7a5216" }
                    : { background: "var(--color-success-100)", color: "var(--color-success-600)" }
                }
              >
                {service.mode === "development" ? "🟡 TEST" : "🟢 PRODUCTION"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {isDevAuth && (
        <section className="e-card p-4">
          <h2 className="e-display text-lg">Comment tester l'authentification</h2>
          <ol className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--fg-muted)" }}>
            <li>1. Aller sur /inscription et saisir un numéro togolais (8 chiffres, commençant par 7 ou 9).</li>
            <li>
              2. Le code de test est toujours <strong>{DEV_OTP_CODE}</strong>. Il est aussi affiché à l'écran.
            </li>
            <li>3. Aucun SMS n'est envoyé, et aucune passerelle n'est appelée.</li>
          </ol>
          <p className="text-xs mt-3" style={{ color: "var(--fg-muted)" }}>
            Le code reste haché, salé, comparé à temps constant, limité en tentatives et soumis à
            expiration — exactement comme en production. Seule sa valeur est prévisible. En production,
            l'application refuse de démarrer si AUTH_MODE vaut « development ».
          </p>
        </section>
      )}
    </div>
  );
}
