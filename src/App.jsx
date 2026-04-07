import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ConfigPage from './components/ConfigPage';
import ClusterDashboard from './components/ClusterDashboard';
import ResourceView from './components/ResourceView';
import LogViewer from './components/LogViewer';
import DescribePanel from './components/DescribePanel';
import ToastContainer from './components/Toast';
import AboutPage from './components/AboutPage';

export default function App() {
  const [config, setConfig] = useState({ pollIntervalSeconds: 30, clusters: [] });
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [page, setPage] = useState('loading');
  const [resourceType, setResourceType] = useState('pods');
  const [namespace, setNamespace] = useState('_all');
  const [namespaces, setNamespaces] = useState([]);
  const [clusterStatus, setClusterStatus] = useState({});
  const [logTarget, setLogTarget] = useState(null);
  const [describeTarget, setDescribeTarget] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await window.kubeApi.getConfig();
      setConfig(cfg);
      if (cfg.clusters.length > 0 && !selectedCluster) {
        setSelectedCluster(cfg.clusters[0]);
        setPage('dashboard');
      } else {
        setPage('config');
      }
    } catch (err) {
      console.error('Failed to load config:', err);
      setPage('config');
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const onSelectCluster = async (cluster) => {
    setSelectedCluster(cluster);
    setPage('dashboard');
    setNamespace('_all');
    setClusterStatus({ status: 'loading', namespaces: [], nodes: [] });
    try {
      const overview = await window.kubeApi.fetchOverview(cluster);
      setClusterStatus(overview);
      setNamespaces(overview.namespaces || []);
    } catch (err) {
      setClusterStatus({ status: 'error', error: err.message, namespaces: [], nodes: [] });
    }
  };

  const onNavigate = (type) => {
    setResourceType(type);
    setPage('resource');
  };

  return (
    <div className="app-layout">
      <Sidebar
        clusters={config.clusters}
        selectedCluster={selectedCluster}
        onSelectCluster={onSelectCluster}
        onNavigate={onNavigate}
        onConfig={() => setPage('config')}
        onAbout={() => setPage('about')}
        onThemeToggle={toggleTheme}
        theme={theme}
        currentPage={page}
        resourceType={resourceType}
      />
      <main className="main-content">
        {page === 'loading' && (
          <div className="loading">Loading configuration…</div>
        )}
        {page === 'about' && <AboutPage />}
        {page === 'config' && (
          <ConfigPage config={config} setConfig={setConfig} onDone={loadConfig} />
        )}
        {page === 'dashboard' && selectedCluster && (
          <ClusterDashboard
            cluster={selectedCluster}
            status={clusterStatus}
            onNavigate={onNavigate}
          />
        )}
        {page === 'resource' && selectedCluster && (
          <ResourceView
            cluster={selectedCluster}
            resourceType={resourceType}
            namespace={namespace}
            namespaces={namespaces}
            onNamespaceChange={setNamespace}
            onViewLogs={setLogTarget}
            onDescribe={setDescribeTarget}
          />
        )}
        {logTarget && (
          <LogViewer
            cluster={selectedCluster}
            target={logTarget}
            onClose={() => setLogTarget(null)}
          />
        )}
        {describeTarget && (
          <DescribePanel
            cluster={selectedCluster}
            target={describeTarget}
            onClose={() => setDescribeTarget(null)}
          />
        )}
      </main>
      <ToastContainer />
    </div>
  );
}
