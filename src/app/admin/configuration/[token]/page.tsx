import { prisma } from "@/lib/db/client";
import { newEnrollment, readInvitation } from "@/lib/admin/service";
import { formatSecretForDisplay } from "@/lib/admin/totp";
import { qrSvg } from "@/lib/admin/qr";
import { ROLE_LABEL, type Role } from "@/lib/auth/rbac";
import { AdminSetup } from "@/components/admin-setup";

export const metadata = { title: "Configuration du compte", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * §9 — page de configuration d'un compte interne, atteinte par un lien à usage
 * unique.
 *
 * Elle vit hors du layout du back-office : la personne n'a pas encore
 * d'identifiants, donc pas encore accès aux écrans d'administration.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await readInvitation(token);

  if (!target) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="e-card p-6">
          <h1 className="e-display text-xl">Lien invalide</h1>
          <p className="text-sm mt-2" style={{ color: "var(--fg-muted)" }}>
            Ce lien de configuration est expiré, déjà utilisé, ou n&apos;a jamais existé. Demandez-en un
            nouveau à l&apos;administrateur principal — lui seul peut en émettre.
          </p>
        </div>
      </div>
    );
  }

  const account = await prisma.user.findUnique({
    where: { id: target.userId },
    select: { email: true, phone: true },
  });

  // Le secret n'est pas encore enregistré : il ne le sera qu'une fois le
  // premier code validé. Un lien ouvert puis abandonné ne laisse donc rien
  // derrière lui.
  const label = account?.email ?? account?.phone ?? target.displayName;
  const enrollment = newEnrollment(label);
  const svg = await qrSvg(enrollment.otpauthUri);

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <AdminSetup
        token={token}
        displayName={target.displayName}
        roleLabel={ROLE_LABEL[target.roleCode as Role] ?? target.roleCode}
        secret={enrollment.secret}
        secretDisplay={formatSecretForDisplay(enrollment.secret)}
        qrSvg={svg}
      />
    </div>
  );
}
