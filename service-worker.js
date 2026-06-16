const CACHE_NAME = "economy-class-app-v176";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDtwpc4THHE_t3fSfV-FgS4KHF2krUosvA",
  authDomain: "economy-44982.firebaseapp.com",
  databaseURL: "https://economy-44982-default-rtdb.firebaseio.com",
  projectId: "economy-44982",
  storageBucket: "economy-44982.firebasestorage.app",
  messagingSenderId: "979007941269",
  appId: "1:979007941269:web:140c0a114b64ffecd1899c",
  measurementId: "G-ZC0FVSV9JL"
};

try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
  firebase.initializeApp(FIREBASE_CONFIG);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    const data = payload.data || {};
    const notification = payload.notification || {};
    self.registration.showNotification(notification.title || data.title || "경제교실 알림", {
      body: notification.body || data.body || "",
      icon: notification.icon || data.icon || "/assets/icons/app-icon-192.png",
      badge: data.badge || "/assets/icons/app-icon-192.png",
      tag: data.eventId || data.tag || "economy-class-notification",
      renotify: true,
      data: {
        url: data.url || "/",
        eventId: data.eventId || "",
        type: data.type || "",
        noticeId: data.noticeId || "",
        roomId: data.roomId || ""
      }
    });
  });
} catch (error) {
  console.warn("Firebase Messaging service worker setup failed:", error);
}
const APP_SHELL = [
  "./",
  "./index.html",
  "./startup.js",
  "./site-config.js",
  "./catalog.js",
  "./app.js",
  "./ai-question-bridge.js",
  "./restored-avatar-images.js",
  "./styles.css",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./assets/icons/app-icon-192.png",
  "./assets/icons/app-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});

self.addEventListener("message", event => {
  if (!event.data || event.data.type !== "CLEAR_CACHE_AND_RELOAD") return;
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("push", event => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "경제교실 알림", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "경제교실 알림";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/assets/icons/app-icon-192.png",
    badge: payload.badge || "/assets/icons/app-icon-192.png",
    tag: payload.tag || payload.id || "economy-class-notification",
    renotify: true,
    data: payload.data || { url: payload.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => new URL(client.url).origin === self.location.origin);
      if (existing) return existing.focus().then(client => client.navigate(targetUrl));
      return clients.openWindow(targetUrl);
    })
  );
});
