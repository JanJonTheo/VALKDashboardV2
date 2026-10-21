import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RemoteViewer } from "@/components/anke-remote";
import type { ControlLease, RemoteDevice } from "@/lib/remote-screen";

const mock = vi.hoisted(() => ({
  request: vi.fn(),
  publish: vi.fn(),
  lease: null as ControlLease | null,
  video: true,
  ready: true,
  failStatus: false,
  controlEpoch: 0,
  track: { kind: "video", attach: vi.fn(), detach: vi.fn() },
  handlers: {} as Record<string, (...args: unknown[]) => void>,
}));
vi.mock("@/lib/remote-screen", async (original) => ({
  ...(await original<typeof import("@/lib/remote-screen")>()),
  remoteRequest: mock.request,
}));
vi.mock("livekit-client", () => ({
  Track: { Kind: { Video: "video" }, Source: { ScreenShare: "screen" } },
  RoomEvent: {
    TrackSubscribed: "track",
    TrackUnsubscribed: "untrack",
    Disconnected: "disconnected",
    Reconnecting: "reconnecting",
    Reconnected: "reconnected",
    ConnectionQualityChanged: "quality",
  },
  Room: class {
    handlers: Record<string, (...args: unknown[]) => void> = {};
    localParticipant = { publishData: mock.publish };
    on(name: string, handler: (...args: unknown[]) => void) {
      this.handlers[name] = handler;
      mock.handlers[name] = handler;
    }
    async connect() {
      this.handlers.track?.(
        mock.track,
        { source: "screen" },
        { identity: `device-${"a".repeat(32)}` },
      );
    }
    async disconnect() {}
  },
}));

