const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kubeApi', {
  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  uploadKubeconfig: () => ipcRenderer.invoke('upload-kubeconfig'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  clearConfig: () => ipcRenderer.invoke('clear-config'),
  openConfigFolder: () => ipcRenderer.invoke('open-config-folder'),
  browseExecDir: () => ipcRenderer.invoke('browse-exec-dir'),
  browsePythonPath: () => ipcRenderer.invoke('browse-python-path'),
  detectVenvs: () => ipcRenderer.invoke('detect-venvs'),

  // Cluster
  fetchOverview: (cluster) => ipcRenderer.invoke('fetch-cluster-overview', cluster),

  // Resources
  getPods: (cluster, ns) => ipcRenderer.invoke('get-pods', cluster, ns),
  getDeployments: (cluster, ns) => ipcRenderer.invoke('get-deployments', cluster, ns),
  getServices: (cluster, ns) => ipcRenderer.invoke('get-services', cluster, ns),
  getIngresses: (cluster, ns) => ipcRenderer.invoke('get-ingresses', cluster, ns),
  getConfigMaps: (cluster, ns) => ipcRenderer.invoke('get-configmaps', cluster, ns),
  getSecrets: (cluster, ns) => ipcRenderer.invoke('get-secrets', cluster, ns),
  getEvents: (cluster, ns) => ipcRenderer.invoke('get-events', cluster, ns),
  getStatefulSets: (cluster, ns) => ipcRenderer.invoke('get-statefulsets', cluster, ns),
  getDaemonSets: (cluster, ns) => ipcRenderer.invoke('get-daemonsets', cluster, ns),
  getJobs: (cluster, ns) => ipcRenderer.invoke('get-jobs', cluster, ns),

  // Logs & Metrics
  getPodLogs: (cluster, ns, pod, container, lines) =>
    ipcRenderer.invoke('get-pod-logs', cluster, ns, pod, container, lines),
  getTopNodes: (cluster) => ipcRenderer.invoke('get-top-nodes', cluster),
  getTopPods: (cluster, ns) => ipcRenderer.invoke('get-top-pods', cluster, ns),

  // Describe
  describeResource: (cluster, kind, ns, name) =>
    ipcRenderer.invoke('describe-resource', cluster, kind, ns, name),

  // Actions
  restartDeployment: (cluster, ns, name) =>
    ipcRenderer.invoke('restart-deployment', cluster, ns, name),
  scaleDeployment: (cluster, ns, name, replicas) =>
    ipcRenderer.invoke('scale-deployment', cluster, ns, name, replicas),
});
