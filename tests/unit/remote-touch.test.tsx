import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TouchKeys } from "@/lib/remote-touch";
import { RemoteTouchControls } from "@/components/remote-touch-controls";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("touch key lifecycle", () => {
  it("presses modifiers first, releases in reverse order and cancels a previous tap", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const keys = new TouchKeys(emit);
    keys.tap(["ShiftLeft", "KeyY"]);
    keys.start(["ArrowUp"]);
    expect(emit.mock.calls).toEqual([
      ["ShiftLeft", true],
      ["KeyY", true],
      ["KeyY", false],
      ["ShiftLeft", false],
      ["ArrowUp", true],
    ]);
    act(() => vi.advanceTimersByTime(200));
    expect(emit).toHaveBeenCalledTimes(5);
    keys.release();
    expect(emit).toHaveBeenLastCalledWith("ArrowUp", false);
  });

  it("releases a tap automatically and held keys on unmount", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const view = render(
      <RemoteTouchControls
        enabled
        bindings={{ UI_Up: ["ArrowUp"] }}
        emit={emit}
      >
        Assist content
      </RemoteTouchControls>,
    );
    fireEvent.click(screen.getByRole("button", { name: "↑" }));
    expect(emit).toHaveBeenLastCalledWith("ArrowUp", true);
    act(() => vi.advanceTimersByTime(180));
    expect(emit).toHaveBeenLastCalledWith("ArrowUp", false);
    fireEvent.click(screen.getByRole("button", { name: "↑" }));
    view.unmount();
    expect(emit).toHaveBeenLastCalledWith("ArrowUp", false);
  });

  it("requires control and real bindings, while keeping assists reachable", () => {
    render(
      <RemoteTouchControls
        enabled={false}
        bindings={{ UI_Up: ["ArrowUp"] }}
        emit={vi.fn()}
      >
        <p>Assist start review</p>
      </RemoteTouchControls>,
    );
    expect(screen.getByRole("button", { name: "↑" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Systeme" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Assistenten" }));
    expect(screen.getByText("Assist start review")).toBeVisible();
  });

  it("keeps a held action across identical status polls and releases on lease loss", () => {
    const emit = vi.fn();
    const props = {
      enabled: true,
      bindings: { PitchUpButton: ["KeyS"] },
      emit,
      children: null,
    };
    const view = render(<RemoteTouchControls {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Flugsteuerung" }));
    const button = screen.getByRole("button", { name: "Pitch ↑" });
    button.setPointerCapture = vi.fn();
    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(emit).toHaveBeenLastCalledWith("KeyS", true);
    view.rerender(
      <RemoteTouchControls {...props} bindings={{ PitchUpButton: ["KeyS"] }} />,
    );
    expect(emit).toHaveBeenCalledTimes(1);
    view.rerender(<RemoteTouchControls {...props} enabled={false} />);
    expect(emit).toHaveBeenLastCalledWith("KeyS", false);
  });

  it("releases on touch cancellation, tab changes and app switching", () => {
    const emit = vi.fn();
    render(
      <RemoteTouchControls
        enabled
        bindings={{ PitchUpButton: ["KeyS"] }}
        emit={emit}
      >
        {null}
      </RemoteTouchControls>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Flugsteuerung" }));
    const button = screen.getByRole("button", { name: "Pitch ↑" });
    button.setPointerCapture = vi.fn();
    fireEvent.pointerDown(button, { pointerId: 1 });
    fireEvent.pointerCancel(button, { pointerId: 1 });
    expect(emit).toHaveBeenLastCalledWith("KeyS", false);
    fireEvent.pointerDown(button, { pointerId: 2 });
    fireEvent(window, new Event("blur"));
    expect(emit).toHaveBeenLastCalledWith("KeyS", false);
    fireEvent.pointerDown(button, { pointerId: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Panels" }));
    expect(emit).toHaveBeenLastCalledWith("KeyS", false);
  });

  it("sends the configured chords for panel focus, navigation, selection and both tab directions", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const bindings = {
      FocusLeftPanel: ["Digit1"],
      FocusCommsPanel: ["Digit2"],
      FocusRadarPanel: ["Digit3"],
      FocusRightPanel: ["Digit4"],
      UI_Up: ["ArrowUp"],
      UI_Down: ["ArrowDown"],
      UI_Left: ["ArrowLeft"],
      UI_Right: ["ArrowRight"],
      UI_Select: ["Space"],
      UI_Back: ["Escape"],
      CyclePreviousPanel: ["ShiftLeft", "KeyQ"],
      CycleNextPanel: ["KeyE"],
    };
    render(
      <RemoteTouchControls enabled bindings={bindings} emit={emit}>
        {null}
      </RemoteTouchControls>,
    );
    for (const [label, chord] of [
      ["Navigation", bindings.FocusLeftPanel],
      ["Kommunikation", bindings.FocusCommsPanel],
      ["Rollenpanel", bindings.FocusRadarPanel],
      ["Systeme", bindings.FocusRightPanel],
      ["↑", bindings.UI_Up],
      ["↓", bindings.UI_Down],
      ["←", bindings.UI_Left],
      ["→", bindings.UI_Right],
      ["Auswählen", bindings.UI_Select],
      ["Zurück", bindings.UI_Back],
      ["Tab zurück", bindings.CyclePreviousPanel],
      ["Tab weiter", bindings.CycleNextPanel],
    ] as [string, string[]][]) {
      emit.mockClear();
      fireEvent.click(screen.getByRole("button", { name: label }));
      act(() => vi.advanceTimersByTime(180));
      expect(emit.mock.calls).toEqual([
        ...chord.map((key) => [key, true]),
        ...[...chord].reverse().map((key) => [key, false]),
      ]);
    }
  });

  it("ignores another finger's release and releases a held axis when sliding outside its button", () => {
    const emit = vi.fn();
    render(
      <RemoteTouchControls
        enabled
        bindings={{ PitchUpButton: ["KeyS"] }}
        emit={emit}
      >
        {null}
      </RemoteTouchControls>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Flugsteuerung" }));
    const button = screen.getByRole("button", { name: "Pitch ↑" });
    button.setPointerCapture = vi.fn();
    button.getBoundingClientRect = () => new DOMRect(0, 0, 100, 100);
    const pointerEvent = (name: string, id: number, clientX = 50) =>
      Object.assign(
        new MouseEvent(name, { bubbles: true, clientX, clientY: 50 }),
        { pointerId: id },
      );
    fireEvent(button, pointerEvent("pointerdown", 1));
    fireEvent(button, pointerEvent("pointerup", 2));
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenLastCalledWith("KeyS", true);
    fireEvent(button, pointerEvent("pointermove", 1, 101));
    expect(emit).toHaveBeenLastCalledWith("KeyS", false);
  });
});
