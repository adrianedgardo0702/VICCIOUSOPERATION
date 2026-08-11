"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Error boundary del área privada.
//
// Si una página del servidor falla al renderizar —por ejemplo, si una consulta
// a la BD supera el statement_timeout porque el pooler está momentáneamente
// saturado por otra app— en vez de dejar la pantalla en blanco/"cargando" para
// siempre (que terminaba en 504), mostramos una tarjeta clara con "Reintentar".
// Casi siempre el reintento funciona al instante porque el pico ya pasó.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error al cargar la página:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-xl">No se pudo cargar</CardTitle>
          <CardDescription>
            Hubo un problema momentáneo al leer los datos. Suele resolverse al
            reintentar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button onClick={() => reset()} className="w-full">
            Reintentar
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Recargar la página
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
