self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // intentionally empty:
  // มี service worker พื้นฐานเพื่อรองรับ PWA/installability
  // โดยยังไม่แตะ logic cache ของระบบเดิม
});