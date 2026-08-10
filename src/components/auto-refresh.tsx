"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Mantiene la app sincronizada con Supabase sin recargar a mano: como todas
// las páginas son server components dinámicos, router.refresh() vuelve a
// consultar la BD y pinta los datos nuevos (los de esta app o los que escriba
// cualquier otra app del ecosistema: tienda, app de vendedor, etc.).
//
// OJO con el pooler compartido de Supabase: cada refresh dispara TODAS las
// consultas de la página. Por eso este componente FRENA en vez de reaccionar
// a todo:
// - `minGapMs` garantiza un espacio mínimo entre refrescos. Al volver a la
//   pestaña, el navegador dispara `focus` Y `visibilitychange` casi juntos;
//   sin este freno eran dos renders completos seguidos (doble avalancha de
//   queries justo cuando la otra app está escribiendo → congelamiento).
// - Solo refresca con la pestaña visible: nada de consultas de fondo.
export function AutoRefresh({
  intervalMs = 60_000,
  minGapMs = 20_000,
}: {
  intervalMs?: number;
  minGapMs?: number;
}) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh.current < minGapMs) return;
      lastRefresh.current = now;
      router.refresh();
    };

    const id = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs, minGapMs]);

  return null;
}
