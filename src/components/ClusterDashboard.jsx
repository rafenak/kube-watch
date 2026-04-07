import React from 'react';

export default function ClusterDashboard({ cluster, status, onNavigate }) {
  const nodes = status.nodes || [];

  if (status.status === 'loading') {
    return (
      <div className="dashboard">
        <div className="page-header">
          <h2>{cluster.name}</h2>
          <span className="conn-badge loading">connecting…</span>
        </div>
        <div className="loading">Fetching cluster info…</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>{cluster.name}</h2>
        <span className={`conn-badge ${status.status}`}>{status.status}</span>
      </div>

      {status.error && <div className="error-box">{status.error}</div>}

      <div className="dash-cards">
        <div className="dash-card" onClick={() => onNavigate('pods')} role="button" tabIndex={0}>
          <span className="dash-card-icon">⬡</span>
          <span className="dash-card-label">Pods</span>
        </div>
        <div className="dash-card" onClick={() => onNavigate('deployments')} role="button" tabIndex={0}>
          <span className="dash-card-icon">⚙</span>
          <span className="dash-card-label">Deployments</span>
        </div>
        <div className="dash-card" onClick={() => onNavigate('services')} role="button" tabIndex={0}>
          <span className="dash-card-icon">⇄</span>
          <span className="dash-card-label">Services</span>
        </div>
        <div className="dash-card" onClick={() => onNavigate('ingresses')} role="button" tabIndex={0}>
          <span className="dash-card-icon">⇥</span>
          <span className="dash-card-label">Ingresses</span>
        </div>
        <div className="dash-card" onClick={() => onNavigate('events')} role="button" tabIndex={0}>
          <span className="dash-card-icon">⚡</span>
          <span className="dash-card-label">Events</span>
        </div>
        <div className="dash-card" onClick={() => onNavigate('top-nodes')} role="button" tabIndex={0}>
          <span className="dash-card-icon">📊</span>
          <span className="dash-card-label">Top Nodes</span>
        </div>
      </div>

      <div className="config-section">
        <h3>Nodes ({nodes.length})</h3>
        {nodes.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Status</th><th>Roles</th><th>CPU</th><th>Memory</th><th>Version</th></tr>
            </thead>
            <tbody>
              {nodes.map((n, i) => (
                <tr key={i} className={n.status !== 'Ready' ? 'row-warn' : ''}>
                  <td className="mono">{n.name}</td>
                  <td><span className={`node-status ${n.status === 'Ready' ? 'ok' : 'bad'}`}>{n.status}</span></td>
                  <td>{n.roles.join(', ')}</td>
                  <td>{n.cpu}</td>
                  <td>{n.memory}</td>
                  <td>{n.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="hint">No node data available</p>
        )}
      </div>

      <div className="config-section">
        <h3>Namespaces ({(status.namespaces || []).length})</h3>
        <div className="ns-chips">
          {(status.namespaces || []).map(ns => (
            <span key={ns} className="tag">{ns}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
