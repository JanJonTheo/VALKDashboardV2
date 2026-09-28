"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { ASSISTS, remoteRequest, videoPoint, type ControlLease, type MediaAccess, type RemoteDevice,
  type RemoteStatus, type StartReview, type ViewerState } from "@/lib/remote-screen";

const button = "rounded border border-white/20 px-3 py-2 text-sm disabled:opacity-40 hover:bg-white/10";
const input = "rounded border border-white/20 bg-black/30 px-3 py-2";

export function AnkeRemote() {
  const [devices, setDevices] = useState<RemoteDevice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pairing, setPairing] = useState("");
  const refresh = useCallback(async () => {
    const result = await remoteRequest<{ devices: RemoteDevice[] }>("devices");
    setDevices(result.devices);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(); } catch (e) { if (!stopped) setError(String(e)); }
      if (!stopped) timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [refresh]);
  const device = devices.find((d) => d.id === selected);
  const sharedDevice = devices.find((d) => d.id === sharing && d.owner) ?? (device?.owner ? device : undefined);
  return <section className="space-y-5">
    <div><p className="text-sm opacity-60">Operations</p><h1 className="text-2xl font-semibold">ANKe Remote</h1>
      <p className="mt-2 opacity-70">Live Elite screens shared with you. Opening a screen starts transmission.</p></div>
    <button className={button} onClick={() => void remoteRequest<{code: string}>("pairings", "POST", {}).then((x) => {
      setPairing(x.code); setTimeout(() => setPairing(""), 600000);
    }).catch((e) => setError(String(e)))}>Pair an ANKe client</button>
    {pairing && <div className="rounded border border-white/20 p-4"><p>Enter this one-time code in ANKe within 10 minutes:</p>
      <code className="break-all select-all">{pairing}</code></div>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{devices.map((d) => <article key={d.id} className="rounded border border-white/15 p-4 space-y-2">
      <h2 className="font-semibold">{d.name}</h2><p>{d.status.commander || "Commander unavailable"}</p>
      <p className="text-sm opacity-70">{d.online ? "Online" : "Offline"} · {d.status.assist || "No assist"}</p>
      <p className="text-sm">Control {d.status.control_enabled ? "enabled locally" : "disabled locally"}{d.operator ? ` · ${d.operator}` : ""}</p>
      <button className={button} disabled={!d.online} onClick={() => setSelected(d.id)}>Open screen</button>
      {d.owner && <button className={`${button} ml-2`} onClick={() => setSharing(d.id)}>Manage access</button>}
    </article>)}</div>
    {!devices.length && <p>No clients are available. Pair a client or ask its owner to share it with your account.</p>}
    {device && <RemoteViewer key={device.id} device={device} onClose={() => setSelected(null)} />}
    {sharedDevice && <Sharing key={`access-${sharedDevice.id}`} device={sharedDevice} refresh={refresh} />}
  </section>;
}

function Sharing({ device, refresh }: { device: RemoteDevice; refresh: () => Promise<void> }) {
  const [user, setUser] = useState("");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<{id: string; name: string}[]>([]);
  const [rights, setRights] = useState("view");
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    const timer = setTimeout(() => {
      void remoteRequest<{users: {id: string; name: string}[]}>(`devices/${device.id}/share-candidates?q=${encodeURIComponent(query)}`, "GET", undefined, abort.signal)
        .then((result) => setCandidates(result.users)).catch((e) => { if (!abort.signal.aborted) setError(String(e)); });
    }, 250);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [device.id, query]);
  const save = (user_id: string, grants: string[]) => void remoteRequest(`devices/${device.id}/grants`, "PUT", { user_id, rights: grants })
    .then(refresh).catch((e) => setError(String(e)));
  return <section className="rounded border border-white/20 p-4 space-y-3"><h2 className="font-semibold">Client access</h2>
    <p className="text-sm opacity-70">Share with someone in your tenant. Admin roles do not grant screen access.</p>
    <div className="flex flex-wrap gap-2"><input className={input} aria-label="Find a user" placeholder="Search name (at least 2 characters)" value={query} onChange={(e) => { setQuery(e.target.value); setUser(""); }} />
      <select className={input} aria-label="User to share with" value={user} onChange={(e) => setUser(e.target.value)}><option value="">Choose a user</option>{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select>
      <select className={input} aria-label="Access rights" value={rights} onChange={(e) => setRights(e.target.value)}><option value="view">View</option><option value="control">View and control</option></select>
      <button className={button} disabled={!user.trim()} onClick={() => save(user.trim(), rights === "control" ? ["view", "control"] : ["view"])}>Grant access</button></div>
    {Object.entries(device.grants).map(([id, grants]) => <p key={id}>{id}: {grants.join(", ")} <button className={button} onClick={() => save(id, [])}>Revoke</button></p>)}
    <button className={button} onClick={() => { if (confirm("Unpair this ANKe client and end its sessions?")) void remoteRequest(`devices/${device.id}`, "DELETE").then(refresh).catch((e) => setError(String(e))); }}>Unpair client</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}

