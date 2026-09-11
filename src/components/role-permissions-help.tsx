"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CircleHelp, X } from "lucide-react";
import { can, roles, type Capability } from "@/lib/access";

const labels: Record<Capability, string> = {
  "dashboard:read": "View dashboards, analytics, watchlists and visible alerts",
  "rules:write": "Manage personal BGS rules",
  "tenant-rules:write": "Manage tenant BGS rules and shared watchlist labels",
  "bgs-ai:run": "Run BGS AI analysis",
  "objectives:write": "Create and manage objectives",
  "reports:send": "Send reports and alerts to Discord",
  "assessment:run": "Run performance assessments",
  "admin:read": "Access administration, data explorer and service diagnostics",
  "users:read": "View tenant users",
  "users:manage": "Create, edit, deactivate and delete users; reset passwords",
  "protected-factions:manage": "Manage protected factions",
};

export function RolePermissionsHelp() {
  const rows = [
    ...Object.entries(labels).map(([capability, label]) => ({
      label,
      allowed: roles.map((role) => can(role, capability as Capability)),
    })),
    {
      label: "Mark individual visible alerts as read (own account)",
      allowed: [true, true, true],
    },
    {
      label: "Mark all visible alerts as read after confirmation (own account)",
      allowed: roles.map((role) => role === "admin"),
    },
    {
      label: "Resolve or delete own personal alerts",
      allowed: [true, true, true],
    },
    {
      label: "Resolve or delete shared tenant / protected-faction alerts",
      allowed: roles.map((role) => role === "admin"),
    },
    {
      label: "Manage own profile, password and linked sign-in accounts",
      allowed: [true, true, true],
    },
  ];
  return (
    <Dialog.Root>
      <Dialog.Trigger className="secondary-button">
        <CircleHelp size={15} />
        Roles &amp; permissions
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="modal-content role-permissions-help">
          <div className="sheet-heading">
            <div>
              <Dialog.Title>Roles &amp; permissions</Dialog.Title>
              <Dialog.Description>
                Permissions apply within the current tenant. Personal data and
                read states belong to the individual account.
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close permissions help">
              <X size={19} />
            </Dialog.Close>
          </div>
          <div
            className="role-permissions-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Role permissions matrix"
          >
            <table className="role-permissions-table">
              <thead>
                <tr>
                  <th scope="col">Permission</th>
                  <th scope="col">Member</th>
                  <th scope="col">Leadership</th>
                  <th scope="col">Admin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {row.allowed.map((allowed, index) => (
                      <td key={roles[index]}>{allowed ? "Yes" : "No"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Shared alerts are visible to all roles; personal alerts are visible
            only to their owner. Marking alerts as read does not resolve them or
            change another user’s read state.
          </p>
          <p>
            User administration protects your own account and the last active
            admin from deletion or loss of access. Available actions also depend
            on ownership and configured services.
          </p>
          <footer>
            <Dialog.Close className="primary-button">Done</Dialog.Close>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
