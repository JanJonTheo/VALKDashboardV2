"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

export function CopyTextButton({
  value,
  label = "Copy to clipboard",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1_600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <button
      type="button"
      className={`copy-text-button${className ? ` ${className}` : ""}`}
      onClick={copy}
      aria-label={copied ? `${value} copied` : `${label}: ${value}`}
      title={copied ? "Copied" : label}
    >
      {copied ? (
        <Check size={13} aria-hidden="true" />
      ) : (
        <Copy size={13} aria-hidden="true" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : label}
      </span>
    </button>
  );
}
