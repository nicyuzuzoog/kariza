import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotifications } from '../contexts/NotificationsContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import api from '../services/api.js';
import { formatDateTime, getErrorMessage, timeAgo } from '../utils/format.js';
import {
  CrumbBar,
  EmptyState,
  FilterTabs,
  InlineAlert,
  PageLoader,
  Pagination,
  Panel,
  Pill,
  ProductThumb,
  SearchInput,
  StatCard,
} from '../components/ui.jsx';

const TYPE_META = {
  out_of_stock: { icon: 'bi-x-octagon-fill', className: 'critical', label: 'Out of stock' },
  low_stock: { icon: 'bi-exclamation-triangle-fill', className: 'warning', label: 'Low stock' },
  system: { icon: 'bi-info-circle-fill', className: 'info', label: 'System' },
};

const TABS = [
  { value: 'open', label: 'Open alerts' },
  { value: 'unread', label: 'Unread' },
  { value: 'all', label: 'All history' },
];

export default function Notifications() {
  const { user } = useAuth();
  const toast = useToast();
  const { refresh: refreshBell, markRead: markBellRead, markAllRead: markBellAll } = useNotifications();
  const [tab, setTab] = useState('open');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, unreadCount: 0, unresolvedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/notifications', {
        params: {
          page,
          limit: 12,
          unread: tab === 'unread' ? 'true' : undefined,
          includeResolved: tab === 'all' ? 'true' : undefined,
        },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const items = (data.items || []).filter((item) => {
    if (!debouncedSearch.trim()) return true;
    const term = debouncedSearch.toLowerCase();
    return (
      item.title?.toLowerCase().includes(term) ||
      item.message?.toLowerCase().includes(term) ||
      item.product?.name?.toLowerCase().includes(term)
    );
  });

  const markRead = async (item) => {
    if (item.readBy?.includes(user?._id)) return;
    setBusyId(item._id);
    try {
      await markBellRead(item._id);
      await load();
      toast.success('Marked as read');
    } catch (requestError) {
      toast.error('Could not update notification', getErrorMessage(requestError));
    } finally {
      setBusyId('');
    }
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await markBellAll();
      toast.success('All caught up', 'Every notification has been marked as read.');
      await load();
    } catch (requestError) {
      toast.error('Could not mark all read', getErrorMessage(requestError));
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Insights' }, { label: 'Notifications' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-bell" />
            Stock alerts
          </span>
          <h1 className="page-title">Notification centre</h1>
          <p className="page-sub">
            Automatic low-stock and out-of-stock alerts for the main campus store, delivered to every role
            that needs to act. Alerts resolve themselves once stock recovers.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline-soft"
            onClick={markAll}
            disabled={markingAll || !data.unreadCount}
          >
            {markingAll ? <span className="spinner-ring sm" /> : <i className="bi bi-check2-all" />}
            Mark all read
          </button>
        </div>
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-bell"
          tone="brand"
          label="Unread alerts"
          value={data.unreadCount || 0}
          meta={<>For your role: {user?.role?.replace('_', ' ')}</>}
        />
        <StatCard
          icon="bi-exclamation-triangle"
          tone="amber"
          label="Open alerts"
          value={data.unresolvedCount || 0}
          meta={<>Still waiting for stock recovery</>}
        />
        <StatCard
          icon="bi-check2-circle"
          tone="teal"
          label="Auto-resolved"
          value={Math.max(0, (data.total || 0) - (data.unresolvedCount || 0))}
          meta={<>Resolved without manual action</>}
        />
        <StatCard
          icon="bi-clock-history"
          tone="violet"
          label="History on file"
          value={data.total || 0}
          meta={<>Open the history tab to review</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search alerts or products…" />
          <div className="toolbar-spacer" />
          <FilterTabs
            options={TABS.map((item) => ({
              ...item,
              count: item.value === 'unread' ? data.unreadCount : item.value === 'open' ? data.unresolvedCount : undefined,
            }))}
            value={tab}
            onChange={setTab}
          />
        </div>

        {error ? (
          <div style={{ padding: 18 }}>
            <InlineAlert type="error">{error}</InlineAlert>
            <button type="button" className="btn btn-brand" onClick={load} style={{ marginTop: 12 }}>
              <i className="bi bi-arrow-clockwise" />
              Try again
            </button>
          </div>
        ) : loading && !items.length ? (
          <PageLoader label="Loading notifications…" />
        ) : items.length ? (
          <div className="notif-page-list">
            {items.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.system;
              const unread = !item.readBy?.includes(user?._id);
              const resolved = Boolean(item.resolvedAt);
              return (
                <article
                  key={item._id}
                  className={`notif-page-card ${unread ? 'is-unread' : ''} ${resolved ? 'is-resolved' : ''}`.trim()}
                >
                  <span className={`notif-page-icon ${meta.className}`}>
                    <i className={`bi ${meta.icon}`} />
                  </span>

                  <div className="notif-page-copy">
                    <div className="hstack wrap" style={{ gap: 8, marginBottom: 4 }}>
                      <h3>{item.title}</h3>
                      <Pill tone={resolved ? 'success' : meta.className === 'critical' ? 'danger' : meta.className === 'warning' ? 'warn' : 'info'} dot>
                        {resolved ? 'Resolved' : meta.label}
                      </Pill>
                      {unread ? <Pill tone="brand" dot>Unread</Pill> : null}
                    </div>
                    <p>{item.message}</p>
                    <div className="notif-page-meta">
                      <span><i className="bi bi-clock" /> {timeAgo(item.createdAt)}</span>
                      <span><i className="bi bi-calendar3" /> {formatDateTime(item.createdAt)}</span>
                      {item.product?.sku ? <span><i className="bi bi-upc" /> {item.product.sku}</span> : null}
                      {item.resolvedAt ? <span><i className="bi bi-check2-circle" /> Resolved {timeAgo(item.resolvedAt)}</span> : null}
                    </div>
                  </div>

                  <div className="notif-page-actions">
                    {item.product ? (
                      <Link to={`/products/${item.product._id || item.product}`} className="btn btn-outline-soft btn-sm">
                        <i className="bi bi-box-seam" />
                        View product
                      </Link>
                    ) : null}
                    {unread ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => markRead(item)}
                        disabled={busyId === item._id}
                      >
                        {busyId === item._id ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
                        Mark read
                      </button>
                    ) : (
                      <span className="pill tone-neutral"><i className="bi bi-check2-all" />Read</span>
                    )}
                  </div>

                  {item.product ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 2 }}>
                      <ProductThumb product={item.product} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <p className="cell-title" style={{ fontSize: 11.5 }}>{item.product.name}</p>
                        <p className="cell-sub">
                          {item.product.quantity} {item.product.unit} at main · reorder {item.product.reorderLevel}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon="bi-bell-slash"
            title={tab === 'unread' ? 'No unread alerts' : 'You are all caught up'}
            message="Low-stock and out-of-stock alerts will appear here automatically when balances fall."
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={12}
          onChange={setPage}
          noun="notifications"
        />
      </Panel>

      <div className="soft-note gray mt-3">
        <i className="bi bi-info-circle" />
        <span>
          Alerts are de-duplicated per product and alert type. Once the main store balance rises above the
          reorder level, the matching alert is resolved automatically and stays in the history tab.
        </span>
      </div>
    </div>
  );
}
