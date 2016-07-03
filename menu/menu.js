 
const {remote} = require('electron');
const {Menu, MenuItem} = remote;
 
    //// window menu
const template = [
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        }
      },
      {
        label: 'Toggle Developer Tools',
        accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
        click(item, focusedWindow) {
          if (focusedWindow)
            focusedWindow.webContents.toggleDevTools();
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Setting',
        accelerator: 'CmdOrCtrl+E',
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        }
      }
    ]
  },
  {
    label: 'window',
    role: 'window',
    submenu: [
      { label:"minimize",role: 'minimize' },
      { label:"close",role: 'close' },
    ]
  },
  {
    label: 'help',
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click() { require('electron').shell.openExternal('http://electron.atom.io'); }
      },
    ]
  },
];

if (process.platform === 'darwin') {
  const name = require('electron').remote.app.getName();
  template.unshift({
    label: name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services',
        submenu: []
      },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ]
  });
  // Window menu.
  template[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close'
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize'
    },
    {
      label: 'Zoom',
      role: 'zoom'
    },
    {
      type: 'separator'
    },
    {
      label: 'Bring All to Front',
      role: 'front'
    }
  ];
}

const menu1 = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu1);