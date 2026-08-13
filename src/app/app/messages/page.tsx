import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { listConversations } from "@/lib/chat/service";
import { Avatar, EmptyState } from "@/components/ui";

export const metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireUser();
  const conversations = (await listConversations(user.id)).sort((a, b) => {
    const at = a.lastMessageAt?.getTime() ?? 0;
    const bt = b.lastMessageAt?.getTime() ?? 0;
    return bt - at;
  });

  return (
    <div className="space-y-5">
      <h1 className="e-display text-xl">💬 Messages</h1>

      {conversations.length === 0 ? (
        <EmptyState
          title="Aucune conversation"
          body="Les conversations s'ouvrent après un match. Personne ne peut vous écrire sans votre accord."
          action={{ label: "Découvrir des profils", href: "/app/decouvrir" }}
        />
      ) : (
        <ul className="space-y-2">
          {conversations.map((conversation) => (
            <li key={conversation.matchId}>
              <Link
                href={conversation.conversationId ? `/app/messages/${conversation.conversationId}` : "#"}
                className="e-card p-3 flex items-center gap-3"
              >
                <Avatar
                  firstName={conversation.firstName}
                  url={conversation.photoUrl ? `/media/${conversation.photoUrl}` : null}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold flex items-center gap-2">
                    {conversation.firstName}
                    {conversation.unread && (
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: "var(--color-clay-500)" }}
                        aria-label="Non lu"
                      />
                    )}
                  </p>
                  <p className="text-sm truncate" style={{ color: "var(--fg-muted)" }}>
                    {conversation.lastMessage ?? "Nouvelle conversation"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
