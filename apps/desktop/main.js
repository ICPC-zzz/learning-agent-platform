const { app, BrowserWindow } = require("electron");
const path = require("path");

// Minimal Desktop skeleton — no Agent, no Tool, no LLM, no DB, no network.
// Security: nodeIntegration off, contextIsolation on, sandbox on, no preload, no remote.

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "编程学习桌面版",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // No preload script — renderer is fully isolated.
      // No remote module, no shell, no file system access.
    },
  });

  // Load local static placeholder — no network, no CDN, no external resources.
  win.loadFile(path.join(__dirname, "index.html"));

  // Prevent navigation to external URLs.
  win.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
  });

  // Prevent opening new windows.
  win.webContents.setWindowOpenHandler(() => {
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  // macOS: re-create window when dock icon clicked and no windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS).
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
