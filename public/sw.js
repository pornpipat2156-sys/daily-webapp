self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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

  const url = event.notification?.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const sameOrigin = client.url.startsWith(self.location.origin);
        if (sameOrigin && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(url);
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener("fetch", () => {
  // intentionally empty
});