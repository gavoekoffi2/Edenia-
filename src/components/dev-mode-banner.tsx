import { DEV_OTP_CODE, serviceStatuses, showDevIndicator } from "@/lib/config/mode";

/**
 * §10 de la phase pilote : il doit être impossible de confondre l'environnement
 * de test avec la production.
 *
 * Ce bandeau n'existe que dans le back-office, et `showDevIndicator` est
 * toujours faux en production — le composant ne rend alors rien du tout.
 */
export function DevModeBanner() {
  if (!showDevIndicator) return null;

  const simulated = serviceStatuses().filter((service) => service.mode === "development");

  return (
    <div
      className="border-b"
      style={{ background: "var(--color-gold-100)", borderColor: "var(--color-gold-400)", color: "#5c3d10" }}
      role="status"
    >
      <div className="mx-auto max-w-5xl px-4 py-2.5 text-sm">
        <p className="font-bold">🟡 DEVELOPMENT MODE — ceci n'est pas la production</p>
        <p className="mt-1 text-xs">
          Services simulés : {simulated.map((service) => service.label).join(", ")}. Code OTP de test :{" "}
          <strong>{DEV_OTP_CODE}</strong>. Les données présentes peuvent être fictives.
        </p>
      </div>
    </div>
  );
}
