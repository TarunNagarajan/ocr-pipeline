"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.debug("[SW] Registered:", registration.scope);
        })
        .catch((error) => {
          console.debug("[SW] Registration failed:", error);
        });
    }
  }, []);

  return null;
}
