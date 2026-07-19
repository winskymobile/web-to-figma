import type { ConvertResult } from "@figit/dom-to-figma";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PreviewStage } from "./components/preview-stage";
import { ResourcePrompt } from "./components/resource-prompt";
import { Toolbar } from "./components/toolbar";
import { type AssetIndex, countUniqueAssets } from "./lib/asset-map";
import { createBuildGenerationCoordinator } from "./lib/build-generation";
import { formatConversionWarning } from "./lib/conversion-warning";
import { setPreviewDocument, withPreviewConverter } from "./lib/converter";
import { pickAssetFolder } from "./lib/pick-folder";
import { preparePreviewFontsForConvert } from "./lib/prepare-preview-fonts";
import { rewriteHtmlDocument } from "./lib/rewrite-html";
import { scanLocalAssetRefs } from "./lib/scan-refs";
import {
  type DeviceKind,
  loadViewportPreset,
  presetForKind,
  saveViewportPreset,
  type ViewportPreset,
  withWidth,
} from "./lib/viewport";

type Session = {
  htmlName: string;
  folderName: string | null;
  previewHtml: string;
  missing: Array<string>;
  rewrittenCount: number;
  objectUrls: Array<string>;
  assetCount: number;
  localRefs: Array<string>;
};

function revokeAll(urls: Array<string>) {
  for (const u of urls) {
    URL.revokeObjectURL(u);
  }
}

function isHtmlFile(file: File) {
  const n = file.name.toLowerCase();
  return n.endsWith(".html") || n.endsWith(".htm");
}

async function writeConversionToClipboard(result: ConvertResult) {
  try {
    await navigator.clipboard.write([result.toClipboardItem()]);
  } catch {
    const html = result.toClipboardHtml();
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  }
}

