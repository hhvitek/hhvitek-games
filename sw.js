// Offline support for the launcher, all games from games/registry.js and the shared images/.
// Everything is shown from the cache at once (opening a game or going back to the launcher never waits
// for the network). The cache holds exactly one released version (version.js): every release changes
// version.js, which this worker imports, so the browser notices a new worker when the app is opened
// (registered with updateViaCache: 'none', so the check never waits for an older copy kept by the browser).
// The new worker downloads the whole new version into its own cache in the background and takes over only
// when every app file arrived; an interrupted download leaves the old version whole. The new version then
// shows on the next opening.
importScripts('games/registry.js');
// the images are optional: without images/ the games still work, so offline mode must too
try { importScripts('images/sets.js'); } catch (e) {}
// without version.js (an unreleased copy) the cache is simply called "dev"
try { importScripts('version.js'); } catch (e) {}

// GitHub Pages serves all of the user's projects from one origin, and caches belong to the origin:
// our caches carry the project prefix and we delete only those (never another project's caches)
const PREFIX = 'hhvitek-games-';
const VERSION = (self.APP_VERSION && self.APP_VERSION.version) || 'dev';
const CACHE = PREFIX + VERSION; // one cache per released version; the previous one is deleted on activate
const OLD_CACHE = /^games-v\d+$/; // our caches before the prefix
// App files: all of them must arrive before a new version takes over (shared scripts first, then pages and icons)
const APP_FILES = [
  'version.js', 'games/registry.js', 'games/_cards/cards.js', 'games/_cards/marias.js', 'games/_opponents/opponents.js', 'images/sets.js', // version, shared card look, mariáš cards, opponents, image list
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  ...(self.GAMES || []).flatMap(g => [`games/${g.id}/index.html`, `games/${g.id}/icon.svg`]),
];
const PHOTOS = Object.values(self.IMAGE_SETS || {}).flatMap(set => set.items.map(it => `images/${it.file}`));
// Games are opened from the launcher with ?menu: every file is cached once, under its address without the query
const keyOf = u => { const x = new URL(u, self.location); return x.origin + x.pathname; };
const APP_KEYS = new Set(APP_FILES.map(keyOf));
// ask the server (a short "not modified" when the file is the same), never an older copy kept by the browser
const fresh = f => new Request(f, { cache: 'no-cache' });
// Files no longer listed (a game removed from the registry, a photo dropped from images/sets.js) leave the cache.
// Only when the lists loaded: without games/registry.js nothing is deleted, without images/sets.js no photo.
async function prune(c) {
  if (!(self.GAMES || []).length) return;
  const keep = new Set([...APP_KEYS, ...PHOTOS.map(keyOf)]);
  const photosKnown = !!self.IMAGE_SETS, images = keyOf('images/');
  for (const req of await c.keys()) {
    const k = keyOf(req.url);
    if (!keep.has(k) && (photosKnown || !k.startsWith(images))) await c.delete(req);
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // every app file must arrive: otherwise the install fails, the old version stays whole
    // and the browser tries again on a later opening
    await Promise.all(APP_FILES.map(async f => {
      const res = await fetch(fresh(f));
      if (!res.ok) throw new Error(`${f}: ${res.status}`);
      await c.put(keyOf(f), res);
    }));
    // photos: one that does not arrive keeps its copy from the previous version (or comes when it is shown)
    await Promise.all(PHOTOS.map(async f => {
      const k = keyOf(f);
      try { const res = await fetch(fresh(f)); if (res.ok) { await c.put(k, res); return; } } catch (err) {}
      try { const old = await caches.match(k); if (old) await c.put(k, old); } catch (err) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && (k.startsWith(PREFIX) || OLD_CACHE.test(k))).map(k => caches.delete(k))))
    .then(() => caches.open(CACHE)).then(prune).catch(() => {}).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const key = keyOf(req.url);
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(key);
    if (hit) return hit;
    // not in the cache (e.g. a photo that did not arrive during the install): the network, kept for next time
    try {
      const res = await fetch(req);
      if (res.ok) e.waitUntil(c.put(key, res.clone()).catch(() => {}));
      return res;
    } catch (err) {
      // offline: a page that was never cached goes to the launcher (a redirect, so its links work),
      // but only when the launcher itself is cached, otherwise the redirect would loop
      const home = keyOf('index.html');
      if (req.mode === 'navigate' && key !== home && await c.match(home)) return Response.redirect(home, 302);
      return Response.error();
    }
  })().catch(() => Response.error()));
});