const device: RemoteDevice = {
  id: "a".repeat(32),
  name: "Tablet Elite",
  owner: true,
  can_control: true,
  online: true,
  grants: {},
  status: {},
};
beforeEach(() => {
  vi.useFakeTimers();
  mock.lease = null;
  mock.video = true;
  mock.ready = true;
  mock.failStatus = false;
  mock.controlEpoch = 0;
  mock.handlers = {};
  mock.track = { kind: "video", attach: vi.fn(), detach: vi.fn() };
  mock.publish.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(
    HTMLVideoElement.prototype,
    "requestVideoFrameCallback",
    {
      configurable: true,
      value: (callback: VideoFrameRequestCallback) =>
        Number(
          setTimeout(() => {
            if (mock.video) callback(0, {} as VideoFrameCallbackMetadata);
          }, 16),
        ),
    },
  );
  Object.defineProperty(
    HTMLVideoElement.prototype,
    "cancelVideoFrameCallback",
    { configurable: true, value: clearTimeout },
  );
  mock.request.mockReset().mockImplementation(async (path, method, body) => {
    if (path.endsWith("/viewers"))
      return { viewer_id: "viewer", media: { room: "test" } };
    if (path.endsWith("/control") && method === "POST") {
      mock.lease = {
        mode: body.mode,
        epoch: `epoch-${++mock.controlEpoch}`,
        viewer: "viewer",
        participant: "p",
        user: "owner",
      };
      return { lease: mock.lease };
    }
    if (path.endsWith("/control") && method === "DELETE") {
      mock.lease = null;
      return {};
    }
    if (path.endsWith("/commands")) return { command_id: body.action };
    if (path.endsWith("/commands/prepare"))
      return {
        state: "completed",
        result: {
          assist: "FSD Route Assist",
          review_id: "review",
          checks: ["Ready to start"],
          sections: [],
        },
      };
    if (path.includes("/commands/")) return { state: "completed", result: {} };
    if (mock.failStatus) throw new Error("Device access revoked");
    return {
      lease: mock.lease,
      media: { room: "test" },
      server_time: Date.now() / 1000,
      status: {
        capture: "live",
        frame_at: Date.now() / 1000,
        manual_ready: mock.ready,
        control_enabled: true,
        input_bindings: { UI_Up: ["ArrowUp"], FocusRightPanel: ["Digit4"] },
      },
    };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
async function tick(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

it("takes manual control, sends configured panel keys, keeps the lease when tapping controls and releases on stale video", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Systeme" }));
  await tick(200);
  const packets = mock.publish.mock.calls.map(([data]) =>
    JSON.parse(new TextDecoder().decode(data)),
  );
  expect(packets).toContainEqual(
    expect.objectContaining({ type: "key", code: "Digit4", down: true }),
  );
  expect(packets).toContainEqual(
    expect.objectContaining({ type: "key", code: "Digit4", down: false }),
  );
  expect(mock.lease?.mode).toBe("manual");
  mock.video = false;
  await tick(3000);
  expect(screen.getByRole("button", { name: "Systeme" })).toBeDisabled();
  expect(mock.lease?.mode).toBe("manual");
  await tick(8000);
  expect(mock.lease).toBeNull();
});

it.each(["untrack", "reconnecting"])(
  "resumes the same manual lease after a short %s without replaying held keys",
  async (reason) => {
    render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
    await tick();
    fireEvent.click(
      screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
    );
    await tick();
    const surface = screen.getByLabelText(
      "Elite remote keyboard and mouse control",
    );
    fireEvent.keyDown(surface, { code: "ArrowUp" });
    const originalLease = mock.lease;
    mock.publish.mockClear();
    act(() => {
      if (reason === "untrack") mock.handlers.untrack(mock.track);
      else mock.handlers.reconnecting();
    });
    expect(screen.getByRole("button", { name: "Systeme" })).toBeDisabled();
    await tick(1200);
    expect(mock.lease).toBe(originalLease);
    expect(screen.getByRole("status")).toHaveTextContent("Steuerung pausiert");
    const neutral = mock.publish.mock.calls.map(([data]) =>
      JSON.parse(new TextDecoder().decode(data)),
    );
    expect(neutral).toContainEqual(
      expect.objectContaining({ type: "state", keys: [], buttons: [] }),
    );
    expect(
      neutral.some(
        (packet) => packet.type === "release" || packet.down === true,
      ),
    ).toBe(false);
    act(() => {
      if (reason === "untrack")
        mock.handlers.track(
          mock.track,
          { source: "screen" },
          { identity: `device-${device.id}` },
        );
      else mock.handlers.reconnected();
    });
    await tick(500);
    expect(screen.getByRole("button", { name: "Systeme" })).toBeEnabled();
    expect(mock.lease).toBe(originalLease);
    expect(
      mock.request.mock.calls.filter(
        ([path, method]) => path.endsWith("/control") && method === "POST",
      ),
    ).toHaveLength(1);
    expect(
      mock.request.mock.calls.some(
        ([path, method]) => path.endsWith("/control") && method === "DELETE",
      ),
    ).toBe(false);
    expect(
      mock.publish.mock.calls
        .map(([data]) => JSON.parse(new TextDecoder().decode(data)))
        .some((packet) => packet.down === true),
    ).toBe(false);
  },
);

it.each(["release", "revocation", "timeout"])(
  "does not restore manual control after %s during a media pause",
  async (reason) => {
    render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
    await tick();
    fireEvent.click(
      screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
    );
    await tick();
    act(() => mock.handlers.reconnecting());
    if (reason === "release")
      fireEvent.click(screen.getByRole("button", { name: "Release control" }));
    else if (reason === "revocation") mock.lease = null;
    await tick(reason === "timeout" ? 8500 : 1000);
    act(() => mock.handlers.reconnected());
    await tick(1000);
    expect(mock.lease).toBeNull();
    expect(screen.getByRole("button", { name: "Systeme" })).toBeDisabled();
    expect(
      mock.request.mock.calls.filter(
        ([path, method]) => path.endsWith("/control") && method === "POST",
      ),
    ).toHaveLength(1);
  },
);

it("ignores unsubscription of an unrelated track", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  act(() => mock.handlers.untrack({ kind: "audio", detach: vi.fn() }));
  await tick(500);
  expect(screen.getByRole("button", { name: "Systeme" })).toBeEnabled();
  expect(mock.lease?.mode).toBe("manual");
});

it("ignores a late data failure from a released control epoch", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  let rejectOld!: (reason: Error) => void;
  mock.publish.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectOld = reject;
      }),
  );
  fireEvent.keyDown(
    screen.getByLabelText("Elite remote keyboard and mouse control"),
    { code: "ArrowUp" },
  );
  fireEvent.click(screen.getByRole("button", { name: "Release control" }));
  await tick(20);
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick(20);
  await act(async () => rejectOld(new Error("Old data channel failed")));
  await tick(500);
  expect(mock.lease?.epoch).toBe("epoch-2");
  expect(screen.getByRole("button", { name: "Systeme" })).toBeEnabled();
});

it("starts an assist only after reviewing and checking its required confirmations", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  );
  await tick(20);
  fireEvent.click(screen.getByRole("button", { name: "Review start" }));
  await tick(20);
  expect(
    screen.getByRole("button", { name: "Confirm and start" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Ready to start" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm and start" }));
  await tick(20);
  expect(mock.request).toHaveBeenCalledWith(
    expect.stringContaining("/commands"),
    "POST",
    {
      action: "confirm",
      viewer_id: "viewer",
      review_id: "review",
      checks: [true],
    },
  );
  expect(mock.lease).toBeNull();
});

