import type { AssetIndex } from "./asset-map";
import { buildAssetIndex } from "./asset-map";

export type PickedFolder = {
  index: AssetIndex;
  folderName: string;
};

type FsFileHandle = {
  kind: "file";
  getFile: () => Promise<File>;
};

type FsDirHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<FsFileHandle | FsDirHandle>;
};

declare global {
  type Window = {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: "read" | "readwrite";
    }) => Promise<FsDirHandle>;
  };
}

async function collectFromHandle(
  dir: FsDirHandle,
  prefix: string,
  out: Array<File>
): Promise<void> {
  for await (const entry of dir.values()) {
    if (entry.kind === "file") {
      const file = await entry.getFile();
      const path = prefix ? `${prefix}/${file.name}` : file.name;
      Object.defineProperty(file, "webkitRelativePath", {
        value: path,
        configurable: true,
      });
      out.push(file);
    } else if (entry.kind === "directory") {
      const next = prefix ? `${prefix}/${entry.name}` : entry.name;
      await collectFromHandle(entry, next, out);
    }
  }
}

function pickViaDirectoryInput(
  folderInput: HTMLInputElement
): Promise<PickedFolder | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: PickedFolder | null) => {
      if (settled) {
        return;
      }
      settled = true;
      folderInput.removeEventListener("change", onChange);
      window.removeEventListener("focus", onFocus);
      resolve(value);
    };

    const onChange = () => {
      const list = folderInput.files;
      folderInput.value = "";
      if (!list || list.length === 0) {
        finish(null);
        return;
      }
      const first = list[0] as File & { webkitRelativePath?: string };
      const root = first.webkitRelativePath?.split(/[/\\]/)[0] ?? "assets";
      finish({
        index: buildAssetIndex(list),
        folderName: root,
      });
    };

    // File dialog cancel does not fire change; detect via window re-focus.
    const onFocus = () => {
      window.setTimeout(() => {
        if (
          !settled &&
          (!folderInput.files || folderInput.files.length === 0)
        ) {
          finish(null);
        }
      }, 300);
    };

    folderInput.addEventListener("change", onChange, { once: true });
    window.addEventListener("focus", onFocus, { once: true });
    folderInput.click();
  });
}

/**
 * Prefer File System Access API (no Chrome "upload N files?" dialog).
 * Falls back to a hidden webkitdirectory input when unavailable.
 */
export async function pickAssetFolder(
  folderInput: HTMLInputElement | null
): Promise<PickedFolder | null> {
  if (typeof window.showDirectoryPicker === "function") {
    try {
      const handle = await window.showDirectoryPicker({
        id: "web-to-figma-assets",
        mode: "read",
      });
      const files: Array<File> = [];
      await collectFromHandle(handle, handle.name, files);
      return {
        index: files.length ? buildAssetIndex(files) : new Map(),
        folderName: handle.name,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return null;
      }
      console.warn(
        "[web-to-figma] showDirectoryPicker failed, falling back",
        err
      );
    }
  }

  if (!folderInput) {
    return null;
  }
  return pickViaDirectoryInput(folderInput);
}
