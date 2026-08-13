"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * §6 — barre basse : le parcours principal doit se faire au pouce, sur un
 * ecran tactile, d'une seule main. Cinq entrees maximum, libellees en clair.
 */
const TABS = [
  { href: "/app/decouvrir", label: "Découvrir", icon: "🔍" },
  { href: "/app/matchs", label: "Matchs", icon: "❤️" },
  { href: "/app/messages", label: "Messages", icon: "💬" },
  { href: "/app/profil", label: "Profil", icon: "👤" },
  { href: "/app/confiance", label: "Confiance", icon: "🛡️" },
] as const;

export function TabBar({ unreadMessages = 0 }: { unreadMessages?: number }) {
  const pathname = usePathname();

  return (
    <nav className="e-tabbar" aria-label="Navigation de l'application">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className="e-tab" data-active={active} aria-current={active ? "page" : undefined}>
            <span aria-hidden="true" className="text-lg leading-none relative">
              {tab.icon}
              {tab.href === "/app/messages" && unreadMessages > 0 && (
                <span
                  className="absolute -top-1 -right-2 text-[0.5625rem] rounded-full px-1 font-bold"
                  style={{ background: "var(--color-clay-500)", color: "#fff" }}
                >
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
