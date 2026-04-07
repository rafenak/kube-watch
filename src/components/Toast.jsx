import { useState, useCallback } from 'react';

let _addToast = null;

export function toast(message, type = 'info') {
  if (_addToast) _addToast(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  _addToast = useCallback((message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
