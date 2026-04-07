# ⎈ Kube Monitor

A lightweight desktop app for monitoring multiple Kubernetes production environments — built with Electron, React, and Vite.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/electron-28-blue)
![React](https://img.shields.io/badge/react-18-61dafb)

---

## Features

- **Multi-cluster support** — monitor multiple K8s clusters from one app
- **Kubeconfig upload** — browse and import kubeconfig files, auto-detects all contexts
- **Exec-based auth** — supports `hak`, `kubelogin`, and other exec-based auth plugins
- **Full resource views** — Pods, Deployments, Services, Ingresses, StatefulSets, DaemonSets, Jobs, ConfigMaps, Secrets, Events
- **Pod logs** — view logs with container picker and tail line selector
- **Describe** — full JSON detail for any resource (like `kubectl describe`)
- **Scale deployments** — change replica count from the UI
- **Restart deployments** — rolling restart with one click
- **Top Nodes / Top Pods** — resource usage (requires metrics-server)
- **Copy to clipboard** — click any resource name to copy
- **Light & dark mode** — toggle from the sidebar, persists across restarts
- **Auto-refresh** — configurable poll interval

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

> If you're on a corporate network with SSL issues:
> ```bash
> NODE_TLS_REJECT_UNAUTHORIZED=0 npm install
> ```

### Run in development

```bash
npm run electron:dev
```

---

## Configuration

On first launch, go to **Settings** and upload your kubeconfig file. The app will detect all contexts and let you choose which clusters to add.

### Exec-based auth (hak, kubelogin, etc.)

If your kubeconfig uses an exec-based auth plugin (e.g. `python hak --creds ...`):

1. Go to **Settings → Python Path** and set the path to your venv Python binary
   - e.g. `~/venvs/kube_env/bin/python`
   - The app auto-detects common venv locations
2. Set the **exec working directory** to the folder containing your auth script
   - e.g. `/path/to/Kube_Access`

### Config storage

App config is saved at:
```
~/Library/Application Support/kube-monitor/config.json   # macOS
%APPDATA%\kube-monitor\config.json                        # Windows
~/.config/kube-monitor/config.json                        # Linux
```

---

## Building

### macOS (DMG)
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run electron:build:mac
```

### Windows (NSIS installer)
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run electron:build:win
```

### Linux (AppImage + .deb)
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run electron:build:linux
```

### All platforms
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run electron:build:all
```

Output is in the `release/` directory.

### Regenerate icons
```bash
npm run generate-icons
```

---

## Project Structure

```
kube-watch/
├── electron/
│   ├── main.js          # Electron main process — all K8s API calls, IPC handlers
│   └── preload.js       # Secure bridge between main and renderer
├── src/
│   ├── App.jsx          # Root component, routing, theme management
│   ├── styles.css       # Global styles (dark + light theme)
│   └── components/
│       ├── Sidebar.jsx          # Navigation sidebar
│       ├── ConfigPage.jsx       # Settings: kubeconfig upload, python path, clusters
│       ├── ClusterDashboard.jsx # Cluster overview: nodes, namespaces
│       ├── ResourceView.jsx     # Generic resource table for all 12 resource types
│       ├── LogViewer.jsx        # Pod log viewer overlay
│       ├── DescribePanel.jsx    # Resource describe overlay
│       ├── AboutPage.jsx        # About screen
│       └── Toast.jsx            # Toast notification system
├── assets/
│   ├── icon.icns        # macOS icon
│   ├── icon.ico         # Windows icon
│   └── icon.png         # Linux icon
├── scripts/
│   └── generate-icons.js  # Icon generation from k8s SVG logo
├── environments.json    # Sample config reference
└── package.json
```

---

## Tech Stack

| | |
|---|---|
| Framework | Electron 28 + React 18 |
| Build tool | Vite 5 |
| K8s client | @kubernetes/client-node |
| Packaging | electron-builder |

---

## Developer

Built by **Rafe Nakhuda** for internal Kubernetes cluster monitoring.
