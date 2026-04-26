// 检查是否在 Electron 环境中，如果不是则创建 mock
if (!window.electronAPI) {
  const mockListeners = new Map<string, Set<(...args: any[]) => void>>();
  
  window.electronAPI = {
    openFile: () => Promise.resolve(null),
    getIsReadOnly: () => Promise.resolve(false),
    saveFile: () => Promise.resolve(null),
    saveFileAs: () => Promise.resolve(null),
    on: (channel, listener) => {
      if (!mockListeners.has(channel)) {
        mockListeners.set(channel, new Set());
      }
      mockListeners.get(channel)!.add(listener);
    },
    removeListener: (channel, listener) => {
      mockListeners.get(channel)?.delete(listener);
    },
    setTitle: () => {},
    changeSaveStatus: () => {},
    windowControl: () => {},
    closeDiscard: () => {},
    onOpenFileAtLaunch: () => {},
    openExternal: (url) => { window.open(url, "_blank"); return Promise.resolve(); },
    openLink: (href) => Promise.resolve(),
    getFilePathInClipboard: () => Promise.resolve(null),
    writeTempImage: () => Promise.resolve(null),
    exportAsPDF: () => Promise.resolve(),
    exportAsWord: () => Promise.resolve(),
    readFileByPath: () => Promise.resolve(null),
    showOverwriteConfirm: () => Promise.resolve("cancel"),
    showCloseConfirm: () => Promise.resolve("cancel"),
    showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    getPathForFile: () => undefined,
    getSystemFonts: () => Promise.resolve([]),
    getDirectoryFiles: () => Promise.resolve([]),
    workspaceExists: () => Promise.resolve(false),
    watchFiles: () => {},
    watchDirectory: () => {},
    unwatchDirectory: () => {},
    createFile: () => Promise.resolve(null),
    createFolder: () => Promise.resolve(null),
    deleteFile: () => Promise.resolve(),
    renameFile: () => Promise.resolve(),
    cleanupLocalImages: () => Promise.resolve(),
    openThemeEditor: () => {},
    themeEditorWindowControl: () => {},
    saveCustomTheme: () => {},
    platform: "win32",
    rendererReady: () => {},
    tearOffTabStart: () => Promise.resolve(),
    tearOffTabEnd: () => Promise.resolve({ action: "failed" }),
    tearOffTabCancel: () => Promise.resolve(),
    focusFileIfOpen: () => Promise.resolve({ found: false }),
    getInitialTabData: () => Promise.resolve(null),
    getWindowBounds: () => Promise.resolve({ x: 0, y: 0, width: 1200, height: 800 }),
    startWindowDrag: () => {},
    stopWindowDrag: () => {},
    dropMerge: () => Promise.resolve({ action: "none" }),
    checkForUpdates: () => Promise.resolve(),
    downloadUpdate: () => Promise.resolve(),
    cancelUpdate: () => Promise.resolve(),
    quitAndInstall: () => Promise.resolve(),
    onUpdateStatus: () => {},
    onDownloadProgress: () => {},
  };
}
