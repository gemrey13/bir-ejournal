import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { scanAndSave } from './zipScanner'
import { reconcileOrFiles } from './reconcileOrFiles'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "../../resources/icon.ico"),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('dialog:openDirectory', async (_) => {
  const window = BrowserWindow.getFocusedWindow()
  if (!window) return null

  const { canceled, filePaths } = await dialog.showOpenDialog(window, {
    title: 'Select Branch Source Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Branch Folder'
  })

  if (canceled || filePaths.length === 0) {
    return null
  }

  return filePaths[0]
})

ipcMain.handle('scan', async (_event, rootPath: string, filters?: { from?: string; to?: string }) => {
  return scanAndSave(rootPath, filters)
})

ipcMain.handle(
  'reconcile',
  async (
    _event,
    branchPath: string,
    targetAmount: number,
    outputPath: string,
    filters?: { from?: string; to?: string },
    minHighValue = 0,
    maxLowValue = Number.POSITIVE_INFINITY,
    includeSrBill = true,
    enablePdfOutput = false
  ) => {
    return reconcileOrFiles(branchPath, targetAmount, outputPath, filters, minHighValue, maxLowValue, includeSrBill, enablePdfOutput)
  }
)

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.giligans.bir-ejournal')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
