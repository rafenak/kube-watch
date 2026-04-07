import { useState, useEffect } from 'react';

export default function ConfigPage({ config, setConfig, onDone }) {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedContexts, setSelectedContexts] = useState([]);
  const [configPath, setConfigPath] = useState('');
  const [execDir, setExecDir] = useState('');
  const [detectedVenvs, setDetectedVenvs] = useState([]);

  useEffect(() => {
    window.kubeApi?.getConfigPath().then(setConfigPath).catch(() => {});
    window.kubeApi?.detectVenvs().then(setDetectedVenvs).catch(() => {});
  }, []);

  const handleUpload = async () => {
    setUploading(true);
    const result = await window.kubeApi.uploadKubeconfig();
    setUploading(false);
    if (!result) return;
    if (result.error) { setUploadResult({ error: result.error }); return; }
    setUploadResult(result);
    setSelectedContexts(result.contexts.map(c => c.name));
    setExecDir(result.dirPath || '');
  };

  const handleBrowseExecDir = async () => {
    const dir = await window.kubeApi.browseExecDir();
    if (dir) setExecDir(dir);
  };

  const handleBrowsePython = async () => {
    const p = await window.kubeApi.browsePythonPath();
    if (p) {
      const updated = { ...config, pythonPath: p };
      await window.kubeApi.saveConfig(updated);
      setConfig(updated);
    }
  };

  const setPythonPath = async (p) => {
    const updated = { ...config, pythonPath: p };
    await window.kubeApi.saveConfig(updated);
    setConfig(updated);
  };

  const handleAddClusters = async () => {
    if (!uploadResult || !uploadResult.contexts) return;
    const newClusters = uploadResult.contexts
      .filter(c => selectedContexts.includes(c.name))
      .map(c => ({
        name: c.name,
        context: c.name,
        kubeconfigPath: uploadResult.filePath,
        execWorkingDir: uploadResult.hasExecAuth ? execDir : undefined,
        execAuth: c.execAuth || false,
        pythonPath: config.pythonPath || undefined,
        tags: []
      }));
    const updated = {
      ...config,
      clusters: [
        ...config.clusters.filter(existing =>
          !newClusters.some(n => n.context === existing.context)
        ),
        ...newClusters
      ]
    };
    await window.kubeApi.saveConfig(updated);
    setConfig(updated);
    setUploadResult(null);
    setSelectedContexts([]);
    setExecDir('');
    onDone();
  };

  const removeCluster = async (context) => {
    const updated = { ...config, clusters: config.clusters.filter(c => c.context !== context) };
    await window.kubeApi.saveConfig(updated);
    setConfig(updated);
  };

  const clearAllClusters = async () => {
    if (!window.confirm('Remove all clusters and reset config?')) return;
    const fresh = await window.kubeApi.clearConfig();
    setConfig(fresh);
    setUploadResult(null);
  };

  const toggleContext = (name) => {
    setSelectedContexts(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const updateExecDir = async (context, newDir) => {
    const updated = {
      ...config,
      clusters: config.clusters.map(c =>
        c.context === context ? { ...c, execWorkingDir: newDir } : c
      )
    };
    await window.kubeApi.saveConfig(updated);
    setConfig(updated);
  };

  const grouped = config.clusters.reduce((acc, c) => {
    const key = c.kubeconfigPath || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  return (
    <div className="config-page">
      <h2>Configuration</h2>

      {/* Python Path Setting */}
      <div className="config-section">
        <h3>🐍 Python Path</h3>
        <p className="hint">
          Set the Python binary for exec-based auth (e.g. from your venv).
          Required if your kubeconfig uses commands like <code>python hak</code>.
        </p>

        <div className="python-path-row">
          <input
            type="text"
            value={config.pythonPath || ''}
            onChange={e => setPythonPath(e.target.value)}
            placeholder="e.g. ~/venvs/kube_env/bin/python"
            className="exec-dir-input"
          />
          <button className="btn-secondary" onClick={handleBrowsePython}>Browse</button>
        </div>

        {detectedVenvs.length > 0 && (
          <div className="detected-venvs">
            <span className="hint">Detected venvs:</span>
            {detectedVenvs.map(v => (
              <button
                key={v}
                className={`venv-btn ${config.pythonPath === v ? 'active' : ''}`}
                onClick={() => setPythonPath(v)}
              >
                {v.replace(/^\/Users\/[^/]+/, '~')}
              </button>
            ))}
          </div>
        )}

        {config.pythonPath && (
          <div className="python-active">
            ✓ Using: <code>{config.pythonPath}</code>
            <button className="btn-sm" onClick={() => setPythonPath('')}>Clear</button>
          </div>
        )}
      </div>

      {/* Upload Kubeconfig */}
      <div className="config-section">
        <h3>Upload Kubeconfig</h3>
        <p className="hint">Select your kubeconfig file. Exec-based auth (like hak) is auto-detected.</p>
        <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Reading file…' : '📁 Browse Kubeconfig'}
        </button>

        {uploadResult?.error && (
          <div className="error-box">Error: {uploadResult.error}</div>
        )}

        {uploadResult?.contexts && (
          <div className="context-picker">
            <p>Found {uploadResult.contexts.length} context(s) in <code>{uploadResult.filePath}</code></p>

            {uploadResult.hasExecAuth && (
              <div className="exec-auth-notice">
                <div className="exec-auth-header">
                  <span className="exec-auth-icon">🔑</span>
                  <span>Exec-based authentication detected</span>
                </div>
                <p className="hint">
                  Set the working directory to the folder containing the auth script (e.g. <code>hak</code>).
                </p>
                <div className="exec-dir-row">
                  <input
                    type="text"
                    value={execDir}
                    onChange={e => setExecDir(e.target.value)}
                    placeholder="Working directory for exec auth"
                    className="exec-dir-input"
                  />
                  <button className="btn-secondary" onClick={handleBrowseExecDir}>Browse</button>
                </div>
                {!config.pythonPath && (
                  <p className="hint" style={{ color: 'var(--orange)', marginTop: 8 }}>
                    ⚠ No Python path set. Set it above if your exec auth uses Python.
                  </p>
                )}
              </div>
            )}

            <div className="context-list">
              {uploadResult.contexts.map(ctx => (
                <label key={ctx.name} className="context-item">
                  <input
                    type="checkbox"
                    checked={selectedContexts.includes(ctx.name)}
                    onChange={() => toggleContext(ctx.name)}
                  />
                  <div className="context-info">
                    <span className="context-name">{ctx.name}</span>
                    <span className="context-detail">cluster: {ctx.cluster}</span>
                    {ctx.execAuth && ctx.execInfo && (
                      <span className="exec-badge">
                        exec: {ctx.execInfo.command} {ctx.execInfo.args.join(' ')}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="context-actions">
              <button className="btn-primary" onClick={handleAddClusters}>
                Add {selectedContexts.length} Cluster(s)
              </button>
              <button className="btn-secondary" onClick={() => { setUploadResult(null); setSelectedContexts([]); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active Clusters */}
      <div className="config-section">
        <div className="section-header">
          <h3>Active Clusters ({config.clusters.length})</h3>
          {config.clusters.length > 0 && (
            <button className="btn-danger-sm" onClick={clearAllClusters}>Clear All</button>
          )}
        </div>

        {config.clusters.length === 0 ? (
          <p className="hint">No clusters configured. Upload a kubeconfig to get started.</p>
        ) : (
          Object.entries(grouped).map(([filePath, clusters]) => (
            <div key={filePath} className="config-group">
              <div className="config-group-header">
                <span className="config-group-file">📄 {filePath}</span>
                <button
                  className="btn-danger-sm"
                  onClick={async () => {
                    const updated = {
                      ...config,
                      clusters: config.clusters.filter(c => c.kubeconfigPath !== filePath)
                    };
                    await window.kubeApi.saveConfig(updated);
                    setConfig(updated);
                  }}
                >Remove File</button>
              </div>
              {clusters.map((c, i) => (
                <div key={i} className="cluster-config-item">
                  <div className="cluster-config-info">
                    <span className="cluster-config-name">{c.name}</span>
                    <span className="cluster-config-ctx">context: {c.context}</span>
                    {c.execAuth && (
                      <span className="exec-badge-sm">🔑 exec auth</span>
                    )}
                    {c.execWorkingDir && (
                      <span className="cluster-config-ctx">exec dir: {c.execWorkingDir}</span>
                    )}
                    {c.pythonPath && (
                      <span className="cluster-config-ctx">python: {c.pythonPath}</span>
                    )}
                  </div>
                  <div className="cluster-config-actions">
                    {c.execAuth && (
                      <button className="btn-sm" onClick={async () => {
                        const dir = await window.kubeApi.browseExecDir();
                        if (dir) updateExecDir(c.context, dir);
                      }}>Set Exec Dir</button>
                    )}
                    <button className="btn-danger-sm" onClick={() => removeCluster(c.context)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Poll Interval */}
      <div className="config-section">
        <h3>Poll Interval</h3>
        <div className="poll-config">
          <input
            type="number" min="5" max="300"
            value={config.pollIntervalSeconds}
            onChange={async (e) => {
              const updated = { ...config, pollIntervalSeconds: parseInt(e.target.value) || 30 };
              setConfig(updated);
              await window.kubeApi.saveConfig(updated);
            }}
          />
          <span>seconds</span>
        </div>
      </div>

      {/* Storage */}
      <div className="config-section config-meta">
        <h3>Storage</h3>
        <p className="hint">Config is saved at:</p>
        <div className="config-path-row">
          <code className="config-path">{configPath}</code>
          <button className="btn-sm" onClick={() => window.kubeApi.openConfigFolder()}>
            Open Folder
          </button>
        </div>
      </div>
    </div>
  );
}