function RemoteViewer({ device, onClose }: { device: RemoteDevice; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const room = useRef<Room | null>(null);
  const viewer = useRef("");
  const leaseRef = useRef<ControlLease | null>(null);
  const wantsControl = useRef(false);
  const controlRevision = useRef(0);
  const acquiring = useRef(false);
  const serverOffset = useRef(0);
  const lastDecodedAt = useRef(0);
  const lastStatusAt = useRef(0);
  const capturedAt = useRef(0);
  const seq = useRef(0);
  const movement = useRef<Record<string, unknown> | null>(null);
  const pressed = useRef(new Set<string>());
  const buttons = useRef(new Set<number>());
  const profileRef = useRef("standard");
  const active = useRef(true);
  const [status, setStatus] = useState<RemoteStatus>({});
  const [age, setAge] = useState("—");
  const [lease, setLease] = useState<ControlLease | null>(null);
  const [connected, setConnected] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [quality, setQuality] = useState("unknown");
  const [error, setError] = useState("");
  const [mode, setMode] = useState(ASSISTS[0]);
  const [review, setReview] = useState<StartReview | null>(null);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [busy, setBusy] = useState(false);
  const base = `devices/${device.id}`;

  const send = useCallback((data: Record<string, unknown>) => {
    const current = leaseRef.current;
    if (!current || current.mode !== "manual" || !room.current) return;
    const packet = { ...data, epoch: current.epoch, seq: ++seq.current, sent_at: Date.now()/1000 + serverOffset.current };
    void room.current.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(packet)), {
      reliable: data.type !== "move" && data.type !== "relative", topic: "anke.input.v1", destinationIdentities: [`device-${device.id}`],
    }).catch(() => { wantsControl.current = false; });
  }, [device.id]);

  const release = useCallback(() => {
    controlRevision.current++;
    send({ type: "release" });
    wantsControl.current = false; leaseRef.current = null; movement.current = null;
    pressed.current.clear(); buttons.current.clear();
    if (active.current) { setLease(null); setReview(null); }
    if (document.pointerLockElement) document.exitPointerLock();
    if (viewer.current) void remoteRequest(`${base}/viewers/${viewer.current}/control`, "DELETE").catch(() => {});
  }, [base, send]);

  useEffect(() => {
    active.current = true;
    let stopped = false, mediaRoom = "";
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function connect(media: MediaAccess) {
      if (media.room === mediaRoom && room.current) return;
      if (room.current) await room.current.disconnect();
      if (stopped) return;
      mediaRoom = media.room;
      const next = new Room({ adaptiveStream: true });
      room.current = next;
      next.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video && publication.source === Track.Source.ScreenShare && participant.identity === `device-${device.id}` && video.current) {
          track.attach(video.current); setConnected(true);
        }
      });
      next.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); setConnected(false); });
      next.on(RoomEvent.Disconnected, () => { if (!stopped) { mediaRoom = ""; setConnected(false); release(); } });
      next.on(RoomEvent.ConnectionQualityChanged, (value, participant) => {
        if (participant.identity === `device-${device.id}` || participant === next.localParticipant) setQuality(String(value));
      });
      await next.connect(media.url, media.token);
    }
    async function pulse() {
      try {
        if (!viewer.current) {
          const joined = await remoteRequest<{viewer_id: string; media: MediaAccess}>(`${base}/viewers`, "POST", {}, abort.signal);
          if (stopped) {
            void remoteRequest(`${base}/viewers/${joined.viewer_id}`, "DELETE").catch(() => {});
            return;
          }
          viewer.current = joined.viewer_id;
          await connect(joined.media);
        }
        const revision = controlRevision.current;
        const state = await remoteRequest<ViewerState>(`${base}/viewers/${viewer.current}`, "POST", {
          control: wantsControl.current, profile: profileRef.current,
        }, abort.signal);
        if (stopped) return;
        serverOffset.current = state.server_time - Date.now()/1000;
        if (revision === controlRevision.current && !acquiring.current) {
          leaseRef.current = state.lease?.viewer === viewer.current ? state.lease : null;
          if (!leaseRef.current) wantsControl.current = false;
          setLease(leaseRef.current);
        }
        setStatus(state.status);
        lastStatusAt.current = Date.now();
        capturedAt.current = state.status.frame_at ?? 0;
        setAge(state.status.frame_at ? Math.max(0, state.server_time - state.status.frame_at).toFixed(1) : "—");
        await connect(state.media);
        if (!stopped) setError("");
        if (!stopped) timer = setTimeout(pulse, 800);
      } catch (e) {
        if (!stopped) {
          setError(String(e)); release(); setConnected(false); await room.current?.disconnect();
          if (viewer.current) void remoteRequest(`${base}/viewers/${viewer.current}`, "DELETE").catch(() => {});
          viewer.current = ""; mediaRoom = "";
          if (!stopped) timer = setTimeout(pulse, 2000);
        }
      }
    }
    void pulse();
    const blur = () => release();
    const visibility = () => { if (document.hidden) release(); };
    let wasLocked = false;
    const pointerLock = () => {
      if (wasLocked && !document.pointerLockElement) release();
      wasLocked = !!document.pointerLockElement;
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", pointerLock);
    const inputState = setInterval(() => {
      if (leaseRef.current?.mode === "manual") send({ type: "state", keys: [...pressed.current], buttons: [...buttons.current] });
    }, 100);
    const movements = setInterval(() => {
      if (movement.current) { send(movement.current); movement.current = null; }
    }, 33);
    const element = video.current;
    let frameCallback = 0;
    const decoded = () => {
      lastDecodedAt.current = Date.now();
      frameCallback = element?.requestVideoFrameCallback(decoded) ?? 0;
    };
    frameCallback = element?.requestVideoFrameCallback(decoded) ?? 0;
    const freshness = setInterval(() => {
      const now = Date.now();
      const current = now - lastDecodedAt.current < 2000 && now - lastStatusAt.current < 3000;
      setFresh(current);
      setAge(capturedAt.current ? Math.max(0, now/1000 + serverOffset.current - capturedAt.current).toFixed(1) : "—");
      if (!current && leaseRef.current?.mode === "manual") release();
    }, 250);
    return () => {
      stopped = true; active.current = false; abort.abort(); clearTimeout(timer); clearInterval(movements);
      clearInterval(inputState); document.removeEventListener("pointerlockchange", pointerLock);
      clearInterval(freshness); element?.cancelVideoFrameCallback(frameCallback);
      window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility);
      release();
      if (viewer.current) void remoteRequest(`${base}/viewers/${viewer.current}`, "DELETE").catch(() => {});
      viewer.current = ""; void room.current?.disconnect(); room.current = null;
    };
  }, [base, device.id, release, send]);

  const acquire = async (controlMode: "assist" | "manual") => {
    if (acquiring.current || !viewer.current) return;
    acquiring.current = true;
    const revision = ++controlRevision.current;
    try {
      const result = await remoteRequest<{lease: ControlLease}>(`${base}/viewers/${viewer.current}/control`, "POST", { mode: controlMode });
      if (!active.current || revision !== controlRevision.current) { release(); return; }
      controlRevision.current++;
      wantsControl.current = true; leaseRef.current = result.lease; setLease(result.lease); setReview(null); setError("");
      surface.current?.focus();
    } catch (e) { setError(String(e)); }
    finally { acquiring.current = false; }
  };
  const command = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true); setError("");
    try {
      const sent = await remoteRequest<{command_id: string}>(`${base}/commands`, "POST", { action, viewer_id: viewer.current, ...extra });
      const deadline = Date.now() + 31000;
      while (active.current && Date.now() < deadline) {
        const value = await remoteRequest<{state: string; result: StartReview & { error?: string }}>(`${base}/commands/${sent.command_id}`);
        if (value.state !== "pending") {
          if (value.state !== "completed") throw new Error(value.result?.error ?? "Command expired");
          if (action === "prepare") { setReview(value.result); setChecks(value.result.checks.map(() => false)); }
          else { setReview(null); if (action === "confirm") release(); }
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
      throw new Error("Command timed out. Its result is not confirmed.");
    } catch (e) { if (active.current) setError(String(e)); }
    finally { if (active.current) setBusy(false); }
  };
  const manual = lease?.mode === "manual" && status.manual_ready && connected && fresh && status.capture === "live";
  return <section className="rounded border border-white/20 p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">{device.name} · Live screen</h2>
      <button className={button} onClick={onClose}>Close screen</button></div>
    <div ref={surface} tabIndex={0} aria-label="Elite remote keyboard and mouse control" className="relative bg-black outline-offset-4"
      onBlur={() => { if (manual) release(); }}
      onKeyDown={(e) => { if (manual) { e.preventDefault(); if (!e.repeat) { pressed.current.add(e.code); send({ type: "key", code: e.code, down: true }); } } }}
      onKeyUp={(e) => { if (manual) { e.preventDefault(); pressed.current.delete(e.code); send({ type: "key", code: e.code, down: false }); } }}
      onContextMenu={(e) => { if (manual) e.preventDefault(); }}
      onMouseDown={(e) => { if (manual) { e.preventDefault(); surface.current?.focus(); buttons.current.add(e.button); send({ type: "button", button: e.button, down: true }); } }}
      onMouseUp={(e) => { if (manual) { buttons.current.delete(e.button); send({ type: "button", button: e.button, down: false }); } }}
      onMouseLeave={() => { if (manual && !document.pointerLockElement) release(); }}
      onMouseMove={(e) => {
        if (!manual || !video.current) return;
        if (document.pointerLockElement) {
          const last = movement.current;
          movement.current = { type: "relative", x: Math.max(-1000, Math.min(1000, Number(last?.x ?? 0) + e.movementX)), y: Math.max(-1000, Math.min(1000, Number(last?.y ?? 0) + e.movementY)) };
        } else {
          const point = videoPoint(video.current.getBoundingClientRect(), video.current.videoWidth, video.current.videoHeight, e.clientX, e.clientY);
          if (point) movement.current = { type: "move", ...point };
        }
      }} onWheel={(e) => { if (manual) send({ type: "wheel", delta: Math.sign(-e.deltaY) * 120 }); }}>
      <video ref={video} autoPlay playsInline muted className="w-full max-h-[70vh] object-contain" />
      {(!connected || !fresh || status.capture !== "live") && <div className="absolute inset-0 grid place-items-center bg-black"><p>{status.capture === "live" ? "Waiting for current frames" : status.capture || "Connecting …"} · no current live image</p></div>}
    </div>
    <p className="text-sm opacity-70">{connected ? "Connected" : "Waiting"} · Quality: {quality} · Image age: {age}s · {lease ? `Operator ${lease.user}: ${lease.mode}${lease.mode === "manual" && !manual ? " (waiting for ANKe handoff)" : ""}` : "Viewing only"}</p>
    <div className="flex flex-wrap gap-2">
      <select className={input} aria-label="Video quality" defaultValue="standard" onChange={(e) => { profileRef.current = e.target.value; }}><option value="standard">720p / 15 FPS</option><option value="detail">1080p / 30 FPS</option></select>
      <button className={button} onClick={() => void surface.current?.requestFullscreen().catch((e) => setError(String(e)))}>Fullscreen</button>
      {device.can_control && <>
        <button className={button} disabled={!connected || !status.control_enabled || busy} onClick={() => void acquire("assist")}>Control assists</button>
        <button className={`${button} hidden md:block`} disabled={!connected || !fresh || !status.control_enabled || busy} onClick={() => void acquire("manual")}>Take manual control</button>
        <button className={button} disabled={!lease} onClick={release}>Release control</button>
        {manual && <button className={button} onMouseDown={(e) => e.preventDefault()} onClick={() => {
          surface.current?.focus(); void surface.current?.requestPointerLock();
        }}>Relative mouse · Esc to exit</button>}
        <button className={`${button} border-red-500 text-red-300`} disabled={!status.control_enabled} onClick={() => { release(); void command("stop"); }}>Stop all assists / zero throttle</button>
      </>}
    </div>
    {lease?.mode === "assist" && <div className="flex flex-wrap gap-2"><select className={input} aria-label="Assist" value={mode} onChange={(e) => setMode(e.target.value)}>{ASSISTS.map((a) => <option key={a}>{a}</option>)}</select>
      <button className={button} disabled={busy} onClick={() => void command("prepare", { assist: mode })}>Review start</button></div>}
    {review && <section className="space-y-3 rounded border border-amber-400/40 p-4"><h3 className="font-semibold">Confirm {review.assist}</h3>
      <p className="text-sm">Uses the current local configuration. Review expires after 30 seconds.</p>
      {review.sections.map(([name, tables]) => <div key={name}><h4 className="font-semibold">{name}</h4>{tables.map(([headers, rows], index) => <div className="overflow-auto" key={index}><table className="text-sm"><thead><tr>{headers.map((h) => <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((v, j) => <td className="p-2" key={j}>{v}</td>)}</tr>)}</tbody></table></div>)}</div>)}
      {review.checks.map((text, i) => <label className="block" key={text}><input type="checkbox" checked={checks[i] ?? false} onChange={(e) => setChecks((old) => old.map((v, n) => n === i ? e.target.checked : v))} /> {text}</label>)}
      <button className={button} disabled={busy || checks.some((v) => !v)} onClick={() => void command("confirm", { review_id: review.review_id, checks })}>Confirm and start</button>
      <button className={button} onClick={() => setReview(null)}>Cancel</button>
    </section>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
