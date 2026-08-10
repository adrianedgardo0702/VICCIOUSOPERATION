"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Sincroniza Finanzas con Supabase en (casi) tiempo real SIN congelar:
//
// En vez de re-consultar todo el dashboard cada minuto (lo que saturaba el
// pooler compartido cuando otra app escribía), consulta un "pulso" barato
// (/api/finance-pulse = un solo número). Solo cuando ese número CAMBIA —es
// decir, cuando hubo una venta, un movimiento de caja o un abono nuevo—
// dispara un refresh real de los server components (router.refresh()).
//
// Resultado:
// - Casi nada de carga a la BD cuando no pasa nada (1 consulta indexada / 8s).
// - Datos nuevos aparecen solos en ~8s, sin recargar a mano.
// - Reacciona ÚNICAMENTE a cambios financieros, no a cualquier cambio general.
// - Nunca hay dos refrescos encimados (guard `inFlight` + `minGapMs`).
export function AutoRefresh({
  pollMs = 8_000,
  minGapMs = 6_000,
}: {
  pollMs?: number;
  minGapMs?: number;
}) {
  const router = useRouter();
  const version = useRef<string | null>(null);
  const lastRefresh = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const res = await fetch("/api/finance-pulse", { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v: string | null };
        if (cancelled || v == null) return;

        // Primer valor: fija la línea base, no refresca.
        if (version.current === null) {
          version.current = v;
          return;
        }
        // Cambió algo financiero → refrescar (con espacio mínimo entre refrescos).
        if (v !== version.current) {
          version.current = v;
          const now = Date.now();
          if (now - lastRefresh.current >= minGapMs) {
            lastRefresh.current = now;
            router.refresh();
          }
        }
      } catch {
        // Red intermitente / pooler ocupado: se reintenta en el próximo tick.
      } finally {
        inFlight.current = false;
      }
    };

    const id = setInterval(check, pollMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    check(); // línea base inmediata

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, pollMs, minGapMs]);

  return null;
}
