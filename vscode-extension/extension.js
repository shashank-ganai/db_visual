const vscode = require('vscode');

class SidebarProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView) {
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.type) {
        case 'launch':
          vscode.commands.executeCommand('dbvisualizer.start');
          break;
      }
    });
  }

  _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DB Visualizer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            text-align: center;
        }
        h2 {
            color: var(--vscode-foreground);
            margin-bottom: 20px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 14px;
            font-size: 14px;
            cursor: pointer;
            border-radius: 4px;
            width: 100%;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        p {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            line-height: 1.5;
            margin-top: 16px;
        }
    </style>
</head>
<body>
    <h2>DB Visualizer</h2>
    <button onclick="launch()">Launch Full Screen</button>
    <p>Launches the Database Visualizer in a full editor tab for maximum canvas space.</p>

    <script>
        const vscode = acquireVsCodeApi();
        function launch() {
            vscode.postMessage({ type: 'launch' });
        }
    </script>
</body>
</html>`;
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Register the Sidebar View
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('dbvisualizer.sidebarView', sidebarProvider)
  );

  // Register Status Bar Item for 1-click access
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'dbvisualizer.start';
  statusBarItem.text = '$(database) DB Visualizer';
  statusBarItem.tooltip = 'Click to launch DB Visualizer Full Screen';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register the Command to open full screen tab
  let disposable = vscode.commands.registerCommand('dbvisualizer.start', function () {
    const config = vscode.workspace.getConfiguration('dbvisualizer');
    const targetUrl = config.get('url') || 'https://dbvisual.fabai.cloud';

    const panel = vscode.window.createWebviewPanel(
      'dbVisualizer',
      'DB Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = getWebviewContent(targetUrl);
  });

  context.subscriptions.push(disposable);
}

function getWebviewContent(targetUrl = 'https://dbvisual.fabai.cloud') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DB Visualizer</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe src="${targetUrl}" allow="clipboard-read; clipboard-write"></iframe>
    <script>
        const iframe = document.querySelector('iframe');
        
        function sendTheme() {
            if (!iframe || !iframe.contentWindow) return;
            const computed = getComputedStyle(document.documentElement);
            const isDark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast');
            
            const themeVars = {
                '--vscode-editor-background': computed.getPropertyValue('--vscode-editor-background').trim(),
                '--vscode-editorWidget-background': computed.getPropertyValue('--vscode-editorWidget-background').trim(),
                '--vscode-editor-foreground': computed.getPropertyValue('--vscode-editor-foreground').trim(),
                '--vscode-button-background': computed.getPropertyValue('--vscode-button-background').trim(),
                '--vscode-button-hoverBackground': computed.getPropertyValue('--vscode-button-hoverBackground').trim(),
                '--vscode-panel-border': computed.getPropertyValue('--vscode-panel-border').trim()
            };
            
            iframe.contentWindow.postMessage({ 
                type: 'vscode-theme-vars', 
                isDark, 
                themeVars 
            }, '*');
        }

        window.addEventListener('message', e => {
            if (e.data.type === 'ready') {
                sendTheme();
            }
        });

        // Watch for VS Code theme changes
        const observer = new MutationObserver(sendTheme);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
