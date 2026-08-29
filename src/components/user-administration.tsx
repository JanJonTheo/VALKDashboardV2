"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Save, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Role } from "@/lib/access";

interface ManagedUser {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
}

interface UserEnvelope {
  data: ManagedUser[];
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(payload?.error?.message ?? "User operation failed");
  return payload;
}

export function UserAdministration({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const client = useQueryClient();
  const users = useQuery<UserEnvelope>({
    queryKey: ["admin-users"],
    queryFn: () => api("/api/users"),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(null);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ path, init }: { path: string; init: RequestInit }) =>
      api(path, init),
    onSuccess: async (payload) => {
      if (payload?.one_time_password)
        setOneTimePassword(payload.one_time_password);
      await client.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error ? failure.message : "User operation failed",
      ),
  });

  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    mutation.mutate(
      {
        path: "/api/users",
        init: {
          method: "POST",
          body: JSON.stringify({
            username: form.get("username"),
            role: form.get("role"),
          }),
        },
      },
      { onSuccess: () => setCreateOpen(false) },
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">ADMINISTRATION / ACCESS</p>
          <h1>User administration</h1>
          <p>
            Manage the users stored in the current tenant database. Historical
            commander and BGS data is unaffected.
          </p>
        </div>
        <div>
          <button
            className="primary-button"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={15} />
            New user
          </button>
        </div>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          <strong>{error}</strong>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <section className="surface user-admin-surface">
        {users.isLoading && (
          <p className="inline-empty">Loading tenant users…</p>
        )}
        {users.data?.data.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            self={user.id === currentUserId}
            disabled={mutation.isPending}
            onSave={(value) =>
              mutation.mutate({
                path: `/api/users/${encodeURIComponent(user.id)}`,
                init: { method: "PATCH", body: JSON.stringify(value) },
              })
            }
            onReset={() =>
              mutation.mutate({
                path: `/api/users/${encodeURIComponent(user.id)}/reset-password`,
                init: { method: "POST" },
              })
            }
            onDelete={() =>
              mutation.mutate({
                path: `/api/users/${encodeURIComponent(user.id)}`,
                init: { method: "DELETE" },
              })
            }
          />
        ))}
      </section>
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal-content">
            <div className="sheet-heading">
              <div>
                <Dialog.Title>Create tenant user</Dialog.Title>
                <Dialog.Description>
                  A one-time password is generated and displayed once.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close">
                <X size={19} />
              </Dialog.Close>
            </div>
            <form className="account-form" onSubmit={createUser}>
              <label>
                <span>Username</span>
                <input name="username" minLength={3} required />
              </label>
              <label>
                <span>Role</span>
                <select name="role" defaultValue="member">
                  <option value="member">Member</option>
                  <option value="leadership">Leadership</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <footer>
                <Dialog.Close className="secondary-button" type="button">
                  Cancel
                </Dialog.Close>
                <button
                  className="primary-button"
                  disabled={mutation.isPending}
                >
                  Create user
                </button>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={Boolean(oneTimePassword)}
        onOpenChange={(open) => !open && setOneTimePassword(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="modal-content">
            <div className="sheet-heading">
              <div>
                <Dialog.Title>One-time password</Dialog.Title>
                <Dialog.Description>
                  Copy it now. It is not logged and will not be shown again.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close">
                <X size={19} />
              </Dialog.Close>
            </div>
            <div className="one-time-password">
              <code>{oneTimePassword}</code>
              <button
                className="secondary-button"
                onClick={() =>
                  oneTimePassword &&
                  navigator.clipboard.writeText(oneTimePassword)
                }
              >
                Copy
              </button>
            </div>
            <footer>
              <Dialog.Close className="primary-button">
                I have saved it
              </Dialog.Close>
            </footer>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function UserRow({
  user,
  self,
  disabled,
  onSave,
  onReset,
  onDelete,
}: {
  user: ManagedUser;
  self: boolean;
  disabled: boolean;
  onSave: (value: Partial<ManagedUser>) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  return (
    <article className="user-admin-row">
      <div>
        <strong>
          {user.username}
          {self ? " (you)" : ""}
        </strong>
        <span>
          {user.last_login_at
            ? `Last login ${new Date(user.last_login_at).toLocaleString("en-GB")}`
            : "Never signed in"}
          {user.must_change_password ? " · password change required" : ""}
        </span>
      </div>
      <label>
        <span>Username</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </label>
      <label>
        <span>Role</span>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
        >
          <option value="member">Member</option>
          <option value="leadership">Leadership</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="active-toggle">
        <input
          type="checkbox"
          checked={active}
          disabled={self}
          onChange={(event) => setActive(event.target.checked)}
        />
        <span>Active</span>
      </label>
      <div className="user-row-actions">
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={() => onSave({ username, role, active })}
        >
          <Save size={14} />
          Save
        </button>
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={onReset}
        >
          <KeyRound size={14} />
          Reset
        </button>
        <button
          className="danger-button"
          disabled={disabled || self}
          onClick={() =>
            confirm(`Delete ${user.username} permanently?`) && onDelete()
          }
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </article>
  );
}
