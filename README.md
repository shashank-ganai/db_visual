# DB Visualizer 🚀

Interactive Database Schema & Stored Procedure Visualizer with AI-assisted schema analysis, multi-database schema comparison, relationship path finder, and embedded VS Code extension support.

---

## 🔐 Static Login Credentials

No external database or OAuth configuration is required. You can sign in using any of the 5 pre-configured static accounts:

| Persona | Username | Password | Role |
|---|---|---|---|
| **System Admin** | `sys_ops9x` | `K9#vP$8xL2!zQ1` | Full administrative controls |
| **Lead Architect** | `arch_lead4` | `W4*mE#9tR7@yU3` | Schema, SPs & architectural analysis |
| **Data Engineer** | `data_core7` | `J7$nB&2hF5!pX8` | Relationship & path discovery |
| **QA Auditor** | `qa_audit2` | `T3#kM%6wS9*vC4` | Diff compare & schema audits |
| **Security Inspector** | `inspect_x8` | `R8@zY^5qD1!mN7` | Read-only schema inspection |

*(Tip: The login UI features 1-click quick-fill selector chips for instant access).*

---

## 🛠️ Local Development

### 1. Install Dependencies
```bash
# Install root, server, and client dependencies in one command
npm run install-all
```

### 2. Configure Environment
Copy `.env.example` in the `server` directory:
```bash
cp server/.env.example server/.env
```

### 3. Run Frontend & Backend Simultaneously
```bash
npm start
```
- **Backend API**: `http://localhost:3001`
- **Frontend App**: `http://localhost:5174`

---

## 🚀 How to Deploy to a Local Server / Production

When deploying to a local server (Windows or Linux), the Node.js Express server automatically serves both the backend REST API (`/api/*`) and the compiled static frontend SPA from a single port.

### Method 1: Single Node.js Production Process (Recommended)

1. **Build the Client**:
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   ```

2. **Configure Server Environment**:
   Ensure `server/.env` exists with your preferred configuration:
   ```env
   PORT=3001
   NODE_ENV=production
   JWT_SECRET=your_custom_production_secret_key
   ```

3. **Start the Production Server**:
   ```bash
   cd server
   npm install --omit=dev
   node index.js
   ```
   *The entire application (frontend + backend) will now be accessible at `http://localhost:3001` (or your local server IP: `http://<SERVER_IP>:3001`).*

---

### Method 2: Process Manager (PM2) - Background & Auto-Restart

To ensure the server runs in the background and restarts automatically if the server reboots:

1. **Install PM2 globally**:
   ```bash
   npm install -g pm2
   ```

2. **Build frontend assets**:
   ```bash
   cd client && npm run build && cd ..
   ```

3. **Launch with PM2**:
   ```bash
   cd server
   pm2 start index.js --name "db-visualizer"
   pm2 save
   pm2 startup
   ```

4. **Useful PM2 Commands**:
   - View status: `pm2 status`
   - View logs: `pm2 logs db-visualizer`
   - Restart: `pm2 restart db-visualizer`
   - Stop: `pm2 stop db-visualizer`

---

### Method 3: Windows Service (NSSM)

If your local server is a Windows machine and you want DB Visualizer to run automatically as a Windows Background Service:

1. Download [NSSM (Non-Sucking Service Manager)](https://nssm.cc/).
2. Run:
   ```cmd
   nssm install DBVisualizer "C:\Program Files\nodejs\node.exe" "D:\devs\db_visual\server\index.js"
   nssm set DBVisualizer AppDirectory "D:\devs\db_visual\server"
   nssm start DBVisualizer
   ```

---

### Method 4: Docker Container

If Docker is available on your local server:

1. **Build the Docker image**:
   ```bash
   docker build -t db-visualizer .
   ```

2. **Run the container**:
   ```bash
   docker run -d -p 3001:3001 --name db-visualizer-app db-visualizer
   ```

---

### Method 5: Reverse Proxy with NGINX or IIS

To run DB Visualizer under standard HTTP (`80`) or HTTPS (`443`) ports or a domain name:

**Sample NGINX Configuration**:
```nginx
server {
    listen 80;
    server_name dbvisual.local;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🧩 VS Code Extension

To run the embedded VS Code extension:
1. Open the repository in VS Code.
2. Press `F5` to open an Extension Development Host window.
3. Click the **$(database) DB Visualizer** button on the bottom status bar or sidebar to open the visualizer in full editor canvas mode.
