/**
 * Commande d'administration des comptes internes.
 *
 *   npm run admin:create -- --email=vous@exemple.com --name="Votre nom"
 *   npm run admin:reset  -- --email=vous@exemple.com
 *   npm run admin:list
 *
 * Pourquoi une commande plutot qu'un compte cree par le seed :
 *
 * Un compte administrateur livre avec un mot de passe — meme genere, meme
 * documente — est un mot de passe qui existe quelque part avant que son
 * proprietaire ne l'ait choisi. Ici, rien de tel. La commande cree le compte
 * **sans aucun identifiant** et imprime un lien a usage unique, valable 72
 * heures. Le mot de passe et le second facteur sont definis par la personne
 * elle-meme, dans le navigateur, et ne transitent jamais par ce terminal.
 *
 * Il n'existe aucun mot de passe universel, aucun compte cache, aucun endpoint
 * de contournement : la seule facon d'ouvrir le back-office est de posseder un
 * compte actif, son mot de passe et son second facteur.
 */

import { PrismaClient } from "@prisma/client";
import { issueInvitation } from "../src/lib/admin/invitations";
import { permissionsFor, ROLES, ROLE_LABEL, type Role } from "../src/lib/auth/rbac";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found?.slice(prefix.length);
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function ensureRoles(): Promise<void> {
  for (const role of ROLES) {
    if (role === "USER") continue;
    await prisma.adminRole.upsert({
      where: { code: role },
      create: {
        code: role,
        nameFr: ROLE_LABEL[role],
        permissionsJson: JSON.stringify(permissionsFor(role)),
      },
      update: { permissionsJson: JSON.stringify(permissionsFor(role)) },
    });
  }
}

async function create(): Promise<void> {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const roleCode = (arg("role")?.trim().toUpperCase() ?? "SUPER_ADMIN") as Role;

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage : npm run admin:create -- --email=vous@exemple.com --name=\"Votre nom\" [--role=ADMIN]");
    process.exitCode = 1;
    return;
  }
  if (!name) {
    console.error("Le nom affiché est obligatoire (--name).");
    process.exitCode = 1;
    return;
  }
  if (!ROLES.includes(roleCode) || roleCode === "USER") {
    console.error(`Rôle inconnu : ${roleCode}. Valeurs possibles : ${ROLES.filter((r) => r !== "USER").join(", ")}`);
    process.exitCode = 1;
    return;
  }

  await ensureRoles();

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, emailVerified: true, role: roleCode, status: "ACTIVE" },
    update: { role: roleCode, status: "ACTIVE" },
  });

  const admin = await prisma.adminUser.upsert({
    where: { userId: user.id },
    create: { userId: user.id, displayName: name, roleCode, isActive: true },
    update: { displayName: name, roleCode, isActive: true },
  });

  const invitation = await issueInvitation(admin.id, null);

  console.log("");
  console.log(`✅ Compte ${ROLE_LABEL[roleCode]} prêt pour ${email}`);
  console.log("");
  console.log("   Lien de configuration, à usage unique :");
  console.log(`   ${baseUrl()}${invitation.path}`);
  console.log("");
  console.log(`   Valable jusqu'au ${invitation.expiresAt.toLocaleString("fr-FR")}.`);
  console.log("   Ce lien ne sera plus jamais affiché. S'il est perdu :");
  console.log(`   npm run admin:reset -- --email=${email}`);
  console.log("");
  console.log("   Étapes dans le navigateur :");
  console.log("     1. se connecter à EDENIA avec cette adresse e-mail (code par e-mail) ;");
  console.log("     2. ouvrir le lien ci-dessus ;");
  console.log("     3. choisir un mot de passe (12 caractères minimum) ;");
  console.log("     4. scanner le QR code avec une application d'authentification ;");
  console.log("     5. conserver les 10 codes de récupération affichés une seule fois.");
  console.log("");
}

async function reset(): Promise<void> {
  const email = arg("email")?.trim().toLowerCase();
  if (!email) {
    console.error("Usage : npm run admin:reset -- --email=vous@exemple.com");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { adminProfile: true } });
  if (!user?.adminProfile) {
    console.error(`Aucun compte interne pour ${email}.`);
    process.exitCode = 1;
    return;
  }

  await prisma.adminUser.update({
    where: { id: user.adminProfile.id },
    data: {
      passwordHash: null,
      passwordSetAt: null,
      mfaSecretEnc: null,
      mfaEnabledAt: null,
      mfaRecoveryHashes: "[]",
      failedLogins: 0,
      lockedUntil: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      event: "ADMIN_CREDENTIALS_RESET_CLI",
      actorType: "SYSTEM",
      actorRef: "cli",
      metadata: JSON.stringify({ adminUserId: user.adminProfile.id }),
    },
  });

  const invitation = await issueInvitation(user.adminProfile.id, null);

  console.log("");
  console.log(`🔁 Identifiants effacés pour ${email}. Mot de passe et second facteur à redéfinir.`);
  console.log("");
  console.log(`   ${baseUrl()}${invitation.path}`);
  console.log(`   Valable jusqu'au ${invitation.expiresAt.toLocaleString("fr-FR")}.`);
  console.log("");
  console.log("   Cette opération est tracée dans le journal d'audit.");
  console.log("");
}

async function list(): Promise<void> {
  const admins = await prisma.adminUser.findMany({
    include: { user: { select: { email: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (admins.length === 0) {
    console.log("Aucun compte interne. Créez-en un : npm run admin:create -- --email=… --name=…");
    return;
  }

  console.log("");
  for (const admin of admins) {
    const state = !admin.isActive
      ? "désactivé"
      : !admin.passwordHash || !admin.mfaEnabledAt
        ? "configuration en attente"
        : "actif";
    console.log(
      `  ${admin.displayName.padEnd(24)} ${admin.roleCode.padEnd(20)} ${String(admin.user.email ?? "—").padEnd(28)} ${state}`,
    );
  }
  console.log("");
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case "create":
      await create();
      break;
    case "reset":
      await reset();
      break;
    case "list":
      await list();
      break;
    default:
      console.error("Commandes : create | reset | list");
      process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
