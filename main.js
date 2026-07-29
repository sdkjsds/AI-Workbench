const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// 后端服务地址：本地默认 localhost:3000，可用环境变量覆盖
const SERVER_URL = process.env.ZHILIU_SERVER || 'http://localhost:3000';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#ffffff',
    title: '知流',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(SERVER_URL);
  // 外链用系统默认浏览器打开，避免 Electron 内嵌加载
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
