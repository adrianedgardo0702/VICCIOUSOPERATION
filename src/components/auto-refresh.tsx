"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Mantiene la app sincronizada con Supabase sin recargar a mano: como todas
// las páginas son server components dinámicos, router.refresh() vuelve a
// consultar la BD y pinta los datos nuevos (los de esta app o los que escriba
// cualquier otra app del ecosistema: tienda, app de vendedor, etc.).
//
// - Refresco periódico solo con la pestaña visible (no gasta consultas de
//   fondo contra el pooler de Supabase).
// - Refresco inmediato al volver a la pestaña o enfocar la ventana: lo típico
//   tras registrar algo en otra app es volver aquí, y se ve al instante.
export function AutoRefresh({ intervalMs = 45_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const id = setInterval(refresh, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
