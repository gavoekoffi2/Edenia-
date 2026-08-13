import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { loadConversation } from "@/lib/chat/service";
import { computeMatch, suggestIcebreakers } from "@/lib/matching";
import { loadCandidate } from "@/lib/matching/from-db";
import { ChatThread } from "@/components/chat-thread";

export const metadata = { title: "Conversation", robots: { index: false } };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const user = await requireUser();
  const { id } = await params;

  const loaded = await loadConversation(user.id, id);
  if (!loaded) notFound();

  const { conversation, other } = loaded;

  // §33 : les questions proposées portent sur les dimensions les moins couvertes.
  const [me, them] = await Promise.all([loadCandidate(user.id), loadCandidate(other.id)]);
  const icebreakers = me && them ? suggestIcebreakers(computeMatch(me, them)) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <Link href="/app/messages" className="e-btn e-btn-ghost">
          ← Messages
        </Link>
        <Link href={`/app/profils/${other.id}`} className="font-semibold">
          {other.profile?.firstName ?? "Membre"}
        </Link>
      </div>

      <ChatThread
        conversationId={conversation.id}
        meId={user.id}
        otherId={other.id}
        otherFirstName={other.profile?.firstName ?? "Membre"}
        initialMessages={conversation.messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          kind: message.kind,
        }))}
        icebreakers={icebreakers}
      />
    </div>
  );
}
