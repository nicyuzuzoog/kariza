import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useProducts from '../hooks/useProducts.js';
import { api, BRANCH_LABELS, can } from '../utils/constants.js';
import { formatDate, formatNumber, getErrorMessage, timeAgo } from '../utils/format.js';
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
  { value: '', label: 'All transfers' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyLine = () => ({ product: '', quantity: '1' });

export default function Transfers() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [detail, setDetail] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const canTransfer = can(user?.role, 'manageTransfers');
  const { products, reload: reloadProducts } = useProducts();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/transfers', {
        params: { search: debouncedSearch.trim(), status, page, limit: 10 },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

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

  const complete = async () => {
    if (!completing) return;
    setCompleteBusy(true);
    try {
      const { data: response } = await api.post(`/transfers/${completing._id}/complete`);
      toast.success('Transfer completed', response.message);
      setCompleting(null);
      setDetail(null);
      load();
      reloadProducts();
    } catch (requestError) {
      toast.error('Could not complete transfer', getErrorMessage(requestError));
    } finally {
      setCompleteBusy(false);
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const { data: response } = await api.post(`/transfers/${cancelling._id}/cancel`, {
        reason: cancelReason.trim(),
      });
      toast.success('Transfer cancelled', response.message);
      setCancelling(null);
      setDetail(null);
      load();
      reloadProducts();
    } catch (requestError) {
      toast.error('Could not cancel transfer', getErrorMessage(requestError));
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Transfers' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-arrow-left-right" />
            Branch replenishment
          </span>
          <h1 className="page-title">Stock transfers</h1>
          <p className="page-sub">
            Move stock between the main and branch campuses. Dispatching removes units from the source
            store; completing adds them to the destination. Cancelled dispatches return everything.
          </p>
        </div>
        {canTransfer ? (
          <div className="page-actions">
            <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
              <i className="bi bi-plus-lg" />
              New transfer
            </button>
          </div>
        ) : null}
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-truck"
          tone="brand"
          label="Transfers in transit"
          value={formatNumber(stats.inTransit || 0)}
          meta={<><strong>{formatNumber(stats.inTransitUnits || 0)}</strong> units on the road</>}
        />
        <StatCard
          icon="bi-check2-circle"
          tone="teal"
          label="Completed transfers"
          value={formatNumber(stats.completed || 0)}
          meta={<>Received by the destination store</>}
        />
        <StatCard
          icon="bi-arrow-counterclockwise"
          tone="amber"
          label="Cancelled transfers"
          value={formatNumber(stats.cancelled || 0)}
          meta={<>Stock returned to source</>}
        />
        <StatCard
          icon="bi-buildings"
          tone="violet"
          label="Stores connected"
          value="2"
          meta={<>Main campus and branch campus</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference, item or notes…"
          />
          <div className="toolbar-spacer" />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            <i className="bi bi-info-circle" /> {formatNumber(data.total || 0)} transfer records
          </span>
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <FilterTabs
            options={STATUS_TABS.map((tab) => ({
              ...tab,
              count: tab.value ? stats[tab.value] : data.total,
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
          <PageLoader label="Loading transfers…" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Route</th>
                  <th>Items</th>
                  <th>Dispatched</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((transfer) => (
                  <tr
                    key={transfer._id}
                    className="is-clickable"
                    onClick={() => setDetail(transfer)}
                    {...interactiveProps(() => setDetail(transfer), `Open ${transfer.reference}`)}
                  >
                    <td>
                      <p className="cell-title mono">{transfer.reference}</p>
                      <p className="cell-sub">By {transfer.createdBy?.name || 'System'}</p>
                    </td>
                    <td>
                      <span className="hstack" style={{ gap: 6 }}>
                        <span>{BRANCH_LABELS[transfer.from]}</span>
                        <i className="bi bi-arrow-right" style={{ color: 'var(--muted)' }} />
                        <span>{BRANCH_LABELS[transfer.to]}</span>
                      </span>
                    </td>
                    <td>
                      <p className="cell-title">{transfer.items?.length || 0} line{transfer.items?.length === 1 ? '' : 's'}</p>
                      <p className="cell-sub">
                        {formatNumber((transfer.items || []).reduce((sum, item) => sum + item.quantity, 0))} units
                      </p>
                    </td>
                    <td>
                      {formatDate(transfer.createdAt)}
                      <p className="cell-sub">{timeAgo(transfer.createdAt)}</p>
                    </td>
                    <td><StatusPill status={transfer.status} /></td>
                    <td className="text-end" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-outline-soft btn-sm" onClick={() => setDetail(transfer)}>
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
            icon="bi-arrow-left-right"
            title="No transfers found"
            message="Dispatch stock to the branch when it needs replenishing."
            action={
              canTransfer ? (
                <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
                  <i className="bi bi-plus-lg" />
                  New transfer
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
          noun="transfers"
        />
      </Panel>

      <TransferDrawer
        open={createOpen}
        onClose={closeCreate}
        products={products}
        onSaved={() => { load(); closeCreate(); reloadProducts(); }}
      />

      <TransferDetailDrawer
        transfer={detail}
        onClose={() => setDetail(null)}
        canTransfer={canTransfer}
        onComplete={(transfer) => setCompleting(transfer)}
        onCancel={(transfer) => { setCancelReason(''); setCancelling(transfer); }}
      />

      <ConfirmDialog
        open={Boolean(completing)}
        onClose={() => setCompleting(null)}
        onConfirm={complete}
        busy={completeBusy}
        title="Confirm branch receipt?"
        message={
          completing
            ? `${completing.reference} will be marked completed and every item added to the ${BRANCH_LABELS[completing.to]}. Only confirm once the branch has physically received the goods.`
            : ''
        }
        confirmLabel="Complete transfer"
        tone="warn"
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={cancel}
        busy={cancelBusy}
        title="Cancel this transfer?"
        message={
          cancelling
            ? `${cancelling.reference} will be cancelled and all units returned to the ${BRANCH_LABELS[cancelling.from]}.`
            : ''
        }
        confirmLabel="Cancel and return stock"
        tone="danger"
      >
        <Field label="Reason" hint="Optional, but useful for the audit trail.">
          <textarea
            className="control"
            rows={3}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="e.g. Branch van unavailable"
            maxLength={300}
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}

function TransferDrawer({ open, onClose, products, onSaved }) {
  const toast = useToast();
  const [from, setFrom] = useState('main');
  const [to, setTo] = useState('branch');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFrom('main');
    setTo('branch');
    setNotes('');
    setLines([emptyLine()]);
    setError('');
  }, [open]);

  const changeFrom = (next) => {
    setFrom(next);
    setTo(next === 'main' ? 'branch' : 'main');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    const validLines = lines.filter((line) => line.product);
    if (!validLines.length) {
      setError('Add at least one product to transfer.');
      return;
    }
    if (validLines.some((line) => !(Number(line.quantity) > 0))) {
      setError('Every line needs a quantity greater than zero.');
      return;
    }
    for (const line of validLines) {
      const product = products.find((item) => item._id === line.product);
      const available = from === 'branch' ? product?.branchQuantity || 0 : product?.quantity || 0;
      if (Number(line.quantity) > available) {
        setError(`Only ${formatNumber(available)} ${product?.unit || 'units'} of ${product?.name} available at the source store.`);
        return;
      }
    }

    setSaving(true);
    try {
      const { data } = await api.post('/transfers', {
        from,
        to,
        notes: notes.trim(),
        items: validLines.map((line) => ({ product: line.product, quantity: Number(line.quantity) })),
      });
      toast.success('Transfer dispatched', data.message);
      onSaved?.(data.transfer);
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
      title="Dispatch a transfer"
      subtitle="Stock leaves the source store now and reaches the destination when the transfer is completed."
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="transfer-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-truck" />}
            Dispatch transfer
          </button>
        </>
      }
    >
      <form id="transfer-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="route-visual">
          <div className="route-node">
            <i className="bi bi-building" />
            <span>{BRANCH_LABELS[from]}</span>
          </div>
          <i className="bi bi-arrow-right route-arrow" />
          <div className="route-node to">
            <i className="bi bi-buildings" />
            <span>{BRANCH_LABELS[to]}</span>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title">Route</p>
          <div className="form-grid">
            <Field label="From store" required>
              <select className="control" value={from} onChange={(event) => changeFrom(event.target.value)}>
                <option value="main">Main campus store</option>
                <option value="branch">Branch campus store</option>
              </select>
            </Field>
            <Field label="To store" required>
              <select className="control" value={to} onChange={(event) => setTo(event.target.value)}>
                <option value="main">Main campus store</option>
                <option value="branch">Branch campus store</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title">Items to move</p>
          <StockLineItems products={products} items={lines} setItems={setLines} location={from} />
        </div>

        <Field label="Notes" hint="Anything the receiving store should know.">
          <textarea
            className="control"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. Weekly branch replenishment for the boarding house"
            maxLength={500}
          />
        </Field>

        <div className="soft-note">
          <i className="bi bi-info-circle" />
          <span>
            Dispatching immediately reduces the source store balance. The destination is only credited when
            someone marks the transfer completed after physical receipt.
          </span>
        </div>
      </form>
    </Drawer>
  );
}

function TransferDetailDrawer({ transfer, onClose, canTransfer, onComplete, onCancel }) {
  if (!transfer) return null;
  const totalUnits = (transfer.items || []).reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Drawer
      open
      onClose={onClose}
      title={transfer.reference}
      subtitle={`${BRANCH_LABELS[transfer.from]} → ${BRANCH_LABELS[transfer.to]}`}
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose}>
            Close
          </button>
          {canTransfer && transfer.status === 'in_transit' ? (
            <>
              <button type="button" className="btn btn-danger-soft" onClick={() => onCancel(transfer)}>
                <i className="bi bi-arrow-counterclockwise" />
                Cancel transfer
              </button>
              <button type="button" className="btn btn-brand" onClick={() => onComplete(transfer)}>
                <i className="bi bi-check2-circle" />
                Complete transfer
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className="hstack wrap" style={{ gap: 8, marginBottom: 18 }}>
        <StatusPill status={transfer.status} />
        <span className="code-chip">
          <i className="bi bi-box" />
          {transfer.items?.length || 0} lines · {formatNumber(totalUnits)} units
        </span>
        <span className="code-chip">
          <i className="bi bi-clock" />
          {timeAgo(transfer.createdAt)}
        </span>
      </div>

      <div className="route-visual" style={{ marginBottom: 18 }}>
        <div className="route-node">
          <i className="bi bi-building" />
          <span>{BRANCH_LABELS[transfer.from]}</span>
        </div>
        <i className="bi bi-arrow-right route-arrow" />
        <div className="route-node to">
          <i className="bi bi-buildings" />
          <span>{BRANCH_LABELS[transfer.to]}</span>
        </div>
      </div>

      <div className="detail-section">
        <p className="detail-section-title">
          <i className="bi bi-basket" />
          Items in this transfer
        </p>
        <div className="order-lines">
          {(transfer.items || []).map((item, index) => (
            <div className="order-line" key={`${item.name}-${index}`}>
              <div className="ol-main">
                <strong>{item.name}</strong>
                <span>{item.sku || 'No SKU'} · {item.unit || 'unit'}</span>
              </div>
              <div className="ol-qty">
                <strong>
                  {formatNumber(item.quantity)} {item.unit}
                </strong>
                <span>in transit</span>
              </div>
            </div>
          ))}
        </div>
        <div className="order-summary">
          <div className="kv-row">
            <span className="k">Dispatched by</span>
            <span className="v">{transfer.createdBy?.name || '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Dispatched at</span>
            <span className="v">{formatDate(transfer.createdAt)}</span>
          </div>
          {transfer.completedAt ? (
            <div className="kv-row">
              <span className="k">Completed by</span>
              <span className="v">
                {transfer.completedBy?.name || '—'} · {formatDate(transfer.completedAt)}
              </span>
            </div>
          ) : null}
          {transfer.cancelledAt ? (
            <div className="kv-row">
              <span className="k">Cancelled by</span>
              <span className="v">
                {transfer.cancelledBy?.name || '—'} · {formatDate(transfer.cancelledAt)}
              </span>
            </div>
          ) : null}
          <div className="line-total">
            <span>Total units</span>
            <strong>{formatNumber(totalUnits)}</strong>
          </div>
        </div>
      </div>

      {transfer.notes ? (
        <div className="soft-note gray" style={{ marginTop: 16 }}>
          <i className="bi bi-journal-text" />
          <span>{transfer.notes}</span>
        </div>
      ) : null}

      {transfer.cancelReason ? (
        <div className="inline-alert error" style={{ marginTop: 16 }}>
          <i className="bi bi-x-octagon" />
          <div>
            <strong>Transfer cancelled.</strong>
            <p style={{ margin: '4px 0 0' }}>{transfer.cancelReason}</p>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
