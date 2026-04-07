import React, { useState, useEffect, useCallback } from 'react';

const FETCHERS = {
  pods: (c, ns) => window.kubeApi.getPods(c, ns),
  deployments: (c, ns) => window.kubeApi.getDeployments(c, ns),
  services: (c, ns) => window.kubeApi.getServices(c, ns),
  ingresses: (c, ns) => window.kubeApi.getIngresses(c, ns),
  configmaps: (c, ns) => window.kubeApi.getConfigMaps(c, ns),
  secrets: (c, ns) => window.kubeApi.getSecrets(c, ns),
  events: (c, ns) => window.kubeApi.getEvents(c, ns),
  statefulsets: (c, ns) => window.kubeApi.getStatefulSets(c, ns),
  daemonsets: (c, ns) => window.kubeApi.getDaemonSets(c, ns),
  jobs: (c, ns) => window.kubeApi.getJobs(c, ns),
  'top-nodes': (c) => window.kubeApi.getTopNodes(c),
  'top-pods': (c, ns) => window.kubeApi.getTopPods(c, ns),
};

export default function ResourceView({ cluster, resourceType, namespace, namespaces, onNamespaceChange, onViewLogs, onDescribe }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetcher = FETCHERS[resourceType];
      if (!fetcher) { setError('Unknown resource'); setLoading(false); return; }
      const result = await fetcher(cluster, namespace);
      if (result?.error) { setError(result.error); setData([]); }
      else { setData(Array.isArray(result) ? result : []); }
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
      setData([]);
    }
    setLoading(false);
  }, [cluster, resourceType, namespace]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter(item =>
    !search || JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
  );

  const isNamespaced = !['top-nodes'].includes(resourceType);

  return (
    <div className="resource-view">
      <div className="page-header">
        <h2>{resourceType.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}</h2>
        <div className="resource-controls">
          {isNamespaced && (
            <select value={namespace} onChange={e => onNamespaceChange(e.target.value)}>
              <option value="_all">All Namespaces</option>
              {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
            </select>
          )}
          <input
            type="text" placeholder="Search…" value={search}
            onChange={e => setSearch(e.target.value)} className="search-input"
          />
          <button className="btn-refresh" onClick={fetchData}>⟳</button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading ? <div className="loading">Loading…</div> : (
        <div className="table-wrap">
          {renderTable(resourceType, filtered, onViewLogs, onDescribe, cluster)}
        </div>
      )}
      <div className="resource-count">{filtered.length} items</div>
    </div>
  );
}

