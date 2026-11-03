import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { api } from '../utils/constants.js';
import {
  downloadCsv,
  formatDateTime,
  formatNumber,
  getErrorMessage,
  titleCase,
  toInputDate,
} from '../utils/format.js';
import {
  CrumbBar,
  EmptyState,
  InlineAlert,
  PageLoader,
  Pagination,
  Panel,
  Pill,
  SearchInput,
  StatCard,
} from '../components/ui.jsx';

const ENTITIES = ['User', 'Product', 'Purchase', 'Issue', 'Transfer', 'Supplier'];
const ACTIONS = [
  'auth.login',
  'auth.password_changed',
  'profile.update',
  'product.create',
  'product.update',
  'product.adjust',
  'product.archive',
  'product.restore',
  'purchase.create',
  'purchase.receive',
  'purchase.cancel',
  'purchase.update',
  'issue.create',
  'issue.void',
  'transfer.create',
  'transfer.complete',
  'transfer.cancel',
  'supplier.create',
  'supplier.update',
  'supplier.deactivate',
  'user.create',
  'user.update',
  'user.password_reset',
  'user.deactivate',
];

const ACTION_TONE = (action = '') => {
  if (action.includes('cancel') || action.includes('deactivate') || action.includes('archive') || action.includes('void')) return 'danger';
  if (action.includes('receive') || action.includes('complete') || action.includes('create')) return 'success';
  if (action.includes('password') || action.includes('login')) return 'violet';
  if (action.includes('update') || action.includes('adjust')) return 'warn';
  return 'info';
};

export default function AuditLog() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/audit', {
        params: { search: debouncedSearch.trim(), entity, action, from, to, page, limit: 20 },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, entity, action, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, entity, action, from, to]);

  const items = data.items || [];

  const reset = () => {
    setSearch('');
    setEntity('');
    setAction('');
    setFrom('');
    setTo('');
  };

  const quickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(toInputDate(start));
    setTo(toInputDate(end));
  };

  const exportCsv = () => {
    downloadCsv(
      `mrskariza-audit-${new Date().toISOString().slice(0, 10)}`,
      [
        { label: 'Timestamp', value: (row) => formatDateTime(row.createdAt) },
        { label: 'Actor', key: 'actorName' },
        { label: 'Role', key: 'actorRole' },
        { label: 'Action', key: 'action' },
        { label: 'Entity', key: 'entity' },
        { label: 'Description', key: 'description' },
        { label: 'IP', key: 'ip' },
      ],
      items
    );
    toast.success('Export ready', 'The current audit page has been downloaded as CSV.');
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Insights' }, { label: 'Audit log' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-shield-check" />
            Oversight
          </span>
          <h1 className="page-title">Audit log</h1>
          <p className="page-sub">
            A tamper-evident history of sign-ins, stock changes, account edits and administrative actions.
            Use it to answer “who did what, and when?” with confidence.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline-soft" onClick={exportCsv} disabled={!items.length}>
            <i className="bi bi-download" />
            Export page
          </button>
        </div>
      </div>

      <div className="stat-grid stagger">
        <StatCard icon="bi-journal-check" tone="brand" label="Audit entries" value={formatNumber(data.total || 0)} meta={<>Matching the current filters</>} />
        <StatCard icon="bi-person-check" tone="teal" label="Unique actors on page" value={formatNumber(new Set(items.map((item) => item.actorName)).size)} meta={<>Visible in this page of results</>} />
        <StatCard icon="bi-shield-lock" tone="violet" label="Entities covered" value={formatNumber(new Set(items.map((item) => item.entity)).size)} meta={<>Products, purchases, users and more</>} />
        <StatCard icon="bi-clock-history" tone="amber" label="Page" value={`${data.page || 1} / ${data.pages || 1}`} meta={<>Most recent actions first</>} />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search actor, action or description…" />
          <select className="control filter-select" value={entity} onChange={(event) => setEntity(event.target.value)}>
            <option value="">All entities</option>
            {ENTITIES.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="control filter-select" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <i className="bi bi-x-circle" />
            Clear
          </button>
        </div>

        <div className="toolbar" style={{ paddingTop: 0 }}>
          <div className="date-range">
            <span>From</span>
            <input type="date" className="control" value={from} onChange={(event) => setFrom(event.target.value)} />
            <span>To</span>
            <input type="date" className="control" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="preset-btns">
            <button type="button" onClick={() => quickRange(7)}>Last 7 days</button>
            <button type="button" onClick={() => quickRange(30)}>30 days</button>
            <button type="button" onClick={() => quickRange(90)}>90 days</button>
          </div>
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
          <PageLoader label="Loading audit trail…" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Entity</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => (
                  <tr key={entry._id}>
                    <td>
                      <p className="cell-title" style={{ fontSize: 11.5 }}>{formatDateTime(entry.createdAt)}</p>
                      <p className="cell-sub">{new Date(entry.createdAt).toLocaleDateString('en-GB', { weekday: 'short' })}</p>
                    </td>
                    <td>
                      <p className="cell-title">{entry.actorName || 'System'}</p>
                      <p className="cell-sub">{entry.actorRole ? titleCase(entry.actorRole) : 'Automated'}</p>
                    </td>
                    <td>
                      <Pill tone={ACTION_TONE(entry.action)}>{entry.action}</Pill>
                    </td>
                    <td>
                      <p className="cell-title" style={{ fontSize: 12 }}>{entry.description || '—'}</p>
                      {entry.entityId ? <p className="cell-sub mono">#{entry.entityId.slice(-8)}</p> : null}
                    </td>
                    <td>{entry.entity}</td>
                    <td className="mono" style={{ fontSize: 10.5 }}>{entry.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="bi-shield-check"
            title="No audit entries found"
            message="Try widening the date range or clearing the entity and action filters."
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={20}
          onChange={setPage}
          noun="audit entries"
        />
      </Panel>
    </div>
  );
}
