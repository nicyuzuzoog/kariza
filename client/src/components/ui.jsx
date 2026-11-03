import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CATEGORY_IMAGES, CATEGORY_META } from '../utils/constants.js';
import {
  formatNumber,
  initials,
  stockLabel,
  stockPercent,
  stockState,
  stockTone,
} from '../utils/format.js';

/* ── Layout primitives ─────────────────────────────────────────────────── */

export function AppLoading({ label = 'Preparing your workspace…' }) {
  return (
    <div className="app-loading">
      <div className="app-loading-inner">
        <div className="brand-mark">M</div>
        <div className="page-loader" style={{ padding: 0 }}>
          <span className="spinner-ring" />
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, icon = 'bi-grid-1x2', title, sub, actions }) {
  return (
    <div className="page-head">
      <div className="page-head-copy">
        {eyebrow ? (
          <span className="eyebrow">
            <i className={`bi ${icon}`} />
            {eyebrow}
          </span>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  icon,
  sub,
  actions,
  children,
  footer,
  className = '',
  bodyClassName = 'panel-body',
  flush = false,
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || actions ? (
        <div className="panel-head">
          <div>
            {title ? (
              <h2 className="panel-title">
                {icon ? <i className={`bi ${icon}`} /> : null}
                {title}
              </h2>
            ) : null}
            {sub ? <p className="panel-sub">{sub}</p> : null}
          </div>
          {actions ? <div className="hstack wrap">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? 'panel-body flush' : bodyClassName}>{children}</div>
      {footer ? <div className="panel-foot">{footer}</div> : null}
    </section>
  );
}

export function StatCard({ icon, tone = 'brand', label, value, meta, to, onClick, hint }) {
  const content = (
    <>
      <div className="stat-head">
        <div className={`stat-icon tone-${tone}`}>
          <i className={`bi ${icon}`} />
        </div>
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {meta ? <div className="stat-meta">{meta}</div> : null}
      {to || onClick ? (
        <span className="stat-go" aria-hidden="true">
          <i className="bi bi-arrow-up-right" />
        </span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="stat-card is-interactive" aria-label={hint || `${label}: view details`}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className="stat-card is-interactive" onClick={onClick} aria-label={hint || `${label}: filter`}>
        {content}
      </button>
    );
  }

  return <article className="stat-card">{content}</article>;
}

/**
 * Spread these props on any clickable element that is not already a link
 * or button (table rows, cards, list items). Adds keyboard activation.
 */
export function interactiveProps(onClick, label) {
  if (!onClick) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick(event);
      }
    },
  };
}

export function Pill({ tone = 'neutral', icon, dot, children, className = '' }) {
  return (
    <span className={`pill tone-${tone} ${className}`.trim()}>
      {dot ? <span className="dot" /> : null}
      {icon ? <i className={`bi ${icon}`} /> : null}
      {children}
    </span>
  );
}

const STATUS_META = {
  ordered: { tone: 'warn', icon: 'bi-hourglass-split', label: 'Ordered' },
  received: { tone: 'success', icon: 'bi-check2-circle', label: 'Received' },
  cancelled: { tone: 'neutral', icon: 'bi-slash-circle', label: 'Cancelled' },
  in_transit: { tone: 'warn', icon: 'bi-truck', label: 'In transit' },
  completed: { tone: 'success', icon: 'bi-check2-circle', label: 'Completed' },
  issued: { tone: 'success', icon: 'bi-box-arrow-up', label: 'Issued' },
  voided: { tone: 'neutral', icon: 'bi-arrow-counterclockwise', label: 'Voided' },
  paid: { tone: 'success', icon: 'bi-cash-coin', label: 'Paid' },
  partial: { tone: 'warn', icon: 'bi-pie-chart', label: 'Part paid' },
  unpaid: { tone: 'danger', icon: 'bi-exclamation-circle', label: 'Unpaid' },
  active: { tone: 'success', icon: 'bi-dot', label: 'Active' },
  inactive: { tone: 'neutral', icon: 'bi-dash-circle', label: 'Inactive' },
  low: { tone: 'warn', icon: 'bi-exclamation-triangle', label: 'Low' },
  out: { tone: 'danger', icon: 'bi-x-octagon', label: 'Out' },
  ok: { tone: 'success', icon: 'bi-check-circle', label: 'Healthy' },
  critical: { tone: 'danger', icon: 'bi-exclamation-octagon', label: 'Critical' },
  warning: { tone: 'warn', icon: 'bi-exclamation-triangle', label: 'Warning' },
  info: { tone: 'info', icon: 'bi-info-circle', label: 'Info' },
};

export function StatusPill({ status, label }) {
  const meta = STATUS_META[status] || { tone: 'neutral', icon: 'bi-circle', label: status };
  return (
    <Pill tone={meta.tone} icon={meta.icon}>
      {label || meta.label}
    </Pill>
  );
}

export function EmptyState({ icon = 'bi-inbox', title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-orb">
        <i className={`bi ${icon}`} />
      </div>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader">
      <span className="spinner-ring" />
      <span>{label}</span>
    </div>
  );
}

export function InlineAlert({ type = 'info', children }) {
  const icons = {
    error: 'bi-exclamation-octagon-fill',
    success: 'bi-check-circle-fill',
    info: 'bi-info-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
  };
  return (
    <div className={`inline-alert ${type}`}>
      <i className={`bi ${icons[type] || icons.info}`} />
      <div>{children}</div>
    </div>
  );
}

/* ── Inputs ────────────────────────────────────────────────────────────── */

export function Field({ label, required, error, hint, htmlFor, children }) {
  return (
    <div className="field">
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error">
          <i className="bi bi-exclamation-circle" />
          {error}
        </p>
      ) : null}
      {!error && hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`search-field ${className}`.trim()}>
      <i className="bi bi-search" />
      <input
        type="search"
        className="control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segment ${value === option.value ? `active ${option.className || ''}` : ''}`.trim()}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <i className={`bi ${option.icon}`} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function FilterTabs({ options, value, onChange }) {
  return (
    <div className="filter-tabs">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-tab ${value === option.value ? 'active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined ? <span className="n">{option.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function PageTabs({ tabs, value, onChange }) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`tab-btn ${value === tab.value ? 'active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon ? <i className={`bi ${tab.icon}`} /> : null}
          {tab.label}
          {tab.count !== undefined ? <span className="tab-count">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ── Navigation & paging ───────────────────────────────────────────────── */

function buildPages(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...set].filter((item) => item >= 1 && item <= pages).sort((a, b) => a - b);
  const output = [];
  list.forEach((item, index) => {
    if (index > 0 && item - list[index - 1] > 1) output.push('…');
    output.push(item);
  });
  return output;
}

export function Pagination({ page = 1, pages = 1, total = 0, limit = 10, onChange, noun = 'records' }) {
  if (!total) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);
  return (
    <div className="table-footer">
      <p className="table-count">
        Showing <strong>{formatNumber(start)}</strong>–<strong>{formatNumber(end)}</strong> of{' '}
        <strong>{formatNumber(total)}</strong> {noun}
      </p>
      <div className="pager">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <i className="bi bi-chevron-left" />
        </button>
        {buildPages(page, pages).map((item, index) =>
          item === '…' ? (
            <span className="ellipsis" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <button
              type="button"
              key={item}
              className={item === page ? 'active' : ''}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          )
        )}
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <i className="bi bi-chevron-right" />
        </button>
      </div>
    </div>
  );
}

/* ── Overlays ──────────────────────────────────────────────────────────── */

export function Drawer({ open, onClose, title, subtitle, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={`drawer ${wide ? 'wide' : ''}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close panel">
            <i className="bi bi-x-lg" />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
        {footer ? <footer className="drawer-foot">{footer}</footer> : null}
      </aside>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  children,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close dialog">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="modal-body">
          <div className={`modal-icon ${tone === 'warn' ? 'warn' : 'danger'}`}>
            <i className={`bi ${tone === 'warn' ? 'bi-exclamation-triangle' : 'bi-exclamation-octagon'}`} />
          </div>
          {message ? <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{message}</p> : null}
          {children}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === 'warn' ? 'btn-brand' : 'btn-danger'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ActionMenu({ items, label = 'Row actions' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const visible = items.filter((item) => !item.hidden);
  if (!visible.length) return null;

  return (
    <div className="action-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn btn-outline-soft btn-icon-only"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
      >
        <i className="bi bi-three-dots" />
      </button>
      {open ? (
        <div className="menu-card">
          {visible.map((item, index) =>
            item.separator ? (
              <div className="menu-sep" key={`sep-${index}`} />
            ) : (
              <button
                type="button"
                key={item.label}
                className={`menu-item ${item.danger ? 'danger' : ''}`.trim()}
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                <i className={`bi ${item.icon || 'bi-dot'}`} />
                {item.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

/* ── Media & stock ─────────────────────────────────────────────────────── */

export function Avatar({ name = '', src, size = '', tone = '' }) {
  return (
    <span className={`avatar ${size} ${tone}`.trim()}>
      {src ? <img src={src} alt={name} /> : initials(name) || 'M'}
    </span>
  );
}

export function ProductThumb({ product, size = '' }) {
  const [failed, setFailed] = useState(false);
  const meta = CATEGORY_META[product?.category] || CATEGORY_META.Other;
  const source = product?.imageUrl || CATEGORY_IMAGES[product?.category] || CATEGORY_IMAGES.Other;

  return (
    <span className={`product-thumb ${size}`.trim()}>
      {!failed && source ? (
        <img src={source} alt={product?.name || 'Product'} onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span className="thumb-fallback">
          <i className={`bi ${meta.icon}`} />
        </span>
      )}
    </span>
  );
}

export function StockMeter({ product, large = false }) {
  const state = stockState(product);
  const percent = state === 'out' ? 100 : stockPercent(product);
  return (
    <div className={`stock-meter ${state === 'ok' ? '' : state} ${large ? 'lg' : ''}`.trim()}>
      <span style={{ width: `${Math.max(percent, 3)}%` }} />
    </div>
  );
}

export function StockIndicator({ product }) {
  const state = stockState(product);
  return (
    <div className="stock-indicator">
      <span className="qty">
        {formatNumber(product?.quantity)} {product?.unit}
      </span>
      <div className="meter-wrap">
        <StockMeter product={product} />
      </div>
    </div>
  );
}

export function StockBadge({ product }) {
  const state = stockState(product);
  return (
    <Pill tone={stockTone(state)} dot>
      {stockLabel(state)}
    </Pill>
  );
}

export function CategoryTag({ category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.Other;
  return (
    <span className="category-tag">
      <i className={`bi ${meta.icon}`} />
      {category}
    </span>
  );
}

export function CrumbBar({ items }) {
  return (
    <nav className="crumb-bar" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="hstack" style={{ gap: 7 }}>
          {index > 0 ? <i className="bi bi-chevron-right" /> : null}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="vstack" style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton skeleton-line" key={index} style={{ height: 42 }} />
      ))}
    </div>
  );
}
