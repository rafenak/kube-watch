export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-logo">⎈</div>
      <h1 className="about-title">Kube Monitor</h1>
      <p className="about-version">Version 1.0.0</p>
      <p className="about-desc">
        A lightweight desktop tool for monitoring multiple Kubernetes production
        environments. View pods, deployments, services, logs, events and more —
        all from one place.
      </p>

      <div className="about-section">
        <div className="about-card">
          <div className="about-card-label">Developer</div>
          <div className="about-card-value">Rafe Nakhuda</div>
        </div>
        <div className="about-card">
          <div className="about-card-label">Built with</div>
          <div className="about-card-value">Electron · React · Vite</div>
        </div>
        <div className="about-card">
          <div className="about-card-label">K8s Client</div>
          <div className="about-card-value">@kubernetes/client-node</div>
        </div>
        <div className="about-card">
          <div className="about-card-label">Platform</div>
          <div className="about-card-value">macOS · Windows · Linux</div>
        </div>
      </div>

      <div className="about-features">
        <div className="about-feature">✓ Multi-cluster support</div>
        <div className="about-feature">✓ Exec-based auth (hak / kubelogin)</div>
        <div className="about-feature">✓ Pod logs & describe</div>
        <div className="about-feature">✓ Scale & restart deployments</div>
        <div className="about-feature">✓ Events, top nodes/pods</div>
        <div className="about-feature">✓ Light & dark mode</div>
      </div>

      <p className="about-footer">
        Built for internal use · Kubernetes® is a registered trademark of the Linux Foundation
      </p>
    </div>
  );
}
