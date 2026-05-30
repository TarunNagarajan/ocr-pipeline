

const CACHE_NAME = "credential-lens-v1";
const STATIC_ASSETS = ["/", "/manifest.json", "/icons/icon.svg"];


self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  self.skipWaiting();
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  
  self.clients.claim();
});


self.addEventListener("fetch", (event) => {
  
  if (event.request.method !== "GET") return;

  
  const url = new URL(event.request.url);
  if (url.protocol === "chrome-extension:" || url.protocol === "data:") return;

  
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstWithFallback(event.request));
    return;
  }

  
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(event.request));
    return;
  }

  
  event.respondWith(cacheFirstWithNetworkUpdate(event.request));
});

async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    if (request.mode === "navigate") {
      return caches.match("/");
    }
    return new Response("Offline", { status: 503 });
  }
}

async function cacheFirstWithNetworkUpdate(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}
