// Minimal service worker: makes the app installable.
// It does NOT cache any business data (app stays online-first).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});