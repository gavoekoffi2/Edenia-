/*
 * Service worker EDENIA (§5, §45).
 *
 * Stratégies, choisies pour une connexion 3G instable plutôt que pour une
 * connexion de bureau :
 *
 *  - Coque applicative et ressources statiques : cache-first. Une fois posées,
 *    elles ne repartent jamais sur le réseau.
 *  - Navigations : network-first avec repli sur une page hors ligne. Sur une
 *    3G qui coupe, mieux vaut un message honnête qu'un onglet blanc pendant
 *    trente secondes.
 *  - API : network-only. Un profil ou un message servi depuis un cache périmé
 *    serait pire qu'une erreur — on ne met jamais en cache des données
 *    personnelles.
 *  - Images : stale-while-revalidate, plafonné, pour économiser la data.
 */

const VERSION = "edenia-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const IMAGE_CACHE = `${VERSION}-img`;
const MAX_IMAGES = 60;

const SHELL_ASSETS = ["/", "/hors-ligne", "/manifest.webmanifest", "/icons/icon-192.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Jamais de cache sur les données personnelles.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        return cached ?? (await caches.match("/hors-ligne")) ?? Response.error();
      }),
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
              trimCache(IMAGE_CACHE, MAX_IMAGES);
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  if (request.destination === "style" || request.destination === "script" || request.destination === "font") {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});

// §46 : le push n'est qu'un transport ; le contenu vient du serveur.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "EDENIA", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "EDENIA", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { href: payload.href ?? "/app/decouvrir" },
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href ?? "/app/decouvrir";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(href);
          return client.focus();
        }
      }
      return self.clients.openWindow(href);
    }),
  );
});
