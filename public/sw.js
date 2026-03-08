const SW_VERSION = "daily-webapp-offline-v2";
const STATIC_CACHE = `${SW_VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/logo.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

const STATIC_PATHS = new Set([
  "/offline.html",
  "/logo.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
]);

async function precacheCoreAssets() {
  const cache = await caches.open(STATIC_CACHE);

  await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const request = new Request(url, { cache: "reload" });
      const response = await fetch(request);

      if (response && response.ok) {
        await cache.put(url, response.clone());
      }
    })
  );
}

async function cleanupOldCaches() {
  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => key !== STATIC_CACHE)
      .map((key) => caches.delete(key))
  );
}

function buildInlineOfflineResponse() {
  return new Response(
    `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Offline • DAILY-WEBAPP</title>
  <style>
    body{
      margin:0;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:#f5f5f5;
      color:#111827;
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      padding:24px;
    }
    .card{
      width:100%;
      max-width:560px;
      background:#fff;
      border:1px solid #e5e7eb;
      border-radius:20px;
      padding:24px;
      box-shadow:0 10px 30px rgba(0,0,0,.06);
    }
    h1{margin:0 0 10px;font-size:24px}
    p{margin:0 0 12px;line-height:1.6;color:#4b5563}
    .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
    .btn{
      border-radius:12px;
      padding:12px 16px;
      text-decoration:none;
      border:1px solid #d1d5db;
      color:#111827;
      background:#fff;
      cursor:pointer;
      font-weight:600;
    }
    .btn.primary{
      background:#111827;
      color:#fff;
      border-color:#111827;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>ขณะนี้ออฟไลน์อยู่</h1>
    <p>ไม่สามารถโหลดหน้าที่ต้องการได้ในตอนนี้ เพราะอุปกรณ์ยังไม่ได้เชื่อมต่ออินเทอร์เน็ต</p>
    <p>เมื่อกลับมาออนไลน์แล้ว ให้ลองเปิดหน้าอีกครั้ง</p>
    <div class="actions">
      <a class="btn primary" href="/">กลับหน้าแรก</a>
    </div>
  </div>
</body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offlineResponse = await cache.match(OFFLINE_URL, { ignoreSearch: true });

    return offlineResponse || buildInlineOfflineResponse();
  }
}

async function staleWhileRevalidateStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  if (request.mode === "navigate") {
    const offlineResponse = await cache.match(OFFLINE_URL, { ignoreSearch: true });
    return offlineResponse || buildInlineOfflineResponse();
  }

  return new Response("", { status: 504, statusText: "Gateway Timeout" });
}

function normalizeTargetUrl(rawUrl) {
  try {
    return new URL(rawUrl || "/", self.location.origin).toString();
  } catch {
    return new URL("/", self.location.origin).toString();
  }
}

async function focusOrOpenTarget(targetUrl, data) {
  const clientList = await clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of clientList) {
    const sameOrigin = client.url.startsWith(self.location.origin);
    if (!sameOrigin) continue;

    try {
      client.postMessage({
        type: "PUSH_NOTIFICATION_CLICK",
        url: targetUrl,
        data: data || {},
      });
    } catch {
      // ignore
    }

    try {
      if ("navigate" in client) {
        await client.navigate(targetUrl);
      }
    } catch {
      // ignore navigation failures
    }

    if ("focus" in client) {
      return client.focus();
    }

    return;
  }

  const offlineUrl = new URL(OFFLINE_URL, self.location.origin);
  offlineUrl.searchParams.set("redirect", targetUrl);
  offlineUrl.searchParams.set("from", "push");

  const isOffline = self.navigator && self.navigator.onLine === false;
  const urlToOpen = isOffline ? offlineUrl.toString() : targetUrl;

  if (clients.openWindow) {
    return clients.openWindow(urlToOpen);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheCoreAssets();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await cleanupOldCaches();
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "DAILY-WEBAPP",
      body: event.data.text(),
      url: "/",
      tag: "daily-webapp",
      data: {},
    };
  }

  const title = data.title || "DAILY-WEBAPP";
  const options = {
    body: data.body || "",
    tag: data.tag || "daily-webapp",
    renotify: false,
    requireInteraction: false,
    data: {
      url: data.url || "/",
      ...(data.data || {}),
    },
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = normalizeTargetUrl(event.notification?.data?.url);
  const payload = event.notification?.data || {};

  event.waitUntil(focusOrOpenTarget(targetUrl, payload));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (sameOrigin && STATIC_PATHS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidateStatic(request));
  }
});