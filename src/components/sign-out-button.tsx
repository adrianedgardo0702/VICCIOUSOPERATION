"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/(app)/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </button>
  );
}

// Botón de cierre de sesión basado en <form> + server action: el redirect a
// /login lo maneja Next de forma nativa (más confiable que un onClick suelto).
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <SubmitButton />
    </form>
  );
}
