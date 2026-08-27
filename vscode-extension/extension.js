const vscode = require('vscode');

class SidebarProvider {
  constructor(extensionUri) {
    this._extensionUri = extensionUri;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    const config = vscode.workspace.getConfiguration('dbvisualizer');
    const targetUrl = config.get('url') || 'https://dbvisual.fabai.cloud';

    webviewView.webview.html = this._getHtmlForWebview(targetUrl);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'launch':
          vscode.commands.executeCommand('dbvisualizer.start');
          break;
        case 'openBrowser':
          vscode.commands.executeCommand('dbvisualizer.openBrowser');
          break;
        case 'changeUrl':
          vscode.commands.executeCommand('dbvisualizer.changeUrl');
          break;
      }
    });
  }

  _getHtmlForWebview(targetUrl) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DB Visualizer</title>
    <style>
        :root {
            --accent-glow: rgba(56, 189, 248, 0.25);
            --primary-gradient: linear-gradient(135deg, #0284c7, #6366f1);
        }
        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
            padding: 14px 12px;
            margin: 0;
            color: var(--vscode-foreground);
            background-color: transparent;
            box-sizing: border-box;
        }
        .sidebar-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 14px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
        }
        .header-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--primary-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 16px;
            box-shadow: 0 4px 12px var(--accent-glow);
        }
        .header-title-group h2 {
            font-size: 14px;
            font-weight: 600;
            margin: 0;
            color: var(--vscode-foreground);
        }
        .header-title-group span {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        .status-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            border-radius: 6px;
            background: var(--vscode-editorWidget-background, rgba(255,255,255,0.05));
            border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.08));
            font-size: 11px;
            margin-bottom: 14px;
            word-break: break-all;
        }
        .pulse-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            box-shadow: 0 0 8px #10b981;
            flex-shrink: 0;
        }
        .btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 9px 12px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
            box-sizing: border-box;
            margin-bottom: 8px;
        }
        .btn-primary {
            background: var(--vscode-button-background, #0284c7);
            color: var(--vscode-button-foreground, #ffffff);
            box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        }
        .btn-primary:hover {
            background: var(--vscode-button-hoverBackground, #0369a1);
        }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.08));
            color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
            border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
        }
        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.15));
        }
        .section-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--vscode-descriptionForeground);
            margin: 16px 0 8px 0;
        }
        .feature-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .feature-item {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 8px 10px;
            background: var(--vscode-editorWidget-background, rgba(255,255,255,0.03));
            border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
            border-radius: 6px;
            font-size: 11px;
        }
        .feature-item .icon {
            font-size: 14px;
            flex-shrink: 0;
            margin-top: 1px;
        }
        .feature-text strong {
            display: block;
            color: var(--vscode-foreground);
            font-size: 11px;
            margin-bottom: 2px;
        }
        .feature-text span {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            line-height: 1.3;
        }
        .shortcuts-box {
            background: var(--vscode-editorWidget-background, rgba(255,255,255,0.03));
            border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.06));
            border-radius: 6px;
            padding: 8px 10px;
            font-size: 11px;
            margin-top: 6px;
        }
        .shortcut-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
        }
        .shortcut-row:last-child {
            margin-bottom: 0;
        }
        kbd {
            background: var(--vscode-keybindingLabel-background, rgba(255,255,255,0.1));
            color: var(--vscode-keybindingLabel-foreground, var(--vscode-foreground));
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-family: monospace;
            border: 1px solid var(--vscode-keybindingLabel-border, rgba(255,255,255,0.2));
        }
    </style>
