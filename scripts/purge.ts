/**
 * Application des durees de retention (§47, docs/02 §5).
 *
 *   npm run purge -- --dry-run     inventaire, sans rien effacer
 *   npm run purge                  applique
 *
 * A programmer une fois par jour (cron, tache planifiee de l'hebergeur). La
 * commande est idempotente : la relancer deux fois de suite ne fait rien de
 * plus la seconde fois.
 */

import { runPurge } from "../src/lib/privacy/purge";
import { prisma } from "../src/lib/db/client";

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const report = await runPurge({ dryRun });

  console.log("");
  console.log(dryRun ? "🔍 Inventaire (aucune suppression)" : "🧹 Purge appliquée");
  console.log(`   ${report.at.toLocaleString("fr-FR")}`);
  console.log("");

  let total = 0;
  for (const step of report.steps) {
    total += step.affected;
    console.log(`   ${String(step.affected).padStart(6)}  ${step.step}`);
    console.log(`           ${step.detail}`);
  }

  console.log("");
  console.log(`   ${total} élément(s) ${dryRun ? "concernés" : "traités"}.`);
  console.log("");

  if (!dryRun) {
    await prisma.auditLog.create({
      data: {
        event: "DATA_PURGE",
        actorType: "SYSTEM",
        actorRef: "cron",
        metadata: JSON.stringify(report.steps),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
