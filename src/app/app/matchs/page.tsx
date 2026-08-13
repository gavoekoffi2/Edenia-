import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { listConversations } from "@/lib/chat/service";
import { prisma } from "@/lib/db/client";
import { Avatar, EmptyState } from "@/components/ui";

export const metadata = { title: "Mes matchs", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const [matches, likesReceived] = await Promise.all([
    listConversations(user.id),
    prisma.like.count({ where: { toId: user.id, kind: "LIKE" } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="e-display text-xl">❤️ Mes matchs</h1>
        <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
          {matches.length === 0
            ? "Un match se produit quand l'intérêt est réciproque."
            : `${matches.length} personne${matches.length > 1 ? "s" : ""} avec qui l'intérêt est réciproque.`}
        </p>
      </div>

      {matches.length === 0 ? (
        <EmptyState
          title="Pas encore de match"
          body={
            likesReceived > 0
              ? "Vous avez été liké(e). Continuez à découvrir des profils : un match se crée dès que l'intérêt est partagé."
              : "Commencez par découvrir quelques profils. Personne ne peut vous écrire sans que vous l'ayez choisi."
          }
          action={{ label: "Découvrir des profils", href: "/app/decouvrir" }}
        />
      ) : (
        <ul className="space-y-2">
          {matches.map((match) => (
            <li key={match.matchId}>
              <Link
                href={match.conversationId ? `/app/messages/${match.conversationId}` : "/app/messages"}
                className="e-card p-3 flex items-center gap-3"
              >
                <Avatar firstName={match.firstName} url={match.photoUrl ? `/media/${match.photoUrl}` : null} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{match.firstName}</p>
                  <p className="text-sm truncate" style={{ color: "var(--fg-muted)" }}>
                    {match.lastMessage ?? "Lancez la conversation quand vous voulez."}
                  </p>
                </div>
                <span className="e-chip">{match.score} %</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
