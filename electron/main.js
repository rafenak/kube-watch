const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const k8s = require('@kubernetes/client-node');

let mainWindow;
const dataDir = path.join(app.getPath('userData'), 'kube-monitor');

// K8s client cache — avoids re-parsing kubeconfig on every request
const clientCache = new Map();
const CACHE_TTL = 60000; // 1 minute
const REQUEST_TIMEOUT = 15000; // 15s timeout for k8s API calls

function withTimeout(promise, ms = REQUEST_TIMEOUT) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), ms))
  ]);
}

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function getConfigPath() {
  return path.join(dataDir, 'config.json');
}

function loadAppConfig() {
  const p = getConfigPath();
  if (!fs.existsSync(p)) return { pollIntervalSeconds: 30, clusters: [] };
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function saveAppConfig(config) {
  ensureDataDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

function createK8sClient(cluster) {
  const cacheKey = `${cluster.kubeconfigPath}:${cluster.context}`;
  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.kc;

  const kc = _buildK8sClient(cluster);
  clientCache.set(cacheKey, { kc, time: Date.now() });
  return kc;
}

function _buildK8sClient(cluster) {
  const kc = new k8s.KubeConfig();
  const kubePath = cluster.kubeconfigPath.replace('~', process.env.HOME);
  kc.loadFromFile(kubePath);
  if (cluster.context) kc.setCurrentContext(cluster.context);

  // For exec-based auth (like hak), the exec command may reference
  // relative paths. We resolve them relative to the kubeconfig directory
  // or a custom execWorkingDir.
  const execDir = cluster.execWorkingDir
    ? cluster.execWorkingDir.replace('~', process.env.HOME)
    : path.dirname(kubePath);

  kc.users.forEach(user => {
    if (user.exec) {
      // If the command args contain relative paths, resolve them
      const cmd = user.exec.command;
      if (user.exec.args) {
        user.exec.args = user.exec.args.map(arg => {
          // If arg looks like a relative file path (no leading / or -), resolve it
          if (arg && !arg.startsWith('/') && !arg.startsWith('-') && fs.existsSync(path.join(execDir, arg))) {
            return path.join(execDir, arg);
          }
          return arg;
        });
      }
      // If the command is python/python3, swap to venv python if configured
      if (cmd === 'python' || cmd === 'python3') {
        const appConfig = loadAppConfig();
        const pyPath = cluster.pythonPath || appConfig.pythonPath || null;
        if (pyPath) {
          user.exec.command = pyPath.replace('~', process.env.HOME);
        }
      } else if (cmd && !cmd.startsWith('/') && !cmd.includes('/')) {
        // Check if command exists as a file in execDir
        const fullCmd = path.join(execDir, cmd);
        if (fs.existsSync(fullCmd)) {
          user.exec.command = fullCmd;
        }
      }

      // Inject execDir-related env vars
      user.exec.env = user.exec.env || [];
      if (!user.exec.env.find(e => e.name === 'KUBE_EXEC_DIR')) {
        user.exec.env.push({ name: 'KUBE_EXEC_DIR', value: execDir });
      }
    }
  });

  return kc;
}

// ── Config management ──
ipcMain.handle('get-config', () => loadAppConfig());
ipcMain.handle('save-config', (_, config) => { saveAppConfig(config); return true; });
ipcMain.handle('get-config-path', () => getConfigPath());
ipcMain.handle('clear-config', () => {
  const defaultConfig = { pollIntervalSeconds: 30, clusters: [] };
  saveAppConfig(defaultConfig);
  return defaultConfig;
});
ipcMain.handle('open-config-folder', () => {
  const { shell } = require('electron');
  shell.openPath(dataDir);
});

ipcMain.handle('browse-exec-dir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Working Directory for Exec Auth (e.g. folder containing hak)',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('browse-python-path', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Python Binary (e.g. from your venv)',
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('detect-venvs', () => {
  // Look for common venv python binaries
  const candidates = [
    path.join(process.env.HOME, 'venvs', 'kube_env', 'bin', 'python'),
    path.join(process.env.HOME, 'venvs', 'kube_env', 'bin', 'python3'),
    path.join(process.env.HOME, '.venv', 'bin', 'python'),
    path.join(process.env.HOME, '.venv', 'bin', 'python3'),
  ];
  return candidates.filter(p => fs.existsSync(p));
});

ipcMain.handle('upload-kubeconfig', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Kubeconfig File',
    properties: ['openFile'],
    filters: [{ name: 'All Files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromFile(filePath);

    // Detect exec-based auth per user
    const execUsers = {};
    kc.users.forEach(user => {
      if (user.exec) {
        execUsers[user.name] = {
          command: user.exec.command,
          args: user.exec.args || [],
          apiVersion: user.exec.apiVersion
        };
      }
    });

    const contexts = kc.contexts.map(c => {
      const hasExec = !!execUsers[c.user];
      return {
        name: c.name,
        cluster: c.cluster,
        user: c.user,
        namespace: c.namespace || 'default',
        execAuth: hasExec,
        execInfo: hasExec ? execUsers[c.user] : null
      };
    });
    return {
      filePath,
      dirPath: path.dirname(filePath),
      contexts,
      currentContext: kc.currentContext,
      hasExecAuth: Object.keys(execUsers).length > 0
    };
  } catch (err) {
    return { error: err.message };
  }
});

// ── Cluster overview ──
ipcMain.handle('fetch-cluster-overview', async (_, cluster) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);

    const [nodes, nsList] = await Promise.all([
      withTimeout(core.listNode().then(r => r.body.items)).catch(() => []),
      withTimeout(core.listNamespace().then(r => r.body.items.map(n => n.metadata.name))).catch(() => [])
    ]);

    const nodesSummary = nodes.map(n => {
      const ready = (n.status.conditions || []).find(c => c.type === 'Ready');
      return {
        name: n.metadata.name,
        status: ready?.status === 'True' ? 'Ready' : 'NotReady',
        roles: Object.keys(n.metadata.labels || {})
          .filter(l => l.startsWith('node-role.kubernetes.io/'))
          .map(l => l.replace('node-role.kubernetes.io/', '')) || ['worker'],
        cpu: n.status.capacity?.cpu || '0',
        memory: n.status.capacity?.memory || '0',
        version: n.status.nodeInfo?.kubeletVersion || 'unknown'
      };
    });

    return { status: 'connected', namespaces: nsList, nodes: nodesSummary };
  } catch (err) {
    return { status: 'error', error: err.message, namespaces: [], nodes: [] };
  }
});

// ── Pods ──
ipcMain.handle('get-pods', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = namespace === '_all'
      ? await core.listPodForAllNamespaces()
      : await core.listNamespacedPod(namespace);
    return res.body.items.map(pod => {
      const cs = pod.status.containerStatuses || [];
      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        phase: pod.status.phase || 'Unknown',
        ready: `${cs.filter(c => c.ready).length}/${cs.length}`,
        restarts: cs.reduce((s, c) => s + (c.restartCount || 0), 0),
        node: pod.spec.nodeName || '-',
        age: pod.metadata.creationTimestamp,
        containers: cs.map(c => c.name)
      };
    });
  } catch (err) { return { error: err.message }; }
});

