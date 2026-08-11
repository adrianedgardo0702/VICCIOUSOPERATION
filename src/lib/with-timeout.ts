// Límite de tiempo para el render de páginas del servidor.
//
// Si el pooler compartido está momentáneamente saturado por otra app y una
// consulta se cuelga, sin esto la función de Vercel espera hasta agotarse →
// 504 / pantalla en blanco eterna. Con esto, el render falla rápido (~9s) y
// cae en el error boundary (src/app/(app)/error.tsx), que muestra "Reintentar".
// Casi siempre el reintento entra al instante porque el pico ya pasó.
//
// Nota: esto protege la EXPERIENCIA (no dejar la página colgada). El fix de
// fondo que además libera la conexión rápido es el statement_timeout a nivel de
// rol en Supabase (ver memoria del proyecto).
export function withTimeout<T>(
  promise: Promise<T>,
  ms = 9000,
  label = "la carga de datos"
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Tiempo de espera agotado en ${label}`)),
      ms
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
