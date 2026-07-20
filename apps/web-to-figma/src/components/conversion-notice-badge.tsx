import { useEffect, useId, useRef, useState } from "react";

import type { ConversionNotice } from "../lib/conversion-warning";

type ConversionNoticeBadgeProps = {
  notice: ConversionNotice;
};

/** Line-stroke alert icon (matches device icons). */
function AlertIcon() {
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 16 16" width="16">
      <circle cx="8" cy="8" r="5.35" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 5.1v3.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="11" fill="currentColor" r="0.85" />
    </svg>
  );
}

/** "处理日志" control immediately after the resource status chip. */
export function ConversionNoticeBadge({ notice }: ConversionNoticeBadgeProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current && !wrapRef.current.contains(t)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`处理日志：${notice.summaryLine}`}
        className="inline-flex h-[34px] items-center gap-1.5 rounded-[var(--radius)] border border-[var(--line)] bg-white px-2.5 font-medium text-[13px] text-[var(--ink)] shadow-[var(--shadow-chip)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-ring)]"
        onBlur={(e) => {
          if (!wrapRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        type="button"
      >
        <AlertIcon />
        <span>处理日志</span>
      </button>
      {open ? (
        <div
          className="absolute top-[calc(100%+6px)] left-0 z-30 w-[min(320px,calc(100vw-24px))] rounded-xl border border-[var(--line)] bg-white p-3 shadow-[0_12px_40px_rgb(0_0_0/0.12)]"
          id={panelId}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          role="tooltip"
        >
          <p className="m-0 font-medium text-[13px] text-[var(--ink)] leading-snug">
            {notice.summaryLine}
          </p>
          {notice.detailLines.length > 0 ? (
            <ul className="m-0 mt-2 max-h-40 list-none space-y-1 overflow-auto p-0 text-[12px] text-[var(--muted)] leading-snug">
              {notice.detailLines.map((line) => (
                <li
                  className="rounded bg-[var(--bg-subtle)] px-2 py-1"
                  key={line}
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="m-0 mt-2 text-[11.5px] text-[var(--muted-2)] leading-snug">
            {notice.footer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
