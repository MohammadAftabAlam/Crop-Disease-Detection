// Service worker: the app works offline after the first visit.
// The offline model (~31 MB) is not precached; offline mode downloads it on request
// into the "cropcare-offline-model" cache (src/offline/model.js), served from there below.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { clientsClaim } from "workbox-core";

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// App shell: HTML, JS, CSS, icons (list injected at build time)
precacheAndRoute(self.__WB_MANIFEST);

// Every page of the single-page app opens from the cached index.html
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")));

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);

// Offline model files: from the offline-mode cache when present, else the network
registerRoute(
  ({ url }) => url.origin === self.location.origin && (url.pathname.startsWith("/model/") || url.pathname.endsWith(".wasm")),
  async ({ request }) => (await caches.match(request)) || fetch(request)
);
