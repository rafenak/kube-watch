import React from 'react';

const RESOURCES = [
  { key: 'pods', icon: '⬡', label: 'Pods' },
  { key: 'deployments', icon: '⚙', label: 'Deployments' },
  { key: 'services', icon: '⇄', label: 'Services' },
  { key: 'ingresses', icon: '⇥', label: 'Ingresses' },
  { key: 'statefulsets', icon: '▦', label: 'StatefulSets' },
  { key: 'daemonsets', icon: '◎', label: 'DaemonSets' },
  { key: 'jobs', icon: '▶', label: 'Jobs' },
  { key: 'configmaps', icon: '☰', label: 'ConfigMaps' },
  { key: 'secrets', icon: '🔒', label: 'Secrets' },
  { key: 'events', icon: '⚡', label: 'Events' },
  { key: 'top-nodes', icon: '📊', label: 'Top Nodes' },
  { key: 'top-pods', icon: '📈', label: 'Top Pods' },
];

export default function Sidebar({ clusters, selectedCluster, onSelectCluster, onNavigate, onConfig, currentPage, resourceType }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="logo">⎈</span>
        <span className="sidebar-title">Kube Monitor</span>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Clusters</div>
        {clusters.map((c, i) => (
          <button
            key={i}
            className={`sidebar-item ${selectedCluster?.context === c.context && currentPage !== 'config' ? 'active' : ''}`}
            onClick={() => onSelectCluster(c)}
          >
            <span className="sidebar-dot" />
            <span>{c.name}</span>
          </button>
        ))}
      </div>

      {selectedCluster && (
        <div className="sidebar-section">
          <div className="sidebar-section-title">Resources</div>
          {RESOURCES.map(r => (
            <button
              key={r.key}
              className={`sidebar-item ${currentPage === 'resource' && resourceType === r.key ? 'active' : ''}`}
              onClick={() => onNavigate(r.key)}
            >
              <span className="sidebar-icon">{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <button className={`sidebar-item ${currentPage === 'config' ? 'active' : ''}`} onClick={onConfig}>
          <span className="sidebar-icon">⚙</span>
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
