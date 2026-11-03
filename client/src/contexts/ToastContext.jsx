import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

let counter = 0;

const ICONS = {
  success: 'bi-check-circle-fill',
  error: 'bi-exclamation-octagon-fill',
  warning: 'bi-exclamation-triangle-fill',
  info: 'bi-info-circle-fill',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (type, title, message) => {
      const id = ++counter;
      setToasts((current) => [...current.slice(-3), { id, type, title, message }]);
      window.setTimeout(() => remove(id), 4800);
      return id;
    },
    [remove]
  );

  const toast = useMemo(
    () => ({
      success: (title, message) => push('success', title, message),
      error: (title, message) => push('error', title, message),
      warning: (title, message) => push('warning', title, message),
      info: (title, message) => push('info', title, message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => (
          <div className={`toast-card ${item.type}`} key={item.id} role="status">
            <i className={`bi ${ICONS[item.type] || ICONS.info}`} />
            <div className="toast-copy">
              <strong>{item.title}</strong>
              {item.message ? <p>{item.message}</p> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => remove(item.id)}
              aria-label="Dismiss notification"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
