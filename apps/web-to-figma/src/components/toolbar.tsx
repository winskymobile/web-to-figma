import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
  onChangeHtml,
  onAddAssets,
  onClear,
  onCopy,
}: ToolbarProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
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
    <header className="z-10 flex min-h-[52px] flex-wrap items-center gap-2.5 border-[var(--line)] border-b bg-[var(--bg)] px-3.5 py-2">
      <div className="mr-0.5 flex shrink-0 select-none items-center gap-2 border-[var(--line)] border-r pr-3">
        <span
          aria-hidden
          className="h-6 w-6 rounded-[7px] shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.18)]"
          style={{
            background: "linear-gradient(145deg, #3a3a3a 0%, #111 70%)",
          }}
        />
        <span className="hidden font-semibold text-[13px] tracking-[-0.015em] sm:inline">
          web-to-figma
        </span>
      </div>

      <div className="relative min-w-0 flex-1" ref={wrapRef}>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="inline-flex h-[34px] max-w-full items-center gap-2 rounded-[var(--radius)] border border-[var(--line)] bg-white px-3 text-left text-[12.5px] shadow-[var(--shadow-chip)] transition-colors hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--primary-ring)]"
          onClick={() => setOpen((v) => !v)}
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
            <span className="shrink-0 rounded-full border border-[var(--warn-line)] bg-[var(--warn-bg)] px-2 py-0.5 font-medium text-[11px] text-[var(--warn-ink)]">
              缺失 {missing.length}
            </span>
          ) : null}
          <Chevron open={open} />
        </button>

        {open ? (
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
                <ul className="m-0 max-h-28 list-none space-y-1 overflow-auto p-0 font-mono text-[11px] text-[var(--muted)]">
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
                onClick={() => {
                  setOpen(false);
                  onChangeHtml();
                }}
              >
                更换 HTML
              </MiniBtn>
              <MiniBtn
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

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          className="inline-flex h-[34px] items-center justify-center rounded-[var(--radius)] border border-transparent bg-transparent px-3 font-medium text-[12.5px] text-[var(--muted)] transition-colors hover:enabled:bg-[var(--bg-hover)] hover:enabled:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canClear}
          onClick={onClear}
          type="button"
        >
          清空
        </button>
        <button
          className="inline-flex h-[34px] items-center justify-center rounded-[var(--radius)] border border-transparent bg-[var(--primary)] px-3.5 font-medium text-[12.5px] text-[var(--primary-ink)] shadow-[var(--shadow-btn)] transition-[background,box-shadow,transform] active:enabled:translate-y-px hover:enabled:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:bg-[#bdbdbd] disabled:shadow-none"
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
      <div className="mb-1.5 font-medium text-[11px] text-[var(--muted-2)] uppercase tracking-[0.04em]">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[12.5px]">
      <span className="shrink-0 text-[var(--muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-[var(--ink)]">
        {value}
      </span>
    </div>
  );
}

function MiniBtn({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="h-8 rounded-md border border-[var(--line)] bg-white px-2.5 font-medium text-[var(--ink)] text-xs transition-colors hover:bg-[var(--bg-subtle)]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
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
