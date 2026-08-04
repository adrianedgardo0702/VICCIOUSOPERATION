"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUSINESSES } from "@/lib/constants";
import { setBusinessScope } from "@/app/(app)/actions";
import type { BusinessScope } from "@/lib/business";

export function BusinessSwitcher({ value }: { value: BusinessScope }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string | null) {
    if (!next) return;
    startTransition(async () => {
      await setBusinessScope(next);
      router.refresh();
    });
  }

  const items = {
    all: "Todos (consolidado)",
    ...Object.fromEntries(BUSINESSES.map((b) => [b.id, b.name])),
  };

  return (
    <Select
      items={items}
      value={value}
      onValueChange={onChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Negocio" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos (consolidado)</SelectItem>
        {BUSINESSES.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
