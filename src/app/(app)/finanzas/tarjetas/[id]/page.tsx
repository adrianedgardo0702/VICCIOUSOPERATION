import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/session";
import { getCreditCard, getCardMovements } from "@/lib/queries/cards";
import { CardDetail } from "./_components/card-detail";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission("finance.view");
  const canManage = can(user, "finance.manage");
  const { id } = await params;

  const card = await getCreditCard(id);
  if (!card) notFound();

  const movements = await getCardMovements(id);

  // Serializar movimientos a números/strings simples para el cliente.
  const movs = movements.map((m) => ({
    id: m.id,
    type: m.type,
    amount: Number(m.amount),
    description: m.description,
    date: m.date.toISOString(),
    balanceAfter: m.balanceAfter === null ? null : Number(m.balanceAfter),
    hasFinanceTx: m.financeTxId !== null,
  }));

  return <CardDetail card={card} movements={movs} canManage={canManage} />;
}
