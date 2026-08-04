"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants";
import { SELLER_COMMISSION_TYPES, commissionLabel } from "@/lib/commissions";
import type { UserRow } from "@/lib/queries/users";
import {
  createUser,
  updateUser,
  resetPassword,
  setUserActive,
  deleteUser,
  type CreateUserInput,
  type UpdateUserInput,
} from "../actions";

const ROLE_BADGE: Record<Role, string> = {
  admin: "text-violet-600",
  cfo: "text-emerald-600",
  vendedor: "text-blue-600",
};

export function UsersManager({
  users,
  canManage,
  currentUserId,
}: {
  users: UserRow[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<UserRow | null>(null);
  const [pwd, setPwd] = useState<UserRow | null>(null);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo usuario
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Comisión</TableHead>
              <TableHead className="text-center">Pedidos</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              {canManage && <TableHead className="w-[160px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <span className={ROLE_BADGE[u.role as Role] ?? ""}>
                    {ROLE_LABELS[u.role as Role] ?? u.role}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {Number(u.commissionValue) > 0
                    ? commissionLabel(u.commissionType, u.commissionValue)
                    : "—"}
                </TableCell>
                <TableCell className="text-center">{u.ordersCount}</TableCell>
                <TableCell className="text-center">
                  {u.active ? (
                    <Badge variant="secondary" className="text-emerald-600">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Editar"
                        onClick={() => setEdit(u)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Restablecer contraseña"
                        onClick={() => setPwd(u)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <ToggleActive user={u} currentUserId={currentUserId} />
                      <DeleteUser user={u} currentUserId={currentUserId} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <UserDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
        />
      )}
      {canManage && edit && (
        <UserDialog
          key={`edit-${edit.id}`}
          open
          onOpenChange={(o) => !o && setEdit(null)}
          mode="edit"
          user={edit}
        />
      )}
      {canManage && pwd && (
        <PasswordDialog
          key={`pwd-${pwd.id}`}
          user={pwd}
          open
          onOpenChange={(o) => !o && setPwd(null)}
        />
      )}
    </div>
  );
}

function UserDialog({
  open,
  onOpenChange,
  mode,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: UserRow;
}) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState<string>(user?.role ?? "vendedor");
  const [commissionType, setCommissionType] = useState<string>(
    user?.commissionType ?? "percent"
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const commissionValue = Number(fd.get("commissionValue") ?? 0);

    startTransition(async () => {
      if (mode === "create") {
        const input: CreateUserInput = {
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
          role: role as Role,
          commissionType: commissionType as "percent" | "fixed",
          commissionValue,
        };
        const res = await createUser(input);
        if (res.ok) {
          toast.success("Usuario creado.");
          onOpenChange(false);
        } else toast.error(res.error);
      } else if (user) {
        const input: UpdateUserInput = {
          name: String(fd.get("name") ?? ""),
          role: role as Role,
          commissionType: commissionType as "percent" | "fixed",
          commissionValue,
        };
        const res = await updateUser(user.id, input);
        if (res.ok) {
          toast.success("Usuario actualizado.");
          onOpenChange(false);
        } else toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo usuario" : `Editar ${user?.name}`}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" name="name" defaultValue={user?.name} required />
          </div>

          {mode === "create" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Correo *</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select
              items={Object.fromEntries(ROLES.map((r) => [r, ROLE_LABELS[r]]))}
              value={role}
              onValueChange={(v) => setRole(v ?? "vendedor")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {role === "vendedor" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de comisión</Label>
                <Select
                  items={Object.fromEntries(
                    SELLER_COMMISSION_TYPES.map((t) => [t.value, t.label])
                  )}
                  value={commissionType}
                  onValueChange={(v) => setCommissionType(v ?? "percent")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_COMMISSION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commissionValue">
                  {commissionType === "percent" ? "Porcentaje (%)" : "Monto ($)"}
                </Label>
                <Input
                  id="commissionValue"
                  name="commissionValue"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={user?.commissionValue ?? "0"}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    startTransition(async () => {
      const res = await resetPassword(user.id, password);
      if (res.ok) {
        toast.success("Contraseña actualizada.");
        onOpenChange(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Nueva contraseña para {user.name} ({user.email}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña *</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActive({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className={`h-8 w-8 ${user.active ? "text-amber-600" : "text-emerald-600"}`}
      title={user.active ? "Desactivar" : "Activar"}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await setUserActive(user.id, !user.active, currentUserId);
          if (res.ok)
            toast.success(user.active ? "Usuario desactivado." : "Usuario activado.");
          else toast.error(res.error);
        })
      }
    >
      <Power className="h-4 w-4" />
    </Button>
  );
}

function DeleteUser({
  user,
  currentUserId,
}: {
  user: UserRow;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-red-500 hover:text-red-500"
            title="Eliminar"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a “{user.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            Sus pedidos conservarán el historial pero quedarán sin vendedor
            asignado. Si solo quieres bloquear el acceso, mejor desactívalo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const res = await deleteUser(user.id, currentUserId);
                if (res.ok) toast.success("Usuario eliminado.");
                else toast.error(res.error);
              });
            }}
          >
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
