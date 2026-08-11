"use client";

// Red de seguridad de último nivel: captura errores que ocurren en el layout
// raíz o por encima de cualquier error boundary de segmento (que de otro modo
// muestran la pantalla genérica "This page couldn't load"). Debe declarar su
// propio <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#e5e5e5",
          margin: 0,
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 .5rem" }}>
            No se pudo cargar
          </h1>
          <p style={{ fontSize: ".9rem", color: "#a1a1aa", margin: "0 0 1.25rem" }}>
            Hubo un problema momentáneo. Vuelve a intentarlo.
            {error?.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: ".6rem 1.2rem",
              fontSize: ".9rem",
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
