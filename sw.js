/* Milena Garbim — service worker: só notificações (sem cache offline, para o site estar sempre atualizado) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Milena Garbim", {
    body: d.corpo || "Você tem uma novidade no painel.",
    icon: "assets/img/icone-192.png",
    badge: "assets/img/icone-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { link: d.link || "/admin" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || "/admin";
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.includes("/admin") && "focus" in c) { await c.navigate(link).catch(() => {}); return c.focus(); }
    }
    return self.clients.openWindow(link);
  })());
});