</head>
<body>
    <div class="sidebar-header">
        <div class="header-icon">🗄️</div>
        <div class="header-title-group">
            <h2>DB Visualizer</h2>
            <span>Database Schema & SP Explorer</span>
        </div>
    </div>

    <div class="status-pill" title="Target Server URL">
        <div class="pulse-dot"></div>
        <span>${targetUrl}</span>
    </div>

    <button class="btn btn-primary" onclick="launch()">
        <span>🚀</span>
        <span>Launch Full Screen</span>
    </button>

    <button class="btn btn-secondary" onclick="openBrowser()">
        <span>🌐</span>
        <span>Open in Web Browser</span>
    </button>

    <button class="btn btn-secondary" onclick="changeUrl()">
        <span>⚙️</span>
        <span>Change Server URL</span>
    </button>

    <div class="section-title">Core Modules</div>
    <div class="feature-list">
        <div class="feature-item">
            <span class="icon">📊</span>
            <div class="feature-text">
                <strong>ER Diagram Canvas</strong>
                <span>Interactive schema relationships & column details</span>
            </div>
        </div>
        <div class="feature-item">
            <span class="icon">⚡</span>
            <div class="feature-text">
                <strong>Stored Procedures</strong>
                <span>Dependency call tree, parameters & code inspection</span>
            </div>
        </div>
        <div class="feature-item">
            <span class="icon">🔀</span>
            <div class="feature-text">
                <strong>Schema Compare</strong>
                <span>Multi-database schema & procedure diff audits</span>
            </div>
        </div>
        <div class="feature-item">
            <span class="icon">🧭</span>
            <div class="feature-text">
                <strong>Path Finder</strong>
                <span>Trace foreign-key relationship hops across tables</span>
            </div>
        </div>
        <div class="feature-item">
            <span class="icon">🤖</span>
            <div class="feature-text">
                <strong>AI Assistant</strong>
                <span>Generate SQL queries & explain complex procedures</span>
            </div>
        </div>
    </div>

    <div class="section-title">Keyboard Shortcuts</div>
    <div class="shortcuts-box">
        <div class="shortcut-row">
            <span>Command Palette</span>
            <kbd>Ctrl+K</kbd>
        </div>
        <div class="shortcut-row">
            <span>Open Visualizer</span>
            <kbd>Status Bar</kbd>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function launch() {
            vscode.postMessage({ type: 'launch' });
        }
        function openBrowser() {
            vscode.postMessage({ type: 'openBrowser' });
        }
        function changeUrl() {
            vscode.postMessage({ type: 'changeUrl' });
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
  let startDisposable = vscode.commands.registerCommand('dbvisualizer.start', function () {
    const config = vscode.workspace.getConfiguration('dbvisualizer');
    const targetUrl = config.get('url') || 'https://dbvisual.fabai.cloud';

    const panel = vscode.window.createWebviewPanel(
      'dbVisualizer',
      'DB Visualizer',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        enableForms: true,
        enableCommandUris: true
      }
    );

    panel.webview.html = getWebviewContent(targetUrl);
  });
  context.subscriptions.push(startDisposable);

  // Register Command to open in default browser
  let browserDisposable = vscode.commands.registerCommand('dbvisualizer.openBrowser', function () {
    const config = vscode.workspace.getConfiguration('dbvisualizer');
    const targetUrl = config.get('url') || 'https://dbvisual.fabai.cloud';
    vscode.env.openExternal(vscode.Uri.parse(targetUrl));
  });
  context.subscriptions.push(browserDisposable);

  // Register Command to change URL dynamically
  let changeUrlDisposable = vscode.commands.registerCommand('dbvisualizer.changeUrl', async function () {
    const config = vscode.workspace.getConfiguration('dbvisualizer');
    const currentUrl = config.get('url') || 'https://dbvisual.fabai.cloud';

    const newUrl = await vscode.window.showInputBox({
      prompt: 'Enter DB Visualizer Server URL',
      value: currentUrl,
      placeHolder: 'https://dbvisual.fabai.cloud'
    });

    if (newUrl && newUrl.trim() !== '') {
      await config.update('url', newUrl.trim(), vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`DB Visualizer URL updated to: ${newUrl.trim()}`);
      vscode.commands.executeCommand('dbvisualizer.start');
    }
  });
  context.subscriptions.push(changeUrlDisposable);
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
            background-color: var(--vscode-editor-background, #0a0d14);
            font-family: var(--vscode-font-family, -apple-system, sans-serif);
        }
        #loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: var(--vscode-editor-background, #0a0d14);
            color: var(--vscode-foreground, #f8fafc);
            z-index: 10;
            transition: opacity 0.3s ease;
        }
        .spinner {
            width: 38px;
            height: 38px;
            border: 3px solid rgba(56, 189, 248, 0.2);
            border-top-color: #38bdf8;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin-bottom: 16px;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-title {
            font-size: 15px;
            font-weight: 600;
            margin-bottom: 6px;
        }
        .loading-subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground, #94a3b8);
        }
        .fallback-action {
            margin-top: 18px;
            display: none;
        }
        .fallback-btn {
            background-color: var(--vscode-button-background, #0284c7);
            color: var(--vscode-button-foreground, #ffffff);
            border: none;
            padding: 8px 16px;
            font-size: 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
    </style>
</head>
<body>
    <div id="loading-overlay">
        <div class="spinner"></div>
        <div class="loading-title">Connecting to DB Visualizer...</div>
        <div class="loading-subtitle">${targetUrl}</div>
        <div id="fallback-box" class="fallback-action">
            <button class="fallback-btn" onclick="openExternal()">Open in External Browser</button>
        </div>
    </div>

    <iframe 
        id="app-frame" 
        src="${targetUrl}" 
        allow="clipboard-read; clipboard-write; fullscreen"
    ></iframe>

    <script>
        const overlay = document.getElementById('loading-overlay');
        const iframe = document.getElementById('app-frame');
        const fallbackBox = document.getElementById('fallback-box');

        // Hide overlay once iframe loads
        iframe.addEventListener('load', () => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        });

        // Show fallback button if connection takes longer than 4s
        setTimeout(() => {
            if (fallbackBox) fallbackBox.style.display = 'block';
        }, 4000);

        function openExternal() {
            window.parent.postMessage({ type: 'openBrowser' }, '*');
        }

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
            if (e.data && e.data.type === 'ready') {
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
