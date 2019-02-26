const { app, BrowserWindow, shell } = require('electron')
const { downloader } = require('./src/downloader');
const path = require('path');

let win;
function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    resizable: false,
    width: 800,
    height: 600,
    webPreferences: {
      experimentalFeatures: true
    }
  })
  win.loadFile('src/index.html');
  
}

const send = function(type, total, len, files) {
  if (type === 'run') {
    win.webContents.send('progress' , {current: len, total: total, files: files});
  } else {
    win.webContents.send('end', {});
  }
}

const runExec = async (filePath) => {
  downloader(filePath, send);
}

const finish = () => {
  shell.openItem(path.join(__dirname, 'src', 'flags'));
  setTimeout(() => win.close(), 3000);
}

app.on('ready', createWindow);

exports.runExec = runExec;
exports.finish = finish;