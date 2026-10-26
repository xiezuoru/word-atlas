/* Word Atlas offline cache: app shell network-first, everything else cache-first. */
const VERSION = "atlas-v2";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

const ASSET_TYPES = [
  [".css", "text/css"],
  [".js", "javascript"],
  [".json", "application/json"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".m4a", "audio/mp4"],
  [".woff2", "font/woff2"],
  [".woff", "font/woff"],
];

function contentTypeOf(res) {
  return (res.headers.get("content-type") || "").toLowerCase();
}

// A response may only enter (or stay in) the cache when its content type
// matches the URL it was requested as. Without this guard an SPA fallback —
// the HTML shell returned for an asset that is missing — can be stored under a
// .css or .js URL. Asset requests are cache-first, so that single bad entry
// makes the page render without styles or scripts forever, for that client.
function cacheable(pathname, res) {
  if (!res || !res.ok || res.type !== "basic") return false;
  const type = contentTypeOf(res);
  if (!type) return true;
  if (type.includes("text/html")) return false;
  const rule = ASSET_TYPES.find(([ext]) => pathname.toLowerCase().endsWith(ext));
  return rule ? type.includes(rule[1]) : true;
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isDocument = req.mode === "navigate";
  const isIndex = url.pathname.endsWith("/index.json");

  if (isDocument || isIndex) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const type = contentTypeOf(res);
          const want = isDocument ? "text/html" : "application/json";
          if (res.ok && (!type || type.includes(want))) {
            caches.open(SHELL).then((c) => c.put(req, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }

  const store = async (res) => {
    if (!cacheable(url.pathname, res)) return res;
    const copy = res.clone();
    const name = /\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL;
    const cache = await caches.open(name);
    await cache.put(req, copy);
    if (name === MEDIA) await trim(MEDIA, 1500);
    return res;
  };

  event.respondWith(
    caches.match(req).then((hit) => {
      // Self-heal: a cached entry whose content type is wrong for this URL (for
      // example HTML stored under a .css path) is treated as a miss and
      // overwritten with the real asset.
      if (hit && cacheable(url.pathname, hit)) return hit;
      return fetch(req).then(store);
    }),
  );
});
