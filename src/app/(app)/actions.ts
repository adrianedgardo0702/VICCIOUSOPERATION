"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { BUSINESS_COOKIE } from "@/lib/business";
import { isBusinessId } from "@/lib/constants";

export async function setBusinessScope(scope: string) {
  const value = scope === "all" || isBusinessId(scope) ? scope : "all";
  const store = await cookies();
  store.set(BUSINESS_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
