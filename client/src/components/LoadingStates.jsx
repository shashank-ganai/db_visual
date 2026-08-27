import React from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

export function FullScreenLoader({ message }) {
  return (
    <div className="fullscreen-center">
      <Loader2 className="animate-spin" size={32} color="var(--accent)" />
      <p>{message}</p>
    </div>
  );
}

export function FullScreenError({ message, onReconnect }) {
  return (
    <div className="fullscreen-center">
      <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <AlertCircle size={20} />
        {message}
      </div>
      {onReconnect && (
        <button className="btn btn-primary" onClick={onReconnect} style={{ marginTop: '1rem' }}>
          Reconnect Database
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, message, subtext }) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} color="var(--border)" />}
      <div>
        <p style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: '0.25rem' }}>{message}</p>
        {subtext && <p style={{ fontSize: '0.875rem' }}>{subtext}</p>}
      </div>
    </div>
  );
}