it("never offers control to a view-only user", async () => {
  render(
    <RemoteViewer
      device={{ ...device, can_control: false }}
      onClose={vi.fn()}
      mobile
    />,
  );
  await tick();
  expect(
    screen.queryByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
  expect(
    screen.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  ).toBeDisabled();
});

it("waits for ANKe handoff and does not release control when focus moves to a panel button", async () => {
  mock.ready = false;
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  const panel = screen.getByRole("button", { name: "Systeme" });
  expect(panel).toBeDisabled();
  mock.ready = true;
  await tick();
  expect(panel).toBeEnabled();
  fireEvent.blur(
    screen.getByLabelText("Elite remote keyboard and mouse control"),
    { relatedTarget: panel },
  );
  expect(mock.lease?.mode).toBe("manual");
  fireEvent.click(panel);
  await tick(200);
  expect(mock.lease?.mode).toBe("manual");
});

it.each(["pointer", "keyboard"])(
  "keeps touch focus changes safe and releases when %s focus leaves the viewer",
  async (method) => {
    render(
      <>
        <button>Outside viewer</button>
        <RemoteViewer device={device} onClose={vi.fn()} mobile />
      </>,
    );
    await tick();
    fireEvent.click(
      screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
    );
    await tick();
    const surface = screen.getByLabelText(
      "Elite remote keyboard and mouse control",
    );
    // Safari can blur a focused element without focusing the tapped touch button.
    fireEvent.blur(surface, { relatedTarget: null });
    expect(mock.lease?.mode).toBe("manual");
    fireEvent.wheel(surface, { deltaY: 100 });
    expect(
      mock.publish.mock.calls
        .map(([data]) => JSON.parse(new TextDecoder().decode(data)))
        .some((packet) => packet.type === "wheel"),
    ).toBe(false);
    const outside = screen.getByRole("button", { name: "Outside viewer" });
    if (method === "pointer") fireEvent.pointerDown(outside);
    else fireEvent.blur(surface, { relatedTarget: outside });
    expect(mock.lease).toBeNull();
  },
);

it.each([
  "pagehide",
  "blur",
  "disconnected",
  "input-failure",
  "access-revoked",
])("releases manual control on %s", async (reason) => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  if (reason === "pagehide" || reason === "blur")
    fireEvent(window, new Event(reason));
  else if (reason === "disconnected") act(() => mock.handlers.disconnected());
  else if (reason === "input-failure")
    mock.publish.mockRejectedValue(new Error("Data channel failed"));
  else mock.failStatus = true;
  await tick();
  expect(mock.lease).toBeNull();
  expect(screen.getByRole("button", { name: "Systeme" })).toBeDisabled();
});

it("switches from manual to assist control with released keys and a new mode", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Manuelle Steuerung übernehmen" }),
  );
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  );
  await tick();
  expect(mock.lease?.mode).toBe("assist");
  expect(
    mock.publish.mock.calls.map(([data]) =>
      JSON.parse(new TextDecoder().decode(data)),
    ),
  ).toContainEqual(expect.objectContaining({ type: "release" }));
  expect(screen.getByRole("button", { name: "Review start" })).toBeEnabled();
});

it("expires start reviews and invalidates them when the selected assistant changes", async () => {
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  );
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Review start" }));
  await tick();
  fireEvent.click(screen.getByRole("checkbox", { name: "Ready to start" }));
  expect(
    screen.getByRole("button", { name: "Confirm and start" }),
  ).toBeEnabled();
  await tick(31000);
  expect(
    screen.getByRole("button", { name: "Confirm and start" }),
  ).toBeDisabled();
  expect(
    screen.getByText("Review expired. Request a new start review."),
  ).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Assist" }), {
    target: { value: "Waypoint Assist" },
  });
  expect(
    screen.queryByRole("button", { name: "Confirm and start" }),
  ).not.toBeInTheDocument();
});

it("does not restore a start review when a late response arrives after release", async () => {
  const original = mock.request.getMockImplementation()!;
  let respond!: (value: unknown) => void;
  mock.request.mockImplementation((path, ...args) =>
    path.endsWith("/commands/prepare")
      ? new Promise((resolve) => {
          respond = resolve;
        })
      : original(path, ...args),
  );
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Assistentensteuerung übernehmen" }),
  );
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Review start" }));
  await tick();
  fireEvent.click(screen.getByRole("button", { name: "Release control" }));
  await act(async () => {
    respond({
      state: "completed",
      result: {
        assist: "FSD Route Assist",
        review_id: "old",
        checks: [],
        sections: [],
      },
    });
  });
  expect(
    screen.queryByRole("button", { name: "Confirm and start" }),
  ).not.toBeInTheDocument();
  expect(mock.lease).toBeNull();
});

it("sends stop without an assist lease and reports command failures persistently", async () => {
  const original = mock.request.getMockImplementation()!;
  mock.request.mockImplementation(async (path, ...args) =>
    path.endsWith("/commands/stop")
      ? { state: "failed", result: { error: "Client rejected stop" } }
      : original(path, ...args),
  );
  render(<RemoteViewer device={device} onClose={vi.fn()} mobile />);
  await tick();
  fireEvent.click(
    screen.getByRole("button", { name: "Stop all assists / zero throttle" }),
  );
  await tick(2000);
  expect(mock.request).toHaveBeenCalledWith(
    expect.stringContaining("/commands"),
    "POST",
    { action: "stop", viewer_id: "viewer" },
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Client rejected stop");
});
