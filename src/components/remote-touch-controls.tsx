"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  TOUCH_GROUPS,
  TouchKeys,
  type TouchBindings,
} from "@/lib/remote-touch";

const heldActions = new Set([
  "PitchUpButton",
  "PitchDownButton",
  "YawLeftButton",
  "YawRightButton",
  "RollLeftButton",
  "RollRightButton",
]);

export function RemoteTouchControls({
  enabled,
  bindings,
  emit,
  children,
}: {
  enabled: boolean;
  bindings?: TouchBindings;
  emit: (code: string, down: boolean) => void;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState("Panels");
  const keys = useMemo(() => new TouchKeys(emit), [emit]);
  const pointer = useRef<number | null>(null);
  const bindingSignature = JSON.stringify(bindings);
  const cancel = () => {
    keys.release();
    pointer.current = null;
  };
  useEffect(() => {
    keys.release();
    pointer.current = null;
    return () => {
      keys.release();
      pointer.current = null;
    };
  }, [enabled, keys, bindingSignature]);
  useEffect(() => {
    const release = () => {
      keys.release();
      pointer.current = null;
    };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
      keys.release();
    };
  }, [keys]);

  return (
    <div className="remote-touch">
      <nav aria-label="Steuerungsbereiche" className="remote-tabs">
        {[...Object.keys(TOUCH_GROUPS), "Assistenten"].map((name) => (
          <button
            type="button"
            key={name}
            aria-pressed={tab === name}
            onClick={() => {
              cancel();
              setTab(name);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "Assistenten" ? (
        children
      ) : (
        <>
          <p className="remote-hint">
            {enabled
              ? "Touch-Steuerung aktiv"
              : "Zuerst manuelle Steuerung übernehmen."}{" "}
            · Flugachsen gedrückt halten, andere Tasten antippen.
          </p>
          {!bindings && (
            <p role="status" className="remote-hint">
              Warte auf Elite-Tastenbelegungen. Falls das Gerät verbunden ist,
              ANKe und die Remote-API aktualisieren.
            </p>
          )}
          <div className="remote-key-grid" aria-label={tab}>
            {TOUCH_GROUPS[tab as keyof typeof TOUCH_GROUPS].map(
              ([action, label]) => {
                const codes = bindings?.[action];
                const available = !!codes?.length;
                const hold = heldActions.has(action);
                return (
                  <button
                    type="button"
                    key={action}
                    disabled={!enabled || !available}
                    aria-label={label}
                    title={
                      available
                        ? action
                        : `${label}: keine unterstützte Tastaturbelegung`
                    }
                    className="remote-key"
                    onContextMenu={(e) => e.preventDefault()}
                    onPointerDown={(e) => {
                      if (!hold || pointer.current !== null || !codes) return;
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      pointer.current = e.pointerId;
                      keys.start(codes);
                    }}
                    onPointerUp={(e) => {
                      if (pointer.current === e.pointerId) cancel();
                    }}
                    onPointerMove={(e) => {
                      if (pointer.current !== e.pointerId) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      if (
                        e.clientX < rect.left ||
                        e.clientX > rect.right ||
                        e.clientY < rect.top ||
                        e.clientY > rect.bottom
                      )
                        cancel();
                    }}
                    onPointerCancel={(e) => {
                      if (pointer.current === e.pointerId) cancel();
                    }}
                    onLostPointerCapture={(e) => {
                      if (pointer.current === e.pointerId) cancel();
                    }}
                    onClick={(e) => {
                      if (codes && (!hold || e.detail === 0)) {
                        cancel();
                        keys.tap(codes);
                      }
                    }}
                  >
                    <span>{label}</span>
                    {!available && <small>Nicht belegt</small>}
                  </button>
                );
              },
            )}
          </div>
          <p className="remote-hint">
            Es wird jeweils eine Touch-Aktion ausgeführt. Fehlende Belegungen in
            Elite konfigurieren und ANKe neu starten.
          </p>
        </>
      )}
    </div>
  );
}
