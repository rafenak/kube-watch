import { useState, useEffect } from 'react';

export default function DescribePanel({ cluster, target, onClose }) {
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.kubeApi.describeResource(
        cluster, target.kind, target.namespace, target.name
      );
      setYaml(result.error ? `Error: ${result.error}` : result.yaml);
      setLoading(false);
    })();
  }, [cluster, target]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="panel describe-panel" onMouseDown={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>{target.kind}: {target.name}</h3>
          <button className="btn-close" onClick={onClose} type="button">✕</button>
        </div>
        <pre className="describe-content">
          {loading ? 'Loading…' : yaml}
        </pre>
      </div>
    </div>
  );
}
