const CACHE = "showup-v1.1.0";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./model.js",
  "./db.js",
  "./icon.svg",
  "./manifest.webmanifest",
  ...["squat", "squat-alt", "row", "row-alt", "press", "press-alt"].flatMap(
    (key) => [`./assets/demos/${key}.mp4`, `./assets/demos/${key}.png`],
  ),
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("showup-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  if (e.request.headers.has("range")) {
    e.respondWith(mediaRange(e.request));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return r;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then(
            (r) =>
              r ||
              (e.request.mode === "navigate"
                ? caches.match("./index.html")
                : Response.error()),
          ),
      ),
  );
});

async function mediaRange(request) {
  const url = request.url;
  let response = await caches.match(url);
  if (!response) {
    response = await fetch(url);
    if (!response.ok) return response;
    const c = await caches.open(CACHE);
    await c.put(url, response.clone());
  }
  const data = await response.arrayBuffer(),
    size = data.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (!match || (!match[1] && !match[2]))
    return new Response(data, { headers: response.headers });
  let start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  let end = match[1]
    ? match[2]
      ? Math.min(Number(match[2]), size - 1)
      : size - 1
    : size - 1;
  if (start >= size || end < start)
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${size}` },
    });
  return new Response(data.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "video/mp4",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  });
}
