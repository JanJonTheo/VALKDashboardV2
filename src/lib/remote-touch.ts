export const TOUCH_GROUPS = {
  Panels: [
    ["FocusLeftPanel", "Navigation"],
    ["FocusCommsPanel", "Kommunikation"],
    ["FocusRadarPanel", "Rollenpanel"],
    ["FocusRightPanel", "Systeme"],
    ["UI_Up", "↑"],
    ["UI_Down", "↓"],
    ["UI_Left", "←"],
    ["UI_Right", "→"],
    ["UI_Select", "Auswählen"],
    ["UI_Back", "Zurück"],
    ["CyclePreviousPanel", "Tab zurück"],
    ["CycleNextPanel", "Tab weiter"],
  ],
  Flugsteuerung: [
    ["PitchUpButton", "Pitch ↑"],
    ["PitchDownButton", "Pitch ↓"],
    ["YawLeftButton", "Yaw ←"],
    ["YawRightButton", "Yaw →"],
    ["RollLeftButton", "Roll ←"],
    ["RollRightButton", "Roll →"],
    ["SetSpeedZero", "Schub 0 %"],
    ["SetSpeed50", "Schub 50 %"],
    ["SetSpeed100", "Schub 100 %"],
    ["SelectTarget", "Ziel auswählen"],
    ["TargetNextRouteSystem", "Nächstes Routenziel"],
    ["HyperSuperCombination", "FSD"],
    ["Supercruise", "Supercruise"],
    ["LandingGearToggle", "Fahrwerk"],
    ["GalaxyMapOpen", "Galaxiekarte"],
    ["SystemMapOpen", "Systemkarte"],
  ],
} as const;

export type TouchBindings = Record<string, string[]>;

/** One action at a time avoids mixing modifiers from different game bindings. */
export class TouchKeys {
  private held: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private emit: (code: string, down: boolean) => void) {}

  start(codes: string[]) {
    this.release();
    this.held = [...codes];
    for (const code of this.held) this.emit(code, true);
  }

  tap(codes: string[]) {
    this.start(codes);
    this.timer = setTimeout(() => this.release(), 180);
  }

  release() {
    clearTimeout(this.timer);
    for (const code of [...this.held].reverse()) this.emit(code, false);
    this.held = [];
  }
}