function renderTable(type, data, onViewLogs, onDescribe, cluster) {
  switch (type) {
    case 'pods': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Status</th><th>Ready</th><th>Restarts</th><th>Node</th><th>Age</th><th>Actions</th></tr></thead>
        <tbody>{data.map((p, i) => (
          <tr key={i} className={p.phase !== 'Running' && p.phase !== 'Succeeded' ? 'row-warn' : ''}>
            <td className="mono">{p.name}</td><td>{p.namespace}</td>
            <td><span className={`phase-tag phase-${p.phase?.toLowerCase()}`}>{p.phase}</span></td>
            <td>{p.ready}</td>
            <td className={p.restarts > 5 ? 'text-warn' : ''}>{p.restarts}</td>
            <td className="mono">{p.node}</td><td>{timeAgo(p.age)}</td>
            <td className="actions">
              <button className="btn-sm" onClick={() => onViewLogs({ namespace: p.namespace, pod: p.name, containers: p.containers })}>Logs</button>
              <button className="btn-sm" onClick={() => onDescribe({ kind: 'pod', namespace: p.namespace, name: p.name })}>Describe</button>
            </td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'deployments': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Ready</th><th>Updated</th><th>Available</th><th>Strategy</th><th>Age</th><th></th></tr></thead>
        <tbody>{data.map((d, i) => (
          <tr key={i} className={d.ready < d.replicas ? 'row-warn' : ''}>
            <td className="mono">{d.name}</td><td>{d.namespace}</td>
            <td>{d.ready}/{d.replicas}</td><td>{d.updated}</td><td>{d.available}</td>
            <td>{d.strategy}</td><td>{timeAgo(d.age)}</td>
            <td><button className="btn-sm" onClick={() => onDescribe({ kind: 'deployment', namespace: d.namespace, name: d.name })}>Describe</button></td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'services': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Cluster IP</th><th>External IP</th><th>Ports</th><th>Age</th><th></th></tr></thead>
        <tbody>{data.map((s, i) => (
          <tr key={i}>
            <td className="mono">{s.name}</td><td>{s.namespace}</td><td>{s.type}</td>
            <td className="mono">{s.clusterIP}</td><td className="mono">{s.externalIP}</td>
            <td>{s.ports}</td><td>{timeAgo(s.age)}</td>
            <td><button className="btn-sm" onClick={() => onDescribe({ kind: 'service', namespace: s.namespace, name: s.name })}>Describe</button></td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'ingresses': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Hosts</th><th>Paths</th><th>Class</th><th>Age</th></tr></thead>
        <tbody>{data.map((ing, i) => (
          <tr key={i}>
            <td className="mono">{ing.name}</td><td>{ing.namespace}</td>
            <td>{ing.hosts}</td><td>{ing.paths}</td><td>{ing.className}</td><td>{timeAgo(ing.age)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'configmaps': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Data Keys</th><th>Age</th><th></th></tr></thead>
        <tbody>{data.map((cm, i) => (
          <tr key={i}>
            <td className="mono">{cm.name}</td><td>{cm.namespace}</td><td>{cm.dataKeys}</td><td>{timeAgo(cm.age)}</td>
            <td><button className="btn-sm" onClick={() => onDescribe({ kind: 'configmap', namespace: cm.namespace, name: cm.name })}>View</button></td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'secrets': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Data Keys</th><th>Age</th></tr></thead>
        <tbody>{data.map((s, i) => (
          <tr key={i}>
            <td className="mono">{s.name}</td><td>{s.namespace}</td><td>{s.type}</td><td>{s.dataKeys}</td><td>{timeAgo(s.age)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'events': return (
      <table className="data-table">
        <thead><tr><th>Type</th><th>Reason</th><th>Object</th><th>Message</th><th>Count</th><th>Last Seen</th></tr></thead>
        <tbody>{data.map((e, i) => (
          <tr key={i} className={e.type === 'Warning' ? 'row-warn' : ''}>
            <td><span className={`event-type ${e.type?.toLowerCase()}`}>{e.type}</span></td>
            <td>{e.reason}</td><td className="mono">{e.object}</td>
            <td className="msg-cell">{e.message}</td><td>{e.count}</td><td>{timeAgo(e.lastSeen)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'statefulsets': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Ready</th><th>Age</th><th></th></tr></thead>
        <tbody>{data.map((s, i) => (
          <tr key={i} className={s.ready < s.replicas ? 'row-warn' : ''}>
            <td className="mono">{s.name}</td><td>{s.namespace}</td><td>{s.ready}/{s.replicas}</td><td>{timeAgo(s.age)}</td>
            <td><button className="btn-sm" onClick={() => onDescribe({ kind: 'statefulset', namespace: s.namespace, name: s.name })}>Describe</button></td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'daemonsets': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Desired</th><th>Current</th><th>Ready</th><th>Age</th></tr></thead>
        <tbody>{data.map((d, i) => (
          <tr key={i} className={d.ready < d.desired ? 'row-warn' : ''}>
            <td className="mono">{d.name}</td><td>{d.namespace}</td><td>{d.desired}</td><td>{d.current}</td><td>{d.ready}</td><td>{timeAgo(d.age)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'jobs': return (
      <table className="data-table">
        <thead><tr><th>Name</th><th>Namespace</th><th>Completions</th><th>Active</th><th>Failed</th><th>Age</th></tr></thead>
        <tbody>{data.map((j, i) => (
          <tr key={i} className={j.failed > 0 ? 'row-warn' : ''}>
            <td className="mono">{j.name}</td><td>{j.namespace}</td><td>{j.completions}</td><td>{j.active}</td><td className={j.failed > 0 ? 'text-warn' : ''}>{j.failed}</td><td>{timeAgo(j.age)}</td>
          </tr>
        ))}</tbody>
      </table>
    );
    case 'top-nodes': return (
      <table className="data-table">
        <thead><tr><th>Node</th><th>CPU Usage</th><th>Memory Usage</th></tr></thead>
        <tbody>{data.length === 0 ? (
          <tr><td colSpan="3" className="loading">No metrics available. Ensure metrics-server is installed.</td></tr>
        ) : data.map((n, i) => (
          <tr key={i}><td className="mono">{n.name}</td><td>{n.cpuUsage}</td><td>{n.memoryUsage}</td></tr>
        ))}</tbody>
      </table>
    );
    case 'top-pods': return (
      <table className="data-table">
        <thead><tr><th>Pod</th><th>Namespace</th><th>Container</th><th>CPU</th><th>Memory</th></tr></thead>
        <tbody>{data.length === 0 ? (
          <tr><td colSpan="5" className="loading">No metrics available. Ensure metrics-server is installed.</td></tr>
        ) : data.flatMap((p, i) => (p.containers || []).map((c, j) => (
          <tr key={`${i}-${j}`}><td className="mono">{p.name}</td><td>{p.namespace}</td><td>{c.name}</td><td>{c.cpu}</td><td>{c.memory}</td></tr>
        )))}</tbody>
      </table>
    );
    default: return <p>Unsupported resource type</p>;
  }
}

function timeAgo(d) {
  if (!d) return '—';
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
