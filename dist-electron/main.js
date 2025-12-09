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
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
