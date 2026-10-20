"use client";

import { useEffect, useRef, useState } from "react";
import { remoteRequest } from "@/lib/remote-screen";

interface Event { id: string; at: string; clock: string; icon: string; compact: string; message: string; locations: [string,string][] }
interface Log { stream: string; name: string; kind: string; size: number; updated_at: number }
interface Diagnostics { has_more_logs?: boolean; log_offset?: number; events: Event[]; logs: Log[]; received_at: number | null; status: { queued_bytes?: number; gap?: string } }
interface Page { name: string; text: string; data: string; offset: number; next_offset: number; size: number }
const control = "rounded border border-white/20 bg-black/30 px-3 py-2 text-sm disabled:opacity-40";

export function AnkeDiagnostics({ deviceId }: { deviceId: string }) {
  const [data,setData] = useState<Diagnostics | null>(null);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState("");
  const [logOffset,setLogOffset] = useState(0);
  const [page,setPage] = useState<Page | null>(null);
  const [filter,setFilter] = useState("");
  const [query,setQuery] = useState("");
  const [search,setSearch] = useState("");
  const [kind,setKind] = useState("");
  const [since,setSince] = useState("");
  const [busy,setBusy] = useState(false);
  const [now,setNow] = useState(0);
  const lifetime = useRef({active:true});
  const revision = useRef(0);
  const base = `devices/${deviceId}/diagnostics`;
  useEffect(() => {
    let stopped = false;
    const token=lifetime.current;
    token.active=true;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const result = await remoteRequest<Diagnostics>(`${base}?log_offset=${logOffset}`,"GET",undefined,abort.signal);
        if (!stopped) { setData(result); setNow(Date.now()/1000); setError(""); }
      } catch (e) { if (!stopped) { setError(String(e)); setData(null); setPage(null); } }
      if (!stopped) timer=setTimeout(poll,3000);
    }
    void poll();
    return () => { stopped=true; abort.abort(); clearTimeout(timer); token.active=false; };
  },[base,logOffset]);
  async function load(stream: string,offset=0,term=search) {
    const version=++revision.current;
    setSelected(stream); setSearch(term); setBusy(true);
    try {
      const result=await remoteRequest<Page>(`${base}/logs/${stream}?offset=${offset}&q=${encodeURIComponent(term)}`);
      if (lifetime.current.active && version===revision.current) { setPage(result); setError(""); }
    } catch(e) { if (lifetime.current.active && version===revision.current) { setError(String(e)); setPage(null); } }
    finally { if (lifetime.current.active && version===revision.current) setBusy(false); }
  }
  async function download() {
    const version=++revision.current;
    setBusy(true);
    try {
      let offset=0;
      const chunks: Uint8Array<ArrayBuffer>[]=[];
      let name="anke.log";
      while (true) {
        const result=await remoteRequest<Page>(`${base}/logs/${selected}?offset=${offset}`);
        if (!lifetime.current.active || version!==revision.current) return;
        name=result.name;
        chunks.push(Uint8Array.from(atob(result.data),(c)=>c.charCodeAt(0)));
        if (result.next_offset>=result.size || result.next_offset===offset) break;
        offset=result.next_offset;
      }
      const url=URL.createObjectURL(new Blob(chunks,{type:"text/plain;charset=utf-8"}));
      const link=document.createElement("a"); link.href=url; link.download=name; link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) { if (lifetime.current.active && version===revision.current) setError(String(e)); }
    finally { if (lifetime.current.active && version===revision.current) setBusy(false); }
  }
  const logs=(data?.logs??[]).filter((log)=>(!kind || log.kind===kind) && (!since || log.updated_at>=new Date(since).getTime()/1000));
  return <section aria-label="ANKe diagnostics" className="space-y-3 rounded border border-white/20 p-4">
    <h3 className="font-semibold">Remote diagnostics · Last 25 messages</h3>
    <p className="text-sm opacity-70">{data?.received_at ? `Last received ${new Date(data.received_at*1000).toLocaleString()}` : "Waiting for diagnostic data"}
      {data?.received_at && now-data.received_at>15 ? " · Client offline / data delayed" : ""}
      {` · ${Math.round((data?.status.queued_bytes??0)/1024)} KiB queued on client`}</p>
    {data?.status.gap && <p role="status" className="text-amber-300">{data.status.gap}</p>}
    <ol className="max-h-96 space-y-1 overflow-auto text-sm">{data?.events.map((event)=><li key={event.id}>
      <details><summary className="cursor-pointer"><span>{event.icon}</span> <time dateTime={event.at}>{event.clock}</time> {event.compact}</summary>
        <pre className="whitespace-pre-wrap break-words p-2">{event.message}</pre><button className={control} disabled={!selected || busy} onClick={()=>{setQuery(event.message.slice(0,180));void load(selected,0,event.message.slice(0,180));}}>Find in selected log</button></details>
      {event.locations?.map(([prefix,name],i)=><p className="pl-6 opacity-75" key={i}>{prefix}: {name}</p>)}
    </li>)}</ol>
    <div className="flex flex-wrap gap-2">
      <select className={control} aria-label="Log type" value={kind} onChange={(e)=>setKind(e.target.value)}><option value="">All log types</option><option value="autopilot">ANKe</option><option value="remote">Remote</option><option value="journal">Elite journals</option></select>
      <input className={control} aria-label="Logs updated since" type="datetime-local" value={since} onChange={(e)=>setSince(e.target.value)} />
      <select className={control} aria-label="Diagnostic log" value={selected} onChange={(e)=>void load(e.target.value,0,"")}><option value="">Select a log</option>{logs.map((log)=><option value={log.stream} key={log.stream}>{log.name} · {Math.round(log.size/1024)} KiB</option>)}</select>
    </div>
    <div className="flex gap-2"><button className={control} disabled={!logOffset} onClick={()=>setLogOffset(Math.max(0,logOffset-250))}>Previous files</button><button className={control} disabled={!data?.has_more_logs} onClick={()=>setLogOffset(logOffset+250)}>More files</button><span className="self-center text-xs opacity-60">Files {logOffset+1}–{logOffset+(data?.logs.length??0)}</span></div>
    {page && <>
      <div className="flex gap-2"><input className={control} aria-label="Search entire log" placeholder="Search log text, FID or MissionID" value={query} onChange={(e)=>setQuery(e.target.value)} /><button className={control} disabled={busy} onClick={()=>void load(selected,0,query)}>Search archive</button><button className={control} disabled={busy || !search} onClick={()=>void load(selected,0,"")}>Clear search</button></div>
      <div className="flex flex-wrap gap-2"><input className={control} aria-label="Search current log page" placeholder="Filter this page (text, FID or mission ID)" value={filter} onChange={(e)=>setFilter(e.target.value)} />
        <button className={control} disabled={busy || page.offset===0} onClick={()=>void load(selected,Math.max(0,page.offset-(search ? 1048576 : 65536)))}>Previous</button>
        <button className={control} disabled={busy || page.next_offset>=page.size} onClick={()=>void load(selected,page.next_offset)}>Next</button>
        <button className={control} disabled={busy} onClick={()=>void load(selected,page.offset)}>Refresh page</button>
        <button className={control} disabled={busy} onClick={()=>void download()}>Download log</button></div>
      <p className="text-xs opacity-60">Bytes {page.offset}–{page.next_offset} of {page.size} · Archives retained for 30 days</p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-black/40 p-3 text-xs">{filter ? page.text.split("\n").filter((line)=>line.toLowerCase().includes(filter.toLowerCase())).join("\n") : page.text}</pre>
    </>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </section>;
}
