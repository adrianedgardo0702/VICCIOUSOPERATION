"use client";

import { useEffect } from "react";

// Kill-switch auto-reparador.
//
// Cuando la app de NakamaShoppu se desplegó por error en este mismo dominio,
// pudo dejar un *service worker* y cachés en los navegadores que la visitaron.
// Un service worker persiste por origen: sigue interceptando peticiones y
// sirviendo la versión vieja/rota AUNQUE el servidor ya devuelva la app
// correcta de Finanzas. Síntoma: "no abre en mi Chrome" pese a que en un
// navegador limpio sí abre.
//
// Finanzas NO usa service worker ni Cache Storage. Así que aquí, sin condiciones,
// desregistramos cualquier SW fantasma y borramos todas las cachés del origen.
// Es inofensivo en un navegador sano (no hay nada que borrar) y cura solo a
// cualquier navegador contaminado en su próxima visita. Si había un SW activo
// controlando la página, recargamos UNA vez para soltar su control.
export function ServiceWorkerKiller() {
  useEffect(() => {
    let reloaded = sessionStorage.getItem("sw-killed") === "1";

    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length > 0) {
            await Promise.all(regs.map((r) => r.unregister()));
            // Si un SW controlaba esta página, hace falta recargar para que
            // deje de interceptar. Solo una vez (marca en sessionStorage).
            const wasControlled = !!navigator.serviceWorker.controller;
            if (wasControlled && !reloaded) {
              sessionStorage.setItem("sw-killed", "1");
              reloaded = true;
              location.reload();
              return;
            }
          }
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        // Si algo falla, no rompemos la app: el navegador simplemente sigue.
      }
    })();
  }, []);

  return null;
}
