import type { DragEvent } from "react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type PreviewStageProps = {
  html: string | null;
  title: string;
  onReadyChange?: (ready: boolean) => void;
  onRequestHtmlPick: () => void;
  onDropHtmlFile: (file: File) => void;
};

export const PreviewStage = forwardRef<HTMLIFrameElement, PreviewStageProps>(
  function PreviewStage(
    { html, title, onReadyChange, onRequestHtmlPick, onDropHtmlFile },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [src, setSrc] = useState<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);

    useEffect(() => {
      onReadyChange?.(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (!html) {
        setSrc(null);
        return;
      }
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setSrc(url);
    }, [html, onReadyChange]);

    useEffect(
      () => () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      },
      []
    );

    const onDrag = (e: DragEvent, over: boolean) => {
      e.preventDefault();
      if (html) {
        return;
      }
      setDragOver(over);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (html) {
        return;
      }
      const file = e.dataTransfer.files?.[0];
      if (file) {
        onDropHtmlFile(file);
      }
    };

    return (
      <main
        aria-label="预览"
        className={[
          "relative min-h-0 flex-1 overflow-hidden",
          dragOver
            ? "outline outline-2 outline-black outline-offset-[-10px]"
            : "",
        ].join(" ")}
        onDragEnter={(e) => onDrag(e, true)}
        onDragLeave={(e) => onDrag(e, false)}
        onDragOver={(e) => onDrag(e, true)}
        onDrop={onDrop}
        style={{
          backgroundImage: `
            linear-gradient(var(--canvas-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px, 24px 24px",
          backgroundColor: "var(--canvas)",
        }}
      >
        {src ? (
          <iframe
            className="absolute inset-0 h-full w-full border-0 bg-white"
            onLoad={() => {
              requestAnimationFrame(() => {
                if (iframeRef.current?.contentDocument?.documentElement) {
                  onReadyChange?.(true);
                }
              });
            }}
            ref={iframeRef}
            sandbox="allow-same-origin allow-scripts"
            src={src}
            title={title}
          />
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
            <button
              aria-label="选择 HTML 文件"
              className="pointer-events-auto grid h-64 w-64 cursor-pointer content-center justify-items-center gap-3 rounded-[28px] border border-[var(--line-strong)] border-dashed bg-white px-5 text-center font-[inherit] text-[var(--muted)] transition-[border-color,color] duration-150 hover:border-[var(--ink)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
              onClick={onRequestHtmlPick}
              type="button"
            >
              <svg
                aria-hidden={true}
                fill="none"
                height="48"
                viewBox="0 0 16 16"
                width="48"
              >
                <path
                  d="M4 2.5h5.2L12 5.3V13a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 13V2.5Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M9 2.5V5.5H12"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
              <span className="font-medium text-current text-sm">
                选择 HTML，或拖到预览区
              </span>
            </button>
          </div>
        )}
      </main>
    );
  }
);
