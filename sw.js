// ChordSketch - sw.js オフライン用キャッシュ（PWA）
// コードを更新して公開し直すときは CACHE の番号を v2, v3… と上げる
const CACHE = "chordsketch-v16";  // 鼻歌入力シンプル版（歌った長さ・間をそのまま反映）でv16に
const FILES = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/theory.js",
  "./js/audio.js",
  "./js/guitar.js",
  "./js/presets.js",
  "./js/sequencer.js",
  "./js/app.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        // 取得できたものはキャッシュ（ピアノサンプルなども次回からオフラインで使える）
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
