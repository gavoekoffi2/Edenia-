import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/client";
import { EmptyState } from "@/components/ui";

export const metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-xl">🔔 Notifications</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          Uniquement des événements réels. EDENIA ne fabrique pas de notifications pour vous faire revenir.
        </p>
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="Rien pour l'instant" body="Vos matchs et vos messages apparaîtront ici." />
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link href={notification.href ?? "/app/decouvrir"} className="e-card p-3 block">
                <p className="font-semibold text-sm">{notification.title}</p>
                <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
                  {notification.body}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
