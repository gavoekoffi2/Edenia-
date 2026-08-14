import { requireAdminPage } from "@/lib/admin/guard";
import { adminCan } from "@/lib/admin/service";
import { environmentSettings, listSettings } from "@/lib/settings/service";
import { AdminSettings } from "@/components/admin-settings";

export const metadata = { title: "Paramètres", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * §22 — réglages.
 *
 * La page distingue explicitement deux natures de configuration, parce que
 * l'inverse produit toujours la même scène : quelqu'un cherche pendant vingt
 * minutes pourquoi un interrupteur n'a aucun effet.
 */
export default async function Page() {
  const admin = await requireAdminPage("settings.read");
  const settings = await listSettings();
  const canWrite = adminCan(admin, "settings.write");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="e-display text-2xl">Paramètres</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {canWrite
            ? "Les réglages d'exploitation prennent effet immédiatement, sans redéploiement."
            : "Lecture seule : votre rôle ne permet pas de modifier ces réglages."}
        </p>
      </div>

      <AdminSettings
        canWrite={canWrite}
        isSuperAdmin={admin.role === "SUPER_ADMIN"}
        settings={settings.map((setting) => ({
          key: setting.key,
          label: setting.label,
          help: setting.help,
          type: setting.type,
          value: setting.value,
          isProtected: setting.isProtected,
          overridden: setting.overridden,
        }))}
      />

      <section>
        <h2 className="e-display text-lg mb-2">Configuration du serveur</h2>
        <div className="e-card p-4">
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            Ces valeurs ne se modifient pas depuis une interface web. Elles engagent de l&apos;argent ou la
            sécurité des comptes : les mettre à portée d&apos;un clic serait une faiblesse, pas un confort.
            Elles se changent dans la configuration du serveur, suivie d&apos;un redémarrage.
          </p>
          <ul className="mt-4 space-y-3">
            {environmentSettings().map((setting) => (
              <li key={setting.source} className="text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{setting.label}</span>
                  <span className="font-mono text-xs">
                    {setting.source} = {setting.value}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
                  {setting.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
