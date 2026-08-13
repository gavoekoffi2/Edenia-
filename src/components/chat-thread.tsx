"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SafetyNotice } from "@/components/ui";

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  kind: string;
}

/**
 * §32, §33, §34 — fil de conversation.
 *
 * Deux éléments non négociables y sont intégrés :
 *  - le bandeau anti-arnaque, affiché dès qu'un motif de demande d'argent est
 *    détecté, et non masquable en un clic ;
 *  - les questions de fond proposées après un match, pour aller au-delà du
 *    « ça va ? ».
 */
export function ChatThread({
  conversationId,
  meId,
  otherFirstName,
  otherId,
  initialMessages,
  icebreakers,
}: {
  conversationId: string;
  meId: string;
  otherFirstName: string;
  otherId: string;
  initialMessages: ChatMessage[];
  icebreakers: Array<{ theme: string; question: string }>;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setInput("");

    try {
      const response = await fetch("/api/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ conversationId, body }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Envoi impossible.");
        setInput(body);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: payload.data.messageId,
          senderId: meId,
          body,
          createdAt: new Date().toISOString(),
          kind: "TEXT",
        },
      ]);
      if (payload.data.warning) setWarning(payload.data.warning);
      router.refresh();
    } catch {
      setError("Connexion perdue. Votre message n'a pas été envoyé.");
      setInput(body);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 12rem)" }}>
      {warning && (
        <div className="mb-3">
          <SafetyNotice>
            {warning}{" "}
            <a href={`/app/profils/${otherId}`} className="underline font-semibold">
              Signaler ce profil
            </a>
          </SafetyNotice>
        </div>
      )}

      <div className="flex-1 space-y-2">
        {messages.length === 0 && (
          <div className="e-card p-4">
            <p className="text-sm font-semibold">
              Vous et {otherFirstName} vous êtes likés.
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
              Pour éviter le « ça va ? », voici trois sujets qui disent vraiment quelque chose :
            </p>
            <div className="mt-3 space-y-2">
              {icebreakers.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  className="e-card p-3 w-full text-left text-sm"
                  onClick={() => void send(item.question)}
                  disabled={busy}
                >
                  <span className="e-chip mb-1.5">{item.theme}</span>
                  <span className="block">{item.question}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => {
          const mine = message.senderId === meId;
          return (
            <div key={message.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <p
                className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                style={
                  mine
                    ? { background: "var(--color-clay-500)", color: "#fff" }
                    : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }
                }
              >
                {message.body}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="text-sm mt-2" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex gap-2 mt-3 sticky bottom-0 pb-1"
        style={{ background: "var(--bg)" }}
      >
        <input
          className="e-input"
          placeholder={`Écrire à ${otherFirstName}…`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={busy}
          aria-label="Votre message"
        />
        <button type="submit" className="e-btn e-btn-primary" disabled={busy || !input.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}
