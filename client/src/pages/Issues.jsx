import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useProducts from '../hooks/useProducts.js';
import { api, can, RECIPIENT_TYPES } from '../utils/constants.js';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getErrorMessage,
  titleCase,
  toInputDate,
} from '../utils/format.js';
import {
  ConfirmDialog,
  CrumbBar,
  Drawer,
  EmptyState,
  Field,
  FilterTabs,
  InlineAlert,
  PageLoader,
  Pagination,
  Panel,
  SearchInput,
  StatCard,
  StatusPill,
  interactiveProps,
} from '../components/ui.jsx';
import { StockLineItems } from '../components/TransactionLines.jsx';

const STATUS_TABS = [
  { value: '', label: 'All issues' },
  { value: 'issued', label: 'Issued' },
  { value: 'voided', label: 'Voided' },
];

const emptyLine = () => ({ product: '', quantity: '1' });

export default function Issues() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [detail, setDetail] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidBusy, setVoidBusy] = useState(false);

  const canIssue = can(user?.role, 'recordIssues');
  const { products } = useProducts();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/issues', {
        params: { search: debouncedSearch.trim(), status, location, page, limit: 10 },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, location, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, location]);

  const items = data.items || [];
  const stats = data.stats || {};

  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const openVoid = (issue) => {
    setVoidReason('');
    setVoiding(issue);
  };

  const doVoid = async () => {
    if (!voiding) return;
    if (voidReason.trim().length < 3) {
      toast.error('Reason required', 'Please state why this issue is being voided.');
      return;
    }
    setVoidBusy(true);
    try {
      const { data: response } = await api.post(`/issues/${voiding._id}/void`, { reason: voidReason.trim() });
      toast.success('Issue voided', response.message);
      setVoiding(null);
      setDetail(null);
      load();
    } catch (requestError) {
      toast.error('Could not void issue', getErrorMessage(requestError));
    } finally {
      setVoidBusy(false);
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Issues' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-box-arrow-up" />
            Stock leaving the store
          </span>
          <h1 className="page-title">Issues & consumption</h1>
          <p className="page-sub">
            Record food, stationery and supplies given to classes, departments or staff. Every issue
            reduces stock and is preserved in the ledger, with a full reversal if voided.
          </p>
        </div>
        {canIssue ? (
          <div className="page-actions">
            <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
              <i className="bi bi-plus-lg" />
              Record issue
            </button>
          </div>
        ) : null}
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-box-arrow-up"
          tone="brand"
          label="Units issued"
          value={formatNumber(stats.unitsIssued || 0)}
          meta={<><strong>{formatNumber(stats.issueLines || 0)}</strong> item lines recorded</>}
        />
        <StatCard
          icon="bi-calendar3"
          tone="teal"
          label="Issued this month"
          value={formatNumber(stats.monthUnits || 0)}
          meta={<>Units leaving the stores this month</>}
        />
        <StatCard
          icon="bi-check2-circle"
          tone="violet"
          label="Active issue records"
          value={formatNumber(stats.issued || 0)}
          meta={<>Issues currently affecting stock</>}
        />
        <StatCard
          icon="bi-arrow-counterclockwise"
          tone="amber"
          label="Voided records"
          value={formatNumber(stats.voided || 0)}
          meta={<>Stock restored to the store</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference, recipient, class or purpose…"
          />
          <select className="control filter-select" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">Both stores</option>
            <option value="main">Main campus</option>
            <option value="branch">Branch campus</option>
          </select>
          <div className="toolbar-spacer" />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            <i className="bi bi-info-circle" /> {formatNumber(data.total || 0)} matching records
          </span>
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <FilterTabs
            options={STATUS_TABS.map((tab) => ({
              ...tab,
              count: tab.value === 'issued' ? stats.issued : tab.value === 'voided' ? stats.voided : data.total,
            }))}
            value={status}
            onChange={setStatus}
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
          <PageLoader label="Loading issue records…" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Recipient</th>
                  <th>Items</th>
                  <th>Store</th>
                  <th>Issued</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((issue) => (
                  <tr
                    key={issue._id}
                    className="is-clickable"
                    onClick={() => setDetail(issue)}
                    {...interactiveProps(() => setDetail(issue), `Open ${issue.reference}`)}
                  >
                    <td>
                      <p className="cell-title mono">{issue.reference}</p>
                      <p className="cell-sub">{issue.purpose || 'No purpose recorded'}</p>
                    </td>
                    <td>
                      <div className="recipient-cell">
                        <strong>{issue.recipientName}</strong>
                        <span>
                          {titleCase(issue.recipientType)}
                          {issue.className ? ` · ${issue.className}` : ''}
                          {issue.department ? ` · ${issue.department}` : ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <p className="cell-title">
                        {issue.items?.length || 0} item{issue.items?.length === 1 ? '' : 's'}
                      </p>
                      <p className="cell-sub">
                        {formatNumber((issue.items || []).reduce((sum, item) => sum + item.quantity, 0))} units
                      </p>
                    </td>
                    <td>{issue.location === 'branch' ? 'Branch' : 'Main'}</td>
                    <td>
                      {formatDate(issue.issueDate)}
                      <p className="cell-sub">{issue.createdBy?.name || '—'}</p>
                    </td>
                    <td><StatusPill status={issue.status} /></td>
                    <td className="text-end" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-outline-soft btn-sm" onClick={() => setDetail(issue)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="bi-box-arrow-up"
            title="No issues match those filters"
            message="Record an issue when food or supplies leave the store."
            action={
              canIssue ? (
                <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
                  <i className="bi bi-plus-lg" />
                  Record issue
                </button>
              ) : null
            }
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={10}
          onChange={setPage}
          noun="issue records"
        />
      </Panel>

      <IssueDrawer
        open={createOpen}
        onClose={closeCreate}
        products={products}
        onSaved={() => { load(); closeCreate(); }}
      />

      <IssueDetailDrawer
        issue={detail}
        onClose={() => setDetail(null)}
        canIssue={canIssue}
        onVoid={openVoid}
      />

      <ConfirmDialog
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        onConfirm={doVoid}
        busy={voidBusy}
        title="Void this issue?"
        message={
          voiding
            ? `${voiding.reference} will be marked voided and every item returned to the ${voiding.location} store. A reversing ledger entry is written for each line.`
            : ''
        }
        confirmLabel="Void and return stock"
        tone="danger"
      >
        <Field label="Reason for voiding" required>
          <textarea
            className="control"
            rows={3}
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            placeholder="e.g. Recorded against the wrong class"
            maxLength={300}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function IssueDrawer({ open, onClose, products, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    recipientName: '',
    recipientType: 'department',
    className: '',
    department: '',
    purpose: '',
    location: 'main',
    issueDate: toInputDate(),
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      recipientName: '',
      recipientType: 'department',
      className: '',
      department: '',
      purpose: '',
      location: 'main',
      issueDate: toInputDate(),
    });
    setLines([emptyLine()]);
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.recipientName.trim().length < 2) {
      setError('Enter who is receiving these items.');
      return;
    }
    const validLines = lines.filter((line) => line.product);
    if (!validLines.length) {
      setError('Add at least one product to issue.');
      return;
    }
    if (validLines.some((line) => !(Number(line.quantity) > 0))) {
      setError('Every line needs a quantity greater than zero.');
      return;
    }
    for (const line of validLines) {
      const product = products.find((item) => item._id === line.product);
      const available = form.location === 'branch' ? product?.branchQuantity || 0 : product?.quantity || 0;
      if (Number(line.quantity) > available) {
        setError(`Only ${formatNumber(available)} ${product?.unit || 'units'} of ${product?.name} available at this store.`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data } = await api.post('/issues', {
        recipientName: form.recipientName.trim(),
        recipientType: form.recipientType,
        className: form.className.trim(),
        department: form.department.trim(),
        purpose: form.purpose.trim(),
        location: form.location,
        issueDate: form.issueDate,
        items: validLines.map((line) => ({ product: line.product, quantity: Number(line.quantity) })),
      });
      toast.success('Issue recorded', data.message);
      onSaved?.(data.issue);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Record an issue"
      subtitle="Note who is receiving the items and where they are being taken from."
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="issue-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            Issue stock
          </button>
        </>
      }
    >
      <form id="issue-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Recipient</p>
          <div className="form-grid">
            <Field label="Who is receiving?" required>
              <input
                className="control"
                value={form.recipientName}
                onChange={(event) => setForm((current) => ({ ...current, recipientName: event.target.value }))}
                placeholder="e.g. Form 3 East, or Mrs. Wanjiku"
                maxLength={120}
              />
            </Field>
            <Field label="Recipient type" required>
              <select
                className="control"
                value={form.recipientType}
                onChange={(event) => setForm((current) => ({ ...current, recipientType: event.target.value }))}
              >
                {RECIPIENT_TYPES.map((type) => (
                  <option value={type.value} key={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class" hint="If the items are for a class.">
              <input
                className="control"
                value={form.className}
                onChange={(event) => setForm((current) => ({ ...current, className: event.target.value }))}
                placeholder="e.g. Form 3 East"
                maxLength={60}
              />
            </Field>
            <Field label="Department" hint="If the items are for a department.">
              <input
                className="control"
                value={form.department}
                onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))}
                placeholder="e.g. Catering, Science, Boarding"
                maxLength={80}
              />
            </Field>
          </div>
          <Field label="Purpose / note" hint="What are these items for?">
            <textarea
              className="control"
              rows={2}
              value={form.purpose}
              onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
              placeholder="e.g. Lunch preparation for the week"
              maxLength={300}
            />
          </Field>
        </div>

        <div className="form-section">
          <p className="form-section-title">Items and store</p>
          <div className="form-grid">
            <Field label="Issue from" required>
              <select
                className="control"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              >
                <option value="main">Main campus store</option>
                <option value="branch">Branch campus store</option>
              </select>
            </Field>
            <Field label="Issue date" required>
              <input
                type="date"
                className="control"
                value={form.issueDate}
                onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))}
                required
              />
            </Field>
          </div>
          <StockLineItems products={products} items={lines} setItems={setLines} location={form.location} />
        </div>

        <div className="soft-note amber">
          <i className="bi bi-exclamation-triangle" />
          <span>Issued stock leaves the store immediately. If you make a mistake, void the issue to return every line.</span>
        </div>
      </form>
    </Drawer>
  );
}

function IssueDetailDrawer({ issue, onClose, canIssue, onVoid }) {
  if (!issue) return null;
  const totalUnits = (issue.items || []).reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = (issue.items || []).reduce((sum, item) => sum + item.quantity * (item.unitCost || 0), 0);

  return (
    <Drawer
      open
      onClose={onClose}
      title={issue.reference}
      subtitle={`${issue.recipientName} · ${formatDate(issue.issueDate)}`}
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose}>
            Close
          </button>
          {canIssue && issue.status === 'issued' ? (
            <button type="button" className="btn btn-danger-soft" onClick={() => onVoid(issue)}>
              <i className="bi bi-arrow-counterclockwise" />
              Void issue
            </button>
          ) : null}
        </>
      }
    >
      <div className="hstack wrap" style={{ gap: 8, marginBottom: 18 }}>
        <StatusPill status={issue.status} />
        <span className="code-chip">
          <i className="bi bi-geo-alt" />
          {issue.location === 'branch' ? 'Branch store' : 'Main store'}
        </span>
        <span className="code-chip">
          <i className="bi bi-person" />
          {titleCase(issue.recipientType)}
        </span>
        {issue.className ? <span className="code-chip"><i className="bi bi-people" />{issue.className}</span> : null}
        {issue.department ? <span className="code-chip"><i className="bi bi-diagram-3" />{issue.department}</span> : null}
      </div>

      {issue.purpose ? (
        <div className="soft-note gray" style={{ marginBottom: 18 }}>
          <i className="bi bi-chat-left-text" />
          <span>{issue.purpose}</span>
        </div>
      ) : null}

      <div className="detail-section">
        <p className="detail-section-title">
          <i className="bi bi-basket" />
          Items issued
        </p>
        <div className="order-lines">
          {(issue.items || []).map((item, index) => (
            <div className="order-line" key={`${item.name}-${index}`}>
              <div className="ol-main">
                <strong>{item.name}</strong>
                <span>{item.sku || 'No SKU'} · {item.unit || 'unit'}</span>
              </div>
              <div className="ol-qty">
                <strong>
                  {formatNumber(item.quantity)} {item.unit}
                </strong>
                <span>{formatCurrency(item.unitCost)} each</span>
              </div>
              <div className="ol-qty text-end">
                <strong>{formatCurrency(item.quantity * (item.unitCost || 0))}</strong>
                <span>value</span>
              </div>
            </div>
          ))}
        </div>
        <div className="order-summary">
          <div className="kv-row">
            <span className="k">Total units</span>
            <span className="v">{formatNumber(totalUnits)}</span>
          </div>
          <div className="kv-row">
            <span className="k">Recorded by</span>
            <span className="v">{issue.createdBy?.name || '—'}</span>
          </div>
          {issue.voidedBy?.name ? (
            <div className="kv-row">
              <span className="k">Voided by</span>
              <span className="v">{issue.voidedBy.name}</span>
            </div>
          ) : null}
          <div className="line-total">
            <span>Estimated value</span>
            <strong>{formatCurrency(totalValue)}</strong>
          </div>
        </div>
      </div>

      {issue.status === 'voided' ? (
        <div className="inline-alert success" style={{ marginTop: 16 }}>
          <i className="bi bi-arrow-counterclockwise" />
          <div>
            <strong>This issue was voided.</strong>
            {issue.voidReason ? <p style={{ margin: '4px 0 0' }}>{issue.voidReason}</p> : null}
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
