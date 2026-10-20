import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AnkeDiagnostics } from "@/components/anke-diagnostics";

afterEach(()=>{ cleanup(); vi.unstubAllGlobals(); });

it("shows compact messages, location lines and full details without a video session",async()=>{
  const events=Array.from({length:25},(_,i)=>({id:`event-${i}`,at:"2026-10-20T12:00:00Z",clock:"14:00:00",
    icon:"📦",compact:`Buying gold ${i}`,message:`Full operation message ${i}`,locations:[["Sys","Sol"]]}));
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({events,logs:[],received_at:Date.now()/1000,status:{queued_bytes:512}})});
  vi.stubGlobal("fetch",fetcher);
  render(<AnkeDiagnostics deviceId={"a".repeat(32)} />);
  await screen.findByText("Buying gold 24",{exact:false});
  expect(screen.getAllByRole("listitem")).toHaveLength(25);
  expect(screen.getAllByText("Sys: Sol")).toHaveLength(25);
  expect(screen.getByText("Full operation message 24")).toBeInTheDocument();
  expect(fetcher.mock.calls.every(([url])=>String(url).includes("/diagnostics?"))).toBe(true);
});

it("loads bounded log pages and filters the displayed text",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockImplementation(async(url:string)=>({ok:true,json:async()=>url.includes("/logs/") ?
    {name:"Journal.1.log",text:'{"event":"CargoDepot","MissionID":123}\nother line',data:"",offset:0,next_offset:80,size:1000} :
    {events:[],logs:[{stream:"stream1",name:"Journal.1.log",kind:"journal",size:1000,updated_at:0}],received_at:null,status:{}}})));
  render(<AnkeDiagnostics deviceId={"a".repeat(32)} />);
  await screen.findByRole("option",{name:/Journal.1.log/});
  fireEvent.change(screen.getByLabelText("Diagnostic log"),{target:{value:"stream1"}});
  await screen.findByText(/CargoDepot/);
  fireEvent.change(screen.getByLabelText("Search current log page"),{target:{value:"123"}});
  expect(screen.queryByText("other line")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Next"})).toBeEnabled();
});

it("shows revoked access and exposes no cached log or messages",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:"Device access denied"}})}));
  render(<AnkeDiagnostics deviceId={"a".repeat(32)} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Device access denied");
  expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
});
