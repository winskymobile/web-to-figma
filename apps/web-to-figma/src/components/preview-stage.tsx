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
  /** Logical CSS width for reflow (mobile presets / PC presets; defaults 375 / 1440). */
  logicalWidth: number;
  interactionDisabled: boolean;
  onReadyChange?: (ready: boolean) => void;
  onRequestHtmlPick: () => void;
  onDropHtmlFile: (file: File) => void;
};

export const PreviewStage = forwardRef<HTMLIFrameElement, PreviewStageProps>(
  function PreviewStage(
    {
      html,
      title,
      logicalWidth,
      interactionDisabled,
      onReadyChange,
      onRequestHtmlPick,
      onDropHtmlFile,
    },
    ref
  ) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [src, setSrc] = useState<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [frameHeight, setFrameHeight] = useState(640);

    useImperativeHandle(ref, () => iframeRef.current as HTMLIFrameElement);

    const syncFrameHeight = () => {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) {
        return;
      }
      const root = doc.documentElement;
      const body = doc.body;
      const h = Math.max(
        root?.scrollHeight ?? 0,
        body?.scrollHeight ?? 0,
        root?.offsetHeight ?? 0,
        200
      );
      setFrameHeight(Math.min(Math.max(h, 200), 20000));
    };

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

    useEffect(() => {
      if (interactionDisabled) {
        setDragOver(false);
      }
    }, [interactionDisabled]);

    // Reflow height when logical width or document changes.
    useEffect(() => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc?.documentElement) {
        return;
      }
      void doc.documentElement.offsetWidth;
      const id = window.requestAnimationFrame(() => syncFrameHeight());
      return () => window.cancelAnimationFrame(id);
    }, [logicalWidth, src]);

    const onDrag = (e: DragEvent, over: boolean) => {
      e.preventDefault();
      if (html || interactionDisabled) {
        return;
      }
      setDragOver(over);
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (html || interactionDisabled) {
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
          "relative min-h-0 flex-1 overflow-auto",
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
          <div className="flex min-h-full justify-center p-4">
            <div
              className="relative shrink-0 overflow-hidden bg-white shadow-[0_8px_28px_rgb(0_0_0/0.08)] outline outline-1 outline-[var(--line)]"
              style={{ width: logicalWidth, height: frameHeight }}
            >
              <iframe
                className="block h-full w-full border-0 bg-white"
                onLoad={() => {
                  requestAnimationFrame(() => {
                    syncFrameHeight();
                    if (iframeRef.current?.contentDocument?.documentElement) {
                      onReadyChange?.(true);
                    }
                  });
                }}
                ref={iframeRef}
                sandbox="allow-same-origin allow-scripts"
                scrolling="no"
                src={src}
                title={title}
              />
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
            <button
              aria-label="选择 HTML 文件"
              className="group pointer-events-auto grid cursor-pointer content-center justify-items-center gap-3 border-0 bg-transparent px-2 py-2 text-center font-[inherit] text-[var(--muted)] transition-colors duration-150 hover:enabled:text-[var(--ink)] focus-visible:text-[var(--ink)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              disabled={interactionDisabled}
              onClick={onRequestHtmlPick}
              type="button"
            >
              <span
                aria-hidden
                className="inline-flex h-28 w-28 items-center justify-center rounded-[22px] border border-[var(--line-strong)] border-dashed bg-white text-[var(--muted)] transition-colors duration-150 group-hover:border-[var(--ink)] group-hover:text-[var(--ink)] group-focus-visible:border-[var(--ink)] group-focus-visible:text-[var(--ink)]"
              >
                <svg
                  fill="currentColor"
                  height="48"
                  viewBox="0 0 1024 1024"
                  width="48"
                >
                  <path d="M896 288V704h-64V288h-128A96 96 0 0 1 608 192V64H256a64 64 0 0 0-64 64v576H128V128a128 128 0 0 1 128-128h352L896 288z m-623.104 470.4v255.936h-50.624v-109.696H114.56v109.696H64V758.4h50.624v104.064h107.648V758.4h50.56z m144.064 42.368v213.568h-50.816v-213.568H293.632v-42.368h196.096v42.368H416.96z m139.264 213.568v-170.24h2.432l60.928 138.176h33.024l60.544-138.24h2.432v170.304h45.76V758.4h-51.2l-72.96 166.144H635.52L562.56 758.4h-51.52v255.936h45.184z m301.44-43.136h108.544v43.136H807.04V758.4h50.56v212.8z" />
                </svg>
              </span>
              <span className="font-medium text-[16px] text-current">
                点击选择 HTML 文件或拖到此预览区
              </span>
            </button>
          </div>
        )}
      </main>
    );
  }
);
