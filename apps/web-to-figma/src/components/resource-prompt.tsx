type ResourcePromptProps = {
  open: boolean;
  refs: Array<string>;
  onConfirm: () => void;
  onSkip: () => void;
};

export function ResourcePrompt({
  open,
  refs,
  onConfirm,
  onSkip,
}: ResourcePromptProps) {
  if (!open) {
    return null;
  }

  const preview = refs.slice(0, 8);

  return (
    <div
      aria-labelledby="resource-prompt-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--line)] bg-white p-5 shadow-[0_16px_48px_rgb(0_0_0/0.16)]">
        <h2
          className="m-0 font-semibold text-[15px] text-[var(--ink)] tracking-[-0.01em]"
          id="resource-prompt-title"
        >
          检测到本地资源引用
        </h2>
        <p className="m-0 mt-2 text-[13px] text-[var(--muted)] leading-relaxed">
          HTML 中引用了{" "}
          <strong className="font-medium text-[var(--ink)]">
            {refs.length}
          </strong>{" "}
          个相对路径资源（CSS / 图片等）。请选择 HTML
          同目录下的资源文件夹以正确预览。
        </p>
        {preview.length > 0 ? (
          <ul className="mt-3 max-h-32 list-none space-y-1 overflow-auto rounded-lg bg-[var(--bg-subtle)] p-2.5 font-mono text-[11px] text-[var(--muted)]">
            {preview.map((r) => (
              <li className="truncate" key={r}>
                {r}
              </li>
            ))}
            {refs.length > preview.length ? (
              <li className="text-[var(--muted-2)]">
                …另有 {refs.length - preview.length} 项
              </li>
            ) : null}
          </ul>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-9 rounded-[var(--radius)] border border-transparent px-3.5 font-medium text-[12.5px] text-[var(--muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--ink)]"
            onClick={onSkip}
            type="button"
          >
            稍后
          </button>
          <button
            className="h-9 rounded-[var(--radius)] bg-[var(--primary)] px-3.5 font-medium text-[12.5px] text-[var(--primary-ink)] shadow-[var(--shadow-btn)] transition-colors hover:bg-[var(--primary-hover)]"
            onClick={onConfirm}
            type="button"
          >
            选择资源文件夹
          </button>
        </div>
      </div>
    </div>
  );
}
