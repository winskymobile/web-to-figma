import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PreviewStage } from "./components/preview-stage";
import { ResourcePrompt } from "./components/resource-prompt";
import { Toolbar } from "./components/toolbar";
import type { AssetIndex } from "./lib/asset-map";
import { getConverter, setPreviewDocument } from "./lib/converter";
import { pickAssetFolder } from "./lib/pick-folder";
import { preparePreviewFontsForConvert } from "./lib/prepare-preview-fonts";
import { rewriteHtmlDocument } from "./lib/rewrite-html";
import { scanLocalAssetRefs } from "./lib/scan-refs";

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

export function App() {
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [assetIndex, setAssetIndex] = useState<AssetIndex | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [building, setBuilding] = useState(false);
  const [copying, setCopying] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [pendingRefs, setPendingRefs] = useState<Array<string>>([]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const objectUrlsRef = useRef<Array<string>>([]);
  const htmlInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  /** Skip resource prompt once after user dismisses for this HTML. */
  const skippedPromptForHtml = useRef<string | null>(null);

  const clearSession = useCallback(() => {
    revokeAll(objectUrlsRef.current);
    objectUrlsRef.current = [];
    setHtmlFile(null);
    setAssetIndex(null);
    setFolderName(null);
    setSession(null);
    setPromptOpen(false);
    setPendingRefs([]);
    skippedPromptForHtml.current = null;
    setPreviewDocument(null);
  }, []);

  useEffect(
    () => () => {
      revokeAll(objectUrlsRef.current);
    },
    []
  );

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
      setBuilding(true);
      try {
        const raw = await file.text();
        const localRefs = scanLocalAssetRefs(raw);
        const result = await rewriteHtmlDocument(raw, index);
        revokeAll(objectUrlsRef.current);
        objectUrlsRef.current = result.objectUrls;
        setSession({
          htmlName: file.name,
          folderName: folder,
          previewHtml: result.html,
          missing: result.missing,
          rewrittenCount: result.rewrittenCount,
          objectUrls: result.objectUrls,
          assetCount: index.size,
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "构建预览失败");
      } finally {
        setBuilding(false);
      }
    },
    []
  );

  const loadHtmlFile = useCallback(
    async (file: File) => {
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
      setAssetIndex(index);
      setFolderName(root);
      setPromptOpen(false);
      if (htmlFile) {
        await rebuildPreview(htmlFile, index, root, { offerPrompt: false });
        toast.success(`已加载资源目录 ${root}（${index.size} 个文件）`);
      } else {
        toast.success(`已索引 ${index.size} 个资源（${root}），请再选择 HTML`);
      }
    },
    [htmlFile, rebuildPreview]
  );

  const pickFolder = useCallback(async () => {
    const picked = await pickAssetFolder(folderInputRef.current);
    if (!picked) {
      return; // cancelled
    }
    await applyFolder(picked.index, picked.folderName);
  }, [applyFolder]);

  const onCopy = async () => {
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

    setCopying(true);
    const toastId = toast.loading("正在统一字体并转换为 Figma 图层…");
    let restoreFonts: (() => void) | undefined;
    try {
      if (!window.isSecureContext) {
        throw new Error(
          "当前页面不是安全上下文，无法写入剪贴板（请用 http://localhost 访问）"
        );
      }
      const prepared = await preparePreviewFontsForConvert(doc);
      restoreFonts = prepared.restore;
      const widthAfter = Math.max(
        root.scrollWidth,
        doc.documentElement.scrollWidth,
        320
      );
      const heightAfter = Math.max(
        root.scrollHeight,
        doc.documentElement.scrollHeight,
        200
      );
      const converter = getConverter();
      const result = await converter.convert({
        element: root,
        width: widthAfter,
        height: heightAfter,
        name: session?.htmlName?.replace(/\.html?$/i, "") || "web-to-figma",
      });
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
      toast.success("已复制。打开 Figma 按 ⌘V / Ctrl+V 粘贴", { id: toastId });
    } catch (err) {
      const message = err instanceof Error ? err.message : "复制失败";
      toast.error(`复制失败：${message}`, { id: toastId, duration: 8000 });
      console.error("[web-to-figma] copy failed", err);
    } finally {
      try {
        restoreFonts?.();
      } catch {
        // ignore
      }
      setCopying(false);
    }
  };

  return (
    <div className="flex h-full min-h-dvh flex-col bg-[var(--bg)] text-[var(--ink)]">
      <Toolbar
        assetCount={assetIndex?.size ?? session?.assetCount ?? 0}
        building={building}
        canClear={Boolean(session || htmlFile)}
        canCopy={Boolean(session) && !building}
        copying={copying}
        folderLabel={folderName}
        htmlName={htmlFile?.name ?? session?.htmlName ?? null}
        localRefCount={session?.localRefs.length ?? pendingRefs.length}
        missing={session?.missing ?? []}
        onAddAssets={() => void pickFolder()}
        onChangeHtml={() => htmlInputRef.current?.click()}
        onClear={clearSession}
        onCopy={() => void onCopy()}
        rewrittenCount={session?.rewrittenCount ?? 0}
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
        onDropHtmlFile={(file) => void loadHtmlFile(file)}
        onRequestHtmlPick={() => htmlInputRef.current?.click()}
        ref={iframeRef}
        title={session?.htmlName ?? "preview"}
      />

      <ResourcePrompt
        onConfirm={() => {
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
