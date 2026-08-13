"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * §9 à §14, §62 — l'écran « Parle-moi de toi ».
 *
 * Trois exigences du cahier des charges se lisent directement dans ce composant :
 *  - la saisie clavier n'est jamais masquée (§12 : le vocal est un raccourci) ;
 *  - ce que l'IA a compris s'affiche au fil de l'eau, corrigeable (§14) ;
 *  - rien n'est publié avant validation explicite.
 */

interface Understood {
  key: string;
  label: string;
  value: string;
  needsConfirmation: boolean;
}

interface Bubble {
  role: "assistant" | "user";
  text: string;
}

export function OnboardingChat() {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [understood, setUnderstood] = useState<Understood[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceState>({ supported: false, recording: false });

  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send(null);
    setVoice((state) => ({ ...state, supported: hasSpeechRecognition() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles]);

  async function send(message: string | null, inputMode: "TEXT" | "VOICE" = "TEXT") {
    setBusy(true);
    setError(null);
    setQuickReplies([]);
    if (message) setBubbles((prev) => [...prev, { role: "user", text: message }]);

    try {
      const response = await fetch("/api/v1/onboarding/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, inputMode, transcriptEdited: false }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Échec de l'envoi.");
        return;
      }

      const data = payload.data as {
        assistantMessage: string;
        quickReplies: string[];
        progress: number;
        done: boolean;
        understood: Understood[];
      };

      setBubbles((prev) => [...prev, { role: "assistant", text: data.assistantMessage }]);
      setQuickReplies(data.quickReplies ?? []);
      setProgress(data.progress);
      setDone(data.done);

      if (data.understood.length > 0) {
        setUnderstood((prev) => {
          const merged = new Map(prev.map((item) => [item.key, item]));
          for (const item of data.understood) merged.set(item.key, item);
          return [...merged.values()];
        });
      }
    } catch {
      setError("Connexion perdue. Vos réponses précédentes sont enregistrées — réessayez.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    void send(text);
  }

  function startVoice() {
    const recognition = createRecognition();
    if (!recognition) return;
    setVoice((state) => ({ ...state, recording: true }));

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, index) => event.results[index]?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      // §12 : la transcription arrive dans le champ de saisie, pas directement
      // dans la conversation — l'utilisateur peut la corriger avant d'envoyer.
      setInput(transcript);
    };
    recognition.onerror = () => setVoice((state) => ({ ...state, recording: false }));
    recognition.onend = () => setVoice((state) => ({ ...state, recording: false }));
    recognition.start();
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100vh - 12rem)" }}>
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: "var(--fg-muted)" }}>
          <span>Votre profil</span>
          <span>{progress} %</span>
        </div>
        <div className="e-meter">
          <span style={{ width: `${Math.max(3, progress)}%` }} />
        </div>
      </div>

      <div className="flex-1 space-y-3" aria-live="polite">
        {bubbles.map((bubble, index) => (
          <div
            key={`${index}-${bubble.text.slice(0, 12)}`}
            className={bubble.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <p
              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm"
              style={
                bubble.role === "user"
                  ? { background: "var(--color-clay-500)", color: "#fff" }
                  : { background: "var(--bg-elevated)", border: "1px solid var(--border)" }
              }
            >
              {bubble.text}
            </p>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="e-skeleton" style={{ width: "8rem", height: "2.25rem", borderRadius: "1rem" }} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {understood.length > 0 && (
        <details className="e-card p-3 mt-4" open>
          <summary className="text-sm font-semibold cursor-pointer">
            Ce que j'ai compris ({understood.length})
          </summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {understood.map((item) => (
              <li key={item.key} className="flex items-start justify-between gap-3">
                <span style={{ color: "var(--fg-muted)" }}>{item.label}</span>
                <span className="text-right font-medium">
                  {item.value}
                  {item.needsConfirmation && (
                    <span className="e-chip ml-1.5" title="À confirmer avant publication">
                      à confirmer
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs mt-2.5" style={{ color: "var(--fg-muted)" }}>
            Vous pourrez tout relire et corriger avant publication. Rien n'est visible pour l'instant.
          </p>
        </details>
      )}

      {error && (
        <p className="text-sm mt-3" role="alert" style={{ color: "var(--color-danger-500)" }}>
          {error}
        </p>
      )}

      {done ? (
        <button
          type="button"
          className="e-btn e-btn-primary w-full mt-4"
          onClick={() => router.push("/app/onboarding/apercu")}
        >
          ✨ Voir mon profil
        </button>
      ) : (
        <>
          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  className="e-btn e-btn-secondary"
                  style={{ minHeight: "2.25rem", padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
                  onClick={() => void send(reply)}
                  disabled={busy}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="flex gap-2 mt-4 sticky bottom-0 pb-1" style={{ background: "var(--bg)" }}>
            {voice.supported && (
              <button
                type="button"
                className="e-btn e-btn-secondary"
                style={{ minWidth: "2.75rem", padding: "0 0.75rem" }}
                onClick={startVoice}
                disabled={busy || voice.recording}
                aria-label={voice.recording ? "Enregistrement en cours" : "Répondre à la voix"}
              >
                {voice.recording ? "●" : "🎙️"}
              </button>
            )}
            <input
              className="e-input"
              placeholder={voice.recording ? "Parlez…" : "Écrivez votre réponse…"}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={busy}
              aria-label="Votre réponse"
            />
            <button type="submit" className="e-btn e-btn-primary" disabled={busy || !input.trim()}>
              Envoyer
            </button>
          </form>

          <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
            {voice.supported
              ? "Écrivez ou appuyez sur le micro — vous pourrez corriger la transcription avant d'envoyer."
              : "Répondez en quelques mots, cela suffit."}
          </p>
        </>
      )}
    </div>
  );
}

// --- Reconnaissance vocale du navigateur (C8) -------------------------------
// Elle n'est pas disponible partout ; on l'utilise quand elle existe, et la
// saisie clavier reste la voie principale.

interface VoiceState {
  supported: boolean;
  recording: boolean;
}

interface SpeechRecognitionEventLike {
  results: { length: number; [index: number]: { [index: number]: { transcript: string } } };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function hasSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function createRecognition(): RecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | (new () => RecognitionLike)
    | undefined;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = false;
  return recognition;
}
