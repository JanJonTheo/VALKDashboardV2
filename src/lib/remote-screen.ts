export interface MediaAccess { url: string; token: string; room: string; identity: string }
export interface RemoteStatus {
  commander?: string; assist?: string; capture?: string; frame_at?: number;
  manual_ready?: boolean; enabled?: boolean; control_enabled?: boolean;
}
export interface RemoteDevice {
  id: string; name: string; owner: boolean; grants: Record<string, string[]>;
  online: boolean; can_control: boolean; operator?: string; status: RemoteStatus;
}
export interface ControlLease { epoch: string; participant: string; viewer: string; user: string; mode: "manual" | "assist" }
export interface ViewerState { media: MediaAccess; lease: ControlLease | null; status: RemoteStatus; server_time: number }
export interface StartReview {
  review_id: string; assist: string; checks: string[]; expires_in: number;
  sections: [string, [string[], string[][]][]][];
}
export const ASSISTS = ["FSD Route Assist", "Supercruise Assist", "Waypoint Assist", "Colonisation Assist",
  "RC Build Assist", "RC Build Assist (Renew Snapshot fc_loading)", "Robigo Assist", "AFK Combat Assist", "DSS Assist"];

export function videoPoint(rect: { left: number; top: number; width: number; height: number },
  width: number, height: number, clientX: number, clientY: number) {
  if (!width || !height || !rect.width || !rect.height) return null;
  const scale = Math.min(rect.width / width, rect.height / height);
  const w = width * scale, h = height * scale;
  const x = (clientX - rect.left - (rect.width - w) / 2) / w;
  const y = (clientY - rect.top - (rect.height - h) / 2) / h;
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export async function remoteRequest<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/remote-screen/${path}`, {
    method, headers: { "content-type": "application/json" }, cache: "no-store", signal,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? "Remote request failed");
  return data as T;
}
