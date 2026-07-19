import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import {
  type DeviceKind,
  type ViewportPreset,
  widthsFor,
} from "../lib/viewport";

type ToolbarProps = {
  htmlName: string | null;
  folderLabel: string | null;
  assetCount: number;
  rewrittenCount: number;
  missing: Array<string>;
  localRefCount: number;
  building: boolean;
  canClear: boolean;
  canCopy: boolean;
  copying: boolean;
  viewport: ViewportPreset;
  onDeviceKindChange: (kind: DeviceKind) => void;
  onViewportWidthChange: (width: number) => void;
  onChangeHtml: () => void;
  onAddAssets: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function Toolbar({
  htmlName,
  folderLabel,
  assetCount,
  rewrittenCount,
  missing,
  localRefCount,
  building,
  canClear,
  canCopy,
  copying,
  viewport,
  onDeviceKindChange,
  onViewportWidthChange,
  onChangeHtml,
  onAddAssets,
  onClear,
  onCopy,
}: ToolbarProps) {
  const [open, setOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!(open || sizeOpen)) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && wrapRef.current && !wrapRef.current.contains(t)) {
        setOpen(false);
      }
      if (sizeOpen && sizeRef.current && !sizeRef.current.contains(t)) {
        setSizeOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSizeOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, sizeOpen]);

  useEffect(() => {
    if (!htmlName && open) {
      setOpen(false);
    }
  }, [htmlName, open]);

  useEffect(() => {
    if (copying) {
      setOpen(false);
      setSizeOpen(false);
    }
  }, [copying]);

  const summary = !htmlName
    ? "未导入"
    : building
      ? "正在构建预览…"
      : folderLabel
        ? `${htmlName} · ${folderLabel} · 已关联 ${rewrittenCount}`
        : localRefCount > 0
          ? `${htmlName} · 待添加资源（${localRefCount}）`
          : `${htmlName} · 无本地资源引用`;

  return (
    <header className="z-10 grid min-h-[52px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-[var(--line)] border-b bg-[var(--bg)] px-3.5 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="mr-0.5 flex shrink-0 select-none items-center gap-2.5 border-[var(--line)] border-r pr-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#111] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_1px_2px_rgb(0_0_0/0.18)]"
          >
            <BrandMark />
          </span>
          <span className="hidden font-semibold text-[16px] tracking-[-0.01em] sm:inline">
            WebToFigma
          </span>
        </div>

        <div className="relative min-w-0 flex-1" ref={wrapRef}>
          <button
            aria-expanded={Boolean(htmlName) && !copying && open}
            aria-haspopup={htmlName ? "dialog" : undefined}
            className={[
              "inline-flex h-[34px] max-w-full items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-white px-3 text-left text-[14px] shadow-[var(--shadow-chip)] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-ring)]",
              htmlName && !copying
                ? "cursor-pointer hover:bg-[var(--bg-subtle)]"
                : "cursor-default opacity-70",
            ].join(" ")}
            disabled={!htmlName || copying}
            onClick={() => {
              if (!htmlName) {
                return;
              }
              setOpen((v) => !v);
            }}
            type="button"
          >
            <span className="min-w-0 truncate text-[var(--muted)]">
              {htmlName ? (
                <>
                  <strong className="font-medium text-[var(--ink)]">
                    {htmlName}
                  </strong>
                  {folderLabel ? (
                    <span>
                      {" "}
                      · {folderLabel}
                      {rewrittenCount > 0 ? ` · 已关联 ${rewrittenCount}` : ""}
                    </span>
                  ) : localRefCount > 0 ? (
                    <span> · 待添加资源（{localRefCount}）</span>
                  ) : building ? (
                    <span> · 构建中…</span>
                  ) : (
                    <span> · 已加载</span>
                  )}
                </>
              ) : (
                summary
              )}
            </span>
            {missing.length > 0 ? (
              <span className="shrink-0 rounded-full border border-[var(--warn-line)] bg-[var(--warn-bg)] px-2 py-0.5 font-medium text-[13px] text-[var(--warn-ink)]">
                缺失 {missing.length}
              </span>
            ) : null}
            {htmlName ? <Chevron open={open} /> : null}
          </button>

          {htmlName && open && !copying ? (
            <div className="absolute top-[calc(100%+6px)] left-0 z-20 w-[min(360px,calc(100vw-24px))] rounded-xl border border-[var(--line)] bg-white p-3 shadow-[0_12px_40px_rgb(0_0_0/0.12)]">
              <Section title="文档">
                <Row label="HTML" value={htmlName ?? "—"} />
                <Row
                  label="资源目录"
                  value={
                    folderLabel
                      ? `${folderLabel}（索引 ${assetCount} 个文件）`
                      : "未选择"
                  }
                />
                <Row
                  label="本地引用"
                  value={
                    localRefCount > 0 ? `${localRefCount} 项` : "无相对路径资源"
                  }
                />
                <Row
                  label="已关联"
                  value={folderLabel ? `${rewrittenCount}` : "—"}
                />
              </Section>

              {missing.length > 0 ? (
                <Section title={`缺失（${missing.length}）`}>
                  <ul className="m-0 max-h-28 list-none space-y-1 overflow-auto p-0 font-mono text-[13px] text-[var(--muted)]">
                    {missing.slice(0, 20).map((m) => (
                      <li
                        className="truncate rounded bg-[var(--bg-subtle)] px-1.5 py-1"
                        key={m}
                      >
                        {m}
                      </li>
                    ))}
                    {missing.length > 20 ? (
                      <li className="text-[var(--muted-2)]">
                        …另有 {missing.length - 20} 项
                      </li>
                    ) : null}
                  </ul>
                </Section>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 border-[var(--line)] border-t pt-3">
                <MiniBtn
                  disabled={copying}
                  onClick={() => {
                    setOpen(false);
                    onChangeHtml();
                  }}
                >
                  更换 HTML
                </MiniBtn>
                <MiniBtn
                  disabled={copying}
                  onClick={() => {
                    setOpen(false);
                    onAddAssets();
                  }}
                >
                  {folderLabel ? "更换资源文件夹" : "添加资源文件夹"}
                </MiniBtn>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex justify-center">
        <ViewportPicker
          disabled={copying}
          onDeviceKindChange={onDeviceKindChange}
          onOpenChange={setSizeOpen}
          onViewportWidthChange={onViewportWidthChange}
          open={sizeOpen}
          sizeRef={sizeRef}
          viewport={viewport}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <button
          className="inline-flex h-[34px] items-center justify-center rounded-[var(--radius)] border border-transparent bg-transparent px-3 font-medium text-[14px] text-[var(--muted)] transition-colors hover:enabled:bg-[var(--bg-hover)] hover:enabled:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canClear || copying}
          onClick={onClear}
          type="button"
        >
          清空
        </button>
        <button
          className="inline-flex h-[34px] items-center justify-center rounded-[var(--radius)] border border-transparent bg-[var(--primary)] px-3.5 font-medium text-[14px] text-[var(--primary-ink)] shadow-[var(--shadow-btn)] transition-[background,box-shadow,transform] active:enabled:translate-y-px hover:enabled:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[#bdbdbd] disabled:shadow-none"
          disabled={!canCopy || copying}
          onClick={onCopy}
          type="button"
        >
          {copying ? "复制中…" : "复制到 Figma"}
        </button>
      </div>
    </header>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1.5 font-medium text-[13px] text-[var(--muted-2)] uppercase tracking-[0.04em]">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[14px]">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-[var(--ink)]">
        {value}
      </span>
    </div>
  );
}

function MiniBtn({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="h-8 rounded-md border border-[var(--line)] bg-white px-2.5 font-medium text-[14px] text-[var(--ink)] transition-colors hover:enabled:bg-[var(--bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ViewportPicker({
  disabled,
  viewport,
  open,
  onOpenChange,
  onDeviceKindChange,
  onViewportWidthChange,
  sizeRef,
}: {
  disabled: boolean;
  viewport: ViewportPreset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeviceKindChange: (kind: DeviceKind) => void;
  onViewportWidthChange: (width: number) => void;
  sizeRef: RefObject<HTMLDivElement | null>;
}) {
  const widths = widthsFor(viewport.kind);
  const kindLabel = viewport.kind === "mobile" ? "手机" : "PC";

  return (
    <div className="relative flex items-center gap-1.5" ref={sizeRef}>
      <fieldset
        aria-label="设备类型"
        className="m-0 inline-flex h-[34px] items-center rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-subtle)] p-0.5"
        disabled={disabled}
      >
        <DeviceKindButton
          active={viewport.kind === "mobile"}
          kind="mobile"
          label="手机"
          onClick={() => onDeviceKindChange("mobile")}
        />
        <DeviceKindButton
          active={viewport.kind === "pc"}
          kind="pc"
          label="PC"
          onClick={() => onDeviceKindChange("pc")}
        />
      </fieldset>

      <div className="relative">
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`画板宽度 ${viewport.width}`}
          className="inline-flex h-[34px] items-center gap-1.5 rounded-[var(--radius)] border border-[var(--line)] bg-white px-2.5 font-medium text-[14px] text-[var(--ink)] shadow-[var(--shadow-chip)] transition-colors hover:enabled:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-ring)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          onClick={() => onOpenChange(!open)}
          type="button"
        >
          <DeviceIcon kind={viewport.kind} />
          <span>{viewport.width}</span>
          <Chevron open={open} />
        </button>

        {open && !disabled ? (
          <div
            aria-label={`${kindLabel}宽度`}
            className="absolute top-[calc(100%+6px)] right-0 z-20 min-w-[148px] rounded-xl border border-[var(--line)] bg-white p-1.5 shadow-[0_12px_40px_rgb(0_0_0/0.12)]"
            role="listbox"
          >
            {widths.map((w) => {
              const active = w === viewport.width;
              return (
                <button
                  aria-selected={active}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors",
                    active
                      ? "bg-[var(--bg-active)] font-medium text-[var(--ink)]"
                      : "text-[var(--muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]",
                  ].join(" ")}
                  key={w}
                  onClick={() => {
                    onViewportWidthChange(w);
                    onOpenChange(false);
                  }}
                  role="option"
                  type="button"
                >
                  <DeviceIcon kind={viewport.kind} />
                  <span className="tabular-nums">{w}</span>
                  <span className="text-[var(--muted-2)]">px</span>
                  {active ? (
                    <span className="ml-auto text-[var(--ink)]">✓</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DeviceKindButton({
  kind,
  active,
  label,
  onClick,
}: {
  kind: DeviceKind;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={[
        "inline-flex h-full w-9 items-center justify-center rounded-[6px] transition-colors",
        active
          ? "bg-white text-[var(--ink)] shadow-[var(--shadow-chip)]"
          : "text-[var(--muted)] hover:text-[var(--ink)]",
      ].join(" ")}
      onClick={onClick}
      title={label}
      type="button"
    >
      <DeviceIcon kind={kind} />
    </button>
  );
}

function BrandMark() {
  return (
    <svg
      aria-hidden
      className="block"
      fill="currentColor"
      height="22"
      viewBox="0 0 1024 1024"
      width="22"
    >
      <path d="M448 832H384v-64h64v64zM576 768H512v64h64v-64zM704 768h-64v64h64v-64zM832 768h-64v64h64v-64zM960 640v318.848H256V959.104H64V65.088L320 64v577.024L960 640zM896 704l-576-0.128v193.024H896V704zM386.88 236.224c1.6 3.776 3.904 10.368 6.784 13.248 0.128 0.256 0.192 0.384 0.32 0.512l126.4 123.904c6.4 6.4 14.72 9.6 23.104 9.6 8.512 0 16.896 2.624 23.232-3.776 12.864-12.864 12.864-33.6 0-46.528L490.304 253.888H512h256v195.2v18.432l-78.528-74.688c-12.864-12.864-33.6-12.864-46.528 0-12.8 12.736-18.688 33.664-5.824 46.4l137.344 126.4c0.512 0.64 1.344 0.896 1.984 1.344 2.624 2.24 5.376 4.352 8.64 5.76 3.648 1.344 5.632 1.984 9.344 2.24 0.512 0 0.896 0.256 1.344 0.256 0.768 0 1.344-0.384 2.112-0.384 3.52-0.256 0.64-0.768 4.096-2.112 3.776-1.6 10.368-3.968 13.248-6.848 0.256-0.128 0.384-0.128 0.512-0.256l123.904-126.4c6.4-6.4 9.6-14.72 9.6-23.104 0-8.512 2.624-16.896-3.776-23.232-12.864-12.864-33.6-12.864-46.528 0l-69.248 66.752C830.528 456 832 452.8 832 449.088v-195.2c0-35.392-28.608-60.8-64-60.8H512c-4.864 0-9.216 1.536-13.76 2.496l68.48-72c12.864-12.864 12.864-33.6 0-46.528C553.984 64.192 533.12 58.368 520.384 71.232L393.984 208.576c-0.64 0.512-0.896 1.344-1.344 1.984-2.24 2.688-4.416 5.44-5.76 8.64-1.408 3.648-2.048 5.632-2.24 9.408 0 0.512-0.256 0.896-0.256 1.344 0 0.768 0.384 1.344 0.384 2.112 0.256 3.52 0.704 0.64 2.112 4.16z" />
    </svg>
  );
}

function DeviceIcon({ kind }: { kind: DeviceKind }) {
  if (kind === "mobile") {
    return (
      <svg aria-hidden fill="none" height="16" viewBox="0 0 16 16" width="16">
        <rect
          height="12"
          rx="1.6"
          stroke="currentColor"
          strokeWidth="1.3"
          width="8"
          x="4"
          y="2"
        />
        <path
          d="M7 12.2h2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.3"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden fill="none" height="16" viewBox="0 0 16 16" width="16">
      <rect
        height="9"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.3"
        width="12"
        x="2"
        y="2.5"
      />
      <path
        d="M5.5 13.5h5M8 11.5v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={[
        "shrink-0 text-[var(--muted-2)] transition-transform",
        open ? "rotate-180" : "",
      ].join(" ")}
      height="12"
      viewBox="0 0 12 12"
      width="12"
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}
