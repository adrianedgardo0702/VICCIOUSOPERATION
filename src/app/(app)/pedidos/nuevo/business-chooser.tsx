"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESSES } from "@/lib/constants";
import { setBusinessScope } from "@/app/(app)/actions";

export function BusinessChooser() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function choose(id: string) {
    startTransition(async () => {
      await setBusinessScope(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        ¿Para qué negocio es el pedido?
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {BUSINESSES.map((b) => (
          <Card
            key={b.id}
            role="button"
            onClick={() => !isPending && choose(b.id)}
            className="cursor-pointer transition-colors hover:bg-muted"
          >
            <CardContent className="flex items-center gap-3 py-6">
              <span
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: b.color }}
              />
              <span className="font-semibold">{b.name}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
