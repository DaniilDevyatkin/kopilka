const SHELL_CACHE = "kopilka-shell-v6";
const MEDIA_CACHE = "kopilka-media-v6";
const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/logo-macbookus.png",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("kopilka-") &&
                ![SHELL_CACHE, MEDIA_CACHE].includes(key),
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(async () => {
        if (self.registration.navigationPreload) {
          await self.registration.navigationPreload.enable();
        }
        await self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          return preload || (await fetch(request));
        } catch {
          return (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Versioned Next.js scripts and styles intentionally stay under the
  // browser's normal HTTP cache. Serving an old chunk after a deployment can
  // make an installed PWA fail before React is able to recover.
  if (!["font", "image"].includes(request.destination)) {
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(
            caches.open(MEDIA_CACHE).then((cache) => cache.put(request, copy)),
          );
        }
        return response;
      });
      return cached || network;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }
  if (event.data?.type !== "CLEAR_PRIVATE_DATA") return;
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("kopilka-private-"))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});
