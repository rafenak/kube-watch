import { useState, useEffect, useRef } from 'react';

export default function LogViewer({ cluster, target, onClose }) {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [container, setContainer] = useState(target.containers?.[0] || '');
  const [tailLines, setTailLines] = useState(200);
  const logRef = useRef(null);

  const fetchLogs = async () => {
    setLoading(true);
    const result = await window.kubeApi.getPodLogs(
      cluster, target.namespace, target.pod, container || undefined, tailLines
    );
    setLogs(result.error ? `Error: ${result.error}` : result.logs || '(empty)');
    setLoading(false);
    setTimeout(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, 50);
  };

  useEffect(() => { fetchLogs(); }, [container, tailLines]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="panel log-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Logs: {target.pod}</h3>
          <div className="panel-controls">
            {target.containers?.length > 1 && (
              <select value={container} onChange={e => setContainer(e.target.value)}>
                {target.containers.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            <select value={tailLines} onChange={e => setTailLines(Number(e.target.value))}>
              <option value={100}>100 lines</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
            <button className="btn-refresh" onClick={fetchLogs}>⟳</button>
            <button className="btn-close" onClick={onClose} type="button">✕</button>
          </div>
        </div>
        <pre className="log-content" ref={logRef}>
          {loading ? 'Loading logs…' : logs}
        </pre>
      </div>
    </div>
  );
}