// ── Deployments ──
ipcMain.handle('get-deployments', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const apps = kc.makeApiClient(k8s.AppsV1Api);
    const res = namespace === '_all'
      ? await apps.listDeploymentForAllNamespaces()
      : await apps.listNamespacedDeployment(namespace);
    return res.body.items.map(d => ({
      name: d.metadata.name,
      namespace: d.metadata.namespace,
      replicas: d.status.replicas || 0,
      ready: d.status.readyReplicas || 0,
      updated: d.status.updatedReplicas || 0,
      available: d.status.availableReplicas || 0,
      strategy: d.spec.strategy?.type || '-',
      age: d.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Services ──
ipcMain.handle('get-services', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = namespace === '_all'
      ? await core.listServiceForAllNamespaces()
      : await core.listNamespacedService(namespace);
    return res.body.items.map(s => ({
      name: s.metadata.name,
      namespace: s.metadata.namespace,
      type: s.spec.type,
      clusterIP: s.spec.clusterIP || '-',
      externalIP: (s.status.loadBalancer?.ingress || []).map(i => i.ip || i.hostname).join(', ') || '-',
      ports: (s.spec.ports || []).map(p => `${p.port}/${p.protocol}`).join(', '),
      age: s.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Ingresses ──
ipcMain.handle('get-ingresses', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const net = kc.makeApiClient(k8s.NetworkingV1Api);
    const res = namespace === '_all'
      ? await net.listIngressForAllNamespaces()
      : await net.listNamespacedIngress(namespace);
    return res.body.items.map(ing => ({
      name: ing.metadata.name,
      namespace: ing.metadata.namespace,
      hosts: (ing.spec.rules || []).map(r => r.host || '*').join(', '),
      paths: (ing.spec.rules || []).flatMap(r => (r.http?.paths || []).map(p => p.path)).join(', '),
      className: ing.spec.ingressClassName || '-',
      age: ing.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── ConfigMaps ──
ipcMain.handle('get-configmaps', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = namespace === '_all'
      ? await core.listConfigMapForAllNamespaces()
      : await core.listNamespacedConfigMap(namespace);
    return res.body.items.map(cm => ({
      name: cm.metadata.name,
      namespace: cm.metadata.namespace,
      dataKeys: Object.keys(cm.data || {}).length,
      age: cm.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Secrets ──
ipcMain.handle('get-secrets', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = namespace === '_all'
      ? await core.listSecretForAllNamespaces()
      : await core.listNamespacedSecret(namespace);
    return res.body.items.map(s => ({
      name: s.metadata.name,
      namespace: s.metadata.namespace,
      type: s.type,
      dataKeys: Object.keys(s.data || {}).length,
      age: s.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Events ──
ipcMain.handle('get-events', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = namespace === '_all'
      ? await core.listEventForAllNamespaces()
      : await core.listNamespacedEvent(namespace);
    return res.body.items
      .sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0))
      .slice(0, 200)
      .map(e => ({
        type: e.type,
        reason: e.reason,
        message: e.message,
        object: `${e.involvedObject.kind}/${e.involvedObject.name}`,
        namespace: e.metadata.namespace,
        count: e.count || 1,
        lastSeen: e.lastTimestamp
      }));
  } catch (err) { return { error: err.message }; }
});

// ── Pod Logs ──
ipcMain.handle('get-pod-logs', async (_, cluster, namespace, podName, container, tailLines) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const res = await core.readNamespacedPodLog(
      podName, namespace, container, undefined, undefined, undefined,
      undefined, undefined, undefined, tailLines || 500, undefined
    );
    return { logs: res.body };
  } catch (err) { return { error: err.message }; }
});

// ── Top Nodes (resource usage) ──
ipcMain.handle('get-top-nodes', async (_, cluster) => {
  try {
    const kc = createK8sClient(cluster);
    const metricsClient = new k8s.Metrics(kc);
    const nodeMetrics = await metricsClient.getNodeMetrics();
    return nodeMetrics.items.map(m => ({
      name: m.metadata.name,
      cpuUsage: m.usage.cpu,
      memoryUsage: m.usage.memory
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Top Pods (resource usage) ──
ipcMain.handle('get-top-pods', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const metricsClient = new k8s.Metrics(kc);
    const podMetrics = namespace === '_all'
      ? await metricsClient.getPodMetrics()
      : await metricsClient.getPodMetrics(namespace);
    return podMetrics.items.map(m => ({
      name: m.metadata.name,
      namespace: m.metadata.namespace,
      containers: m.containers.map(c => ({
        name: c.name,
        cpu: c.usage.cpu,
        memory: c.usage.memory
      }))
    }));
  } catch (err) { return { error: err.message }; }
});

// ── StatefulSets ──
ipcMain.handle('get-statefulsets', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const apps = kc.makeApiClient(k8s.AppsV1Api);
    const res = namespace === '_all'
      ? await apps.listStatefulSetForAllNamespaces()
      : await apps.listNamespacedStatefulSet(namespace);
    return res.body.items.map(s => ({
      name: s.metadata.name,
      namespace: s.metadata.namespace,
      replicas: s.status.replicas || 0,
      ready: s.status.readyReplicas || 0,
      age: s.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── DaemonSets ──
ipcMain.handle('get-daemonsets', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const apps = kc.makeApiClient(k8s.AppsV1Api);
    const res = namespace === '_all'
      ? await apps.listDaemonSetForAllNamespaces()
      : await apps.listNamespacedDaemonSet(namespace);
    return res.body.items.map(d => ({
      name: d.metadata.name,
      namespace: d.metadata.namespace,
      desired: d.status.desiredNumberScheduled || 0,
      current: d.status.currentNumberScheduled || 0,
      ready: d.status.numberReady || 0,
      age: d.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Jobs ──
ipcMain.handle('get-jobs', async (_, cluster, namespace) => {
  try {
    const kc = createK8sClient(cluster);
    const batch = kc.makeApiClient(k8s.BatchV1Api);
    const res = namespace === '_all'
      ? await batch.listJobForAllNamespaces()
      : await batch.listNamespacedJob(namespace);
    return res.body.items.map(j => ({
      name: j.metadata.name,
      namespace: j.metadata.namespace,
      completions: `${j.status.succeeded || 0}/${j.spec.completions || 1}`,
      active: j.status.active || 0,
      failed: j.status.failed || 0,
      age: j.metadata.creationTimestamp
    }));
  } catch (err) { return { error: err.message }; }
});

// ── Describe resource (YAML-like detail) ──
ipcMain.handle('describe-resource', async (_, cluster, kind, namespace, name) => {
  try {
    const kc = createK8sClient(cluster);
    const core = kc.makeApiClient(k8s.CoreV1Api);
    const apps = kc.makeApiClient(k8s.AppsV1Api);
    const net = kc.makeApiClient(k8s.NetworkingV1Api);
    const batch = kc.makeApiClient(k8s.BatchV1Api);

    let res;
    switch (kind) {
      case 'pod': res = await core.readNamespacedPod(name, namespace); break;
      case 'deployment': res = await apps.readNamespacedDeployment(name, namespace); break;
      case 'service': res = await core.readNamespacedService(name, namespace); break;
      case 'ingress': res = await net.readNamespacedIngress(name, namespace); break;
      case 'configmap': res = await core.readNamespacedConfigMap(name, namespace); break;
      case 'secret': res = await core.readNamespacedSecret(name, namespace); break;
      case 'statefulset': res = await apps.readNamespacedStatefulSet(name, namespace); break;
      case 'daemonset': res = await apps.readNamespacedDaemonSet(name, namespace); break;
      case 'job': res = await batch.readNamespacedJob(name, namespace); break;
      case 'node': res = await core.readNode(name); break;
      default: return { error: `Unknown kind: ${kind}` };
    }
    return { yaml: JSON.stringify(res.body, null, 2) };
  } catch (err) { return { error: err.message }; }
});

// ── Window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Kube Monitor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => { ensureDataDir(); createWindow(); });
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