export function App() {
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [assetIndex, setAssetIndex] = useState<AssetIndex | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [building, setBuilding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingRefs, setPendingRefs] = useState<Array<string>>([]);
  const [viewport, setViewport] = useState<ViewportPreset>(() =>
    loadViewportPreset()
  );
  const [buildCoordinator] = useState(createBuildGenerationCoordinator);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objectUrlsRef = useRef<Array<string>>([]);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const copyingRef = useRef(false);
  const mountedRef = useRef(true);
  const previewReadyRef = useRef(false);
  /** Skip resource prompt once after user dismisses for this HTML. */
  const skippedPromptForHtml = useRef<string | null>(null);

  const setPreviewReadiness = useCallback((ready: boolean) => {
    previewReadyRef.current = ready;
    setPreviewReady(ready);
  }, []);

  const requestHtmlPick = useCallback(() => {
    if (copyingRef.current) {
      return;
    }
    htmlInputRef.current?.click();
  }, []);

  const clearSession = useCallback(() => {
    if (copyingRef.current) {
      return;
    }
    buildCoordinator.invalidate();
    setBuilding(false);
    revokeAll(objectUrlsRef.current);
    objectUrlsRef.current = [];
    setHtmlFile(null);
    setAssetIndex(null);
    setFolderName(null);
    setSession(null);
    setPromptOpen(false);
    setPendingRefs([]);
    setPreviewReadiness(false);
    skippedPromptForHtml.current = null;
    setPreviewDocument(null);
  }, [buildCoordinator, setPreviewReadiness]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      buildCoordinator.invalidate();
      revokeAll(objectUrlsRef.current);
    };
  }, [buildCoordinator]);

  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) {
      return;
    }
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
  }, []);

  const rebuildPreview = useCallback(
    async (
      file: File,
      index: AssetIndex,
      folder: string | null,
      options?: { offerPrompt?: boolean }
    ) => {
      if (copyingRef.current) {
        return false;
      }
      setBuilding(true);
      const outcome = await buildCoordinator.run({
        build: async () => {
          const raw = await file.text();
          const localRefs = scanLocalAssetRefs(raw);
          const result = await rewriteHtmlDocument(raw, index);
          return { localRefs, result };
        },
        commit: ({ localRefs, result }) => {
          revokeAll(objectUrlsRef.current);
          objectUrlsRef.current = result.objectUrls;
          setPreviewReadiness(false);
          setSession({
            htmlName: file.name,
            folderName: folder,
            previewHtml: result.html,
            missing: result.missing,
            rewrittenCount: result.rewrittenCount,
            objectUrls: result.objectUrls,
            assetCount: countUniqueAssets(index),
            localRefs,
          });

          const shouldOffer =
            options?.offerPrompt !== false &&
            !folder &&
            localRefs.length > 0 &&
            skippedPromptForHtml.current !== file.name;

          if (shouldOffer) {
            setPendingRefs(localRefs);
            setPromptOpen(true);
          } else {
            setPromptOpen(false);
          }
        },
        discard: ({ result }) => revokeAll(result.objectUrls),
      });

      if (mountedRef.current) {
        setBuilding(buildCoordinator.isBuilding());
        if (outcome.status === "failed") {
          toast.error(
            outcome.error instanceof Error
              ? outcome.error.message
              : "构建预览失败"
          );
        }
      }

      return outcome.status === "committed";
    },
    [buildCoordinator, setPreviewReadiness]
  );

  const loadHtmlFile = useCallback(
    async (file: File) => {
      if (copyingRef.current) {
        return;
      }
      if (!isHtmlFile(file)) {
        toast.error("请选择 .html 或 .htm 文件");
        return;
      }
      // New HTML → allow prompt again
      if (htmlFile?.name !== file.name) {
        skippedPromptForHtml.current = null;
      }
      setHtmlFile(file);
      const index = assetIndex ?? new Map();
      await rebuildPreview(file, index, folderName, { offerPrompt: true });
    },
    [assetIndex, folderName, htmlFile?.name, rebuildPreview]
  );

  const applyFolder = useCallback(
    async (index: AssetIndex, root: string) => {
      if (copyingRef.current) {
        return;
      }
      setAssetIndex(index);
      setFolderName(root);
      setPromptOpen(false);
      if (htmlFile) {
        const committed = await rebuildPreview(htmlFile, index, root, {
          offerPrompt: false,
        });
        if (committed) {
          toast.success(
            `已加载资源目录 ${root}（${countUniqueAssets(index)} 个文件）`
          );
        }
      } else {
        toast.success(
          `已索引 ${countUniqueAssets(index)} 个资源（${root}），请再选择 HTML`
        );
      }
    },
    [htmlFile, rebuildPreview]
  );

  const pickFolder = useCallback(async () => {
    if (copyingRef.current) {
      return;
    }
    const picked = await pickAssetFolder(folderInputRef.current);
    if (!picked || copyingRef.current) {
      return; // cancelled
    }
    await applyFolder(picked.index, picked.folderName);
  }, [applyFolder]);

  const onDeviceKindChange = useCallback((kind: DeviceKind) => {
    if (copyingRef.current) {
      return;
    }
    setViewport((prev) => {
      const next = presetForKind(kind, prev);
      saveViewportPreset(next);
      return next;
    });
  }, []);

  const onViewportWidthChange = useCallback((width: number) => {
    if (copyingRef.current) {
      return;
    }
    setViewport((prev) => {
      const next = withWidth(prev.kind, width);
      if (!next) {
        return prev;
      }
      saveViewportPreset(next);
      return next;
    });
  }, []);

  const logicalWidth = viewport.width;

  const onCopy = async () => {
    if (copyingRef.current) {
      return;
    }
    if (buildCoordinator.isBuilding()) {
      toast.message("预览仍在构建，请稍候再复制");
      return;
    }
    if (!previewReadyRef.current) {
      toast.message("预览尚未加载完成，请稍候再复制");
      return;
    }
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    setPreviewDocument(doc ?? null);
    if (!doc?.documentElement) {
      toast.error("预览尚未就绪：请先选择 HTML");
      return;
    }
    const root = doc.body ?? doc.documentElement;
    if (!root) {
      toast.error("预览文档为空，无法转换");
      return;
    }

    copyingRef.current = true;
    setCopying(true);
    const toastId = toast.loading("正在统一字体并转换为 Figma 图层…");
    try {
      await withPreviewConverter(async (converter) => {
        let restoreFonts: (() => void) | undefined;
        try {
          if (!window.isSecureContext) {
            throw new Error(
              "当前页面不是安全上下文，无法写入剪贴板（请用 http://localhost 访问）"
            );
          }
          const prepared = await preparePreviewFontsForConvert(doc);
          restoreFonts = prepared.restore;
          const fontStats = prepared.stats;

          const contentW = Math.max(
            root.scrollWidth,
            doc.documentElement.scrollWidth,
            1
          );
          const contentH = Math.max(
            root.scrollHeight,
            doc.documentElement.scrollHeight,
            200
          );
          if (contentW > logicalWidth + 1) {
            toast.message(
              `内容宽度 ${Math.round(contentW)}px 超出画板 ${logicalWidth}px，已按内容宽度导出`,
              { duration: 4500 }
            );
          }
          const widthAfter = Math.max(contentW, logicalWidth);
          const heightAfter = contentH;
          const result = await converter.convert({
            element: root,
            width: widthAfter,
            height: heightAfter,
            name: session?.htmlName?.replace(/\.html?$/i, "") || "web-to-figma",
          });
          await writeConversionToClipboard(result);
          toast.success("已复制。打开 Figma 按 ⌘V / Ctrl+V 粘贴", {
            id: toastId,
          });
          const conversionWarning = formatConversionWarning(
            fontStats,
            result.diagnostics
          );
          if (conversionWarning) {
            toast.message(conversionWarning, { duration: 6000 });
          } else if (
            fontStats.remappedElements > 0 &&
            fontStats.preservedCustomFamilies === 0
          ) {
            // Soft note only when everything used system stacks
            // (avoid noisy toasts on normal brand-font pages).
          }
        } finally {
          try {
            restoreFonts?.();
          } catch {
            // ignore
          }
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "复制失败";
      toast.error(`复制失败：${message}`, { id: toastId, duration: 8000 });
      console.error("[web-to-figma] copy failed", err);
    } finally {
      copyingRef.current = false;
      setCopying(false);
    }
  };

  return (
    <div className="flex h-full min-h-dvh flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Toolbar
        assetCount={
          assetIndex
            ? countUniqueAssets(assetIndex)
            : (session?.assetCount ?? 0)
        }
        building={building}
        canClear={Boolean(session || htmlFile)}
        canCopy={Boolean(session) && !building && previewReady}
        copying={copying}
        folderLabel={folderName}
        htmlName={htmlFile?.name ?? session?.htmlName ?? null}
        localRefCount={session?.localRefs.length ?? pendingRefs.length}
        missing={session?.missing ?? []}
        onAddAssets={() => void pickFolder()}
        onChangeHtml={requestHtmlPick}
        onClear={clearSession}
        onCopy={() => void onCopy()}
        onDeviceKindChange={onDeviceKindChange}
        onViewportWidthChange={onViewportWidthChange}
        rewrittenCount={session?.rewrittenCount ?? 0}
        viewport={viewport}
      />

      <input
        accept=".html,.htm,text/html"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void loadHtmlFile(file);
          }
          e.target.value = "";
        }}
        ref={htmlInputRef}
        type="file"
      />
      <input
        aria-hidden
        className="sr-only"
        multiple
        ref={folderInputRef}
        tabIndex={-1}
        type="file"
      />

      <PreviewStage
        html={session?.previewHtml ?? null}
        interactionDisabled={copying}
        logicalWidth={logicalWidth}
        onDropHtmlFile={(file) => void loadHtmlFile(file)}
        onReadyChange={setPreviewReadiness}
        onRequestHtmlPick={requestHtmlPick}
        ref={iframeRef}
        title={session?.htmlName ?? "preview"}
      />

      <ResourcePrompt
        disabled={copying}
        onConfirm={() => {
          if (copyingRef.current) {
            return;
          }
          setPromptOpen(false);
          void pickFolder();
        }}
        onSkip={() => {
          if (htmlFile) {
            skippedPromptForHtml.current = htmlFile.name;
          }
          setPromptOpen(false);
        }}
        open={promptOpen}
        refs={pendingRefs}
      />
    </div>
  );
}
