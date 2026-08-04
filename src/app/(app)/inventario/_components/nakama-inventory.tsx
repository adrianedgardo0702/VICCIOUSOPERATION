"use client";

import { Shirt, Palette } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { NakamaBlank, ProductCategory } from "@/db/schema";
import type { DesignRow } from "@/lib/queries/inventory";
import { BlanksSection } from "./blanks-section";
import { DesignsSection } from "./designs-section";

export function NakamaInventory({
  blanks,
  designs,
  categories,
  canManage,
}: {
  blanks: NakamaBlank[];
  designs: DesignRow[];
  categories: ProductCategory[];
  canManage: boolean;
}) {
  return (
    <Tabs defaultValue="designs">
      <TabsList>
        <TabsTrigger value="designs">
          <Palette className="mr-2 h-4 w-4" />
          Diseños DTF y catálogo
        </TabsTrigger>
        <TabsTrigger value="blanks">
          <Shirt className="mr-2 h-4 w-4" />
          Suéteres en blanco
        </TabsTrigger>
      </TabsList>
      <TabsContent value="designs" className="mt-4">
        <DesignsSection
          designs={designs}
          categories={categories}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="blanks" className="mt-4">
        <BlanksSection blanks={blanks} canManage={canManage} />
      </TabsContent>
    </Tabs>
  );
}
