import { useEffect } from 'react';

export default function Toast({ text, tone = 'neutral', action, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [text, onClose]);

  return (
    <div className={`toast ${tone}`} role="status">
      <span>{text}</span>
      {action && (
        <button className="btn small" onClick={() => { action.run(); onClose(); }}>{action.label}</button>
      )}
      <button className="toast-x" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}
