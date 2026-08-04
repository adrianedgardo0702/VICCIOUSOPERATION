import { requirePermission, can } from "@/lib/session";
import { getUsers } from "@/lib/queries/users";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersManager } from "./_components/users-manager";

const ROLE_INFO = [
  {
    role: "Administrador",
    detail: "Sin restricciones. Acceso total a todos los negocios y módulos.",
  },
  {
    role: "CFO",
    detail: "Finanzas completas + lectura del resto (inventario, pedidos, comisiones).",
  },
  {
    role: "Vendedor",
    detail: "Registra pedidos, ve inventario y solo sus propias comisiones.",
  },
];

export default async function UsuariosPage() {
  const user = await requirePermission("users.view");
  const canManage = can(user, "users.manage");
  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground">
          Cuentas del equipo por nivel de acceso.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {ROLE_INFO.map((r) => (
          <Card key={r.role}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{r.role}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{r.detail}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <UsersManager
        users={users}
        canManage={canManage}
        currentUserId={user.id}
      />
    </div>
  );
}
