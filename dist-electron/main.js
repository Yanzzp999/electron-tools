import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
function resolveTargetPath(targetPath) {
  const home = app.getPath("home");
  if (!targetPath) return home;
  const expanded = targetPath === "~" || targetPath.startsWith("~/") || targetPath.startsWith("~\\") ? path.join(home, targetPath.slice(2)) : targetPath;
  return path.resolve(expanded);
}
ipcMain.handle("fs:list", async (_event, targetPath) => {
  const resolvedPath = resolveTargetPath(targetPath);
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        path: resolvedPath,
        entries: [],
        exists: false,
        error: "Target path is not a directory"
      };
    }
    const dirents = await fs.readdir(resolvedPath, { withFileTypes: true });
    const entries = await Promise.all(
      dirents.map(async (dirent) => {
        const entryPath = path.join(resolvedPath, dirent.name);
        const entryStat = await fs.stat(entryPath);
        return {
          name: dirent.name,
          path: entryPath,
          isDirectory: dirent.isDirectory(),
          size: dirent.isDirectory() ? 0 : entryStat.size,
          modified: entryStat.mtimeMs
        };
      })
    );
    entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name, void 0, { sensitivity: "base" });
    });
    return {
      path: resolvedPath,
      entries,
      exists: true
    };
  } catch (error) {
    return {
      path: resolvedPath,
      entries: [],
      exists: false,
      error: error instanceof Error ? error.message : "Unable to read directory"
    };
  }
});
ipcMain.handle("fs:rename-bulk", async (_event, payload) => {
  const rootPath = resolveTargetPath(payload == null ? void 0 : payload.rootPath);
  const findText = (payload == null ? void 0 : payload.findText) ?? "";
  const replaceText = (payload == null ? void 0 : payload.replaceText) ?? "";
  const recursive = Boolean(payload == null ? void 0 : payload.recursive);
  if (!findText.trim()) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: "Find text is required"
    };
  }
  let rootStat;
  try {
    rootStat = await fs.stat(rootPath);
  } catch (error) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : "Root path not accessible"
    };
  }
  if (!rootStat.isDirectory()) {
    return {
      root: rootPath,
      renamed: 0,
      skipped: 0,
      failed: 0,
      details: [],
      error: "Root path must be a directory"
    };
  }
  let renamed = 0;
  let skipped = 0;
  let failed = 0;
  const details = [];
  const queue = [rootPath];
  while (queue.length) {
    const current = queue.shift();
    let dirents;
    try {
      dirents = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      failed += 1;
      details.push({
        from: current,
        error: error instanceof Error ? error.message : "Unable to read directory"
      });
      continue;
    }
    for (const dirent of dirents) {
      const originalPath = path.join(current, dirent.name);
      let nextPath = originalPath;
      const nextName = dirent.name.replace(findText, replaceText);
      const shouldRename = nextName !== dirent.name;
      if (shouldRename) {
        const targetPath = path.join(current, nextName);
        try {
          try {
            await fs.stat(targetPath);
            throw new Error("Target name already exists");
          } catch {
          }
          await fs.rename(originalPath, targetPath);
          renamed += 1;
          nextPath = targetPath;
          details.push({ from: originalPath, to: targetPath });
        } catch (error) {
          failed += 1;
          nextPath = originalPath;
          details.push({
            from: originalPath,
            error: error instanceof Error ? error.message : "Rename failed"
          });
        }
      } else {
        skipped += 1;
      }
      if (recursive && dirent.isDirectory()) {
        queue.push(nextPath);
      }
    }
  }
  return {
    root: rootPath,
    renamed,
    skipped,
    failed,
    details
  };
});
ipcMain.handle("fs:delete-bulk", async (_event, payload) => {
  const rootPath = resolveTargetPath(payload == null ? void 0 : payload.rootPath);
  const keyword = (payload == null ? void 0 : payload.keyword) ?? "";
  const recursive = Boolean(payload == null ? void 0 : payload.recursive);
  const dryRun = Boolean(payload == null ? void 0 : payload.dryRun);
  if (!keyword.trim()) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: "Keyword is required"
    };
  }
  let rootStat;
  try {
    rootStat = await fs.stat(rootPath);
  } catch (error) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: error instanceof Error ? error.message : "Root path not accessible"
    };
  }
  if (!rootStat.isDirectory()) {
    return {
      root: rootPath,
      matched: 0,
      deleted: 0,
      failed: 0,
      details: [],
      error: "Root path must be a directory"
    };
  }
  const queue = [rootPath];
  let matched = 0;
  let deleted = 0;
  let failed = 0;
  const details = [];
  while (queue.length) {
    const current = queue.shift();
    let dirents;
    try {
      dirents = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      failed += 1;
      details.push({
        path: current,
        isDirectory: true,
        error: error instanceof Error ? error.message : "Unable to read directory"
      });
      continue;
    }
    for (const dirent of dirents) {
      const itemPath = path.join(current, dirent.name);
      const isDir = dirent.isDirectory();
      const hasKeyword = dirent.name.includes(keyword);
      if (hasKeyword) {
        matched += 1;
        if (dryRun) {
          details.push({ path: itemPath, isDirectory: isDir, deleted: false });
        } else {
          try {
            if (isDir) {
              await fs.rm(itemPath, { recursive: true, force: true });
            } else {
              await fs.unlink(itemPath);
            }
            deleted += 1;
            details.push({ path: itemPath, isDirectory: isDir, deleted: true });
          } catch (error) {
            failed += 1;
            details.push({
              path: itemPath,
              isDirectory: isDir,
              error: error instanceof Error ? error.message : "Delete failed"
            });
          }
          if (isDir) continue;
        }
      }
      if (recursive && isDir) {
        queue.push(itemPath);
      }
    }
  }
  return {
    root: rootPath,
    matched,
    deleted,
    failed,
    details
  };
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
