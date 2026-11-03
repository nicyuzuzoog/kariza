import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useProducts from '../hooks/useProducts.js';
import { api, can } from '../utils/constants.js';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  getErrorMessage,
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
  Segmented,
  StatCard,
  StatusPill,
  interactiveProps,
} from '../components/ui.jsx';
import { PurchaseLineItems } from '../components/TransactionLines.jsx';

const STATUS_TABS = [
  { value: '', label: 'All orders' },
  { value: 'ordered', label: 'Awaiting delivery' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const emptyLine = () => ({ product: '', quantity: '1', unitCost: '' });

export default function Purchases() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(searchParams.get('new') === '1');
  const [detail, setDetail] = useState(null);
  const [receiving, setReceiving] = useState(null);
  const [receiveLocation, setReceiveLocation] = useState('main');
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [paying, setPaying] = useState(null);
  const [updatingPay, setUpdatingPay] = useState(false);

  const canManage = can(user?.role, 'managePurchases');
  const { products } = useProducts();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/purchases', {
        params: { search: debouncedSearch.trim(), status, paymentStatus, page, limit: 10 },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, paymentStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, paymentStatus]);

  const stats = data.stats || {};
  const items = data.items || [];

  const closeCreate = () => {
    setCreateOpen(false);
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const receive = async () => {
    if (!receiving) return;
    setReceiveBusy(true);
    try {
      const { data: response } = await api.post(`/purchases/${receiving._id}/receive`, {
        location: receiveLocation,
      });
      toast.success('Purchase received', response.message);
      setReceiving(null);
      setDetail(null);
      load();
    } catch (requestError) {
      toast.error('Could not receive purchase', getErrorMessage(requestError));
    } finally {
      setReceiveBusy(false);
    }
  };

  const cancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const { data: response } = await api.post(`/purchases/${cancelling._id}/cancel`);
      toast.success('Purchase cancelled', response.message);
      setCancelling(null);
      setDetail(null);
      load();
    } catch (requestError) {
      toast.error('Could not cancel purchase', getErrorMessage(requestError));
    } finally {
      setCancelBusy(false);
    }
  };

  const updatePayment = async (nextStatus) => {
    if (!paying) return;
    setUpdatingPay(true);
    try {
      await api.patch(`/purchases/${paying._id}`, { paymentStatus: nextStatus });
      toast.success('Payment updated', `Marked as ${nextStatus}.`);
      setPaying(null);
      if (detail?._id === paying._id) {
        setDetail({ ...detail, paymentStatus: nextStatus });
      }
      load();
    } catch (requestError) {
      toast.error('Could not update payment', getErrorMessage(requestError));
    } finally {
      setUpdatingPay(false);
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Purchases' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-truck" />
            Procurement
          </span>
          <h1 className="page-title">Purchases & deliveries</h1>
          <p className="page-sub">
            Record what the school buys, track supplier invoices and receive goods into either store.
            Receiving a purchase updates stock and writes a ledger entry automatically.
          </p>
        </div>
        {canManage ? (
          <div className="page-actions">
            <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
              <i className="bi bi-plus-lg" />
              New purchase
            </button>
          </div>
        ) : null}
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-wallet2"
          tone="brand"
          label="Total procurement"
          value={formatCurrency(stats.totalSpend || 0)}
          meta={<><strong>{formatNumber(stats.orders || 0)}</strong> active orders</>}
        />
        <StatCard
          icon="bi-calendar3"
          tone="teal"
          label="Spend this month"
          value={formatCurrency(stats.monthSpend || 0)}
          meta={<>Rolling from the 1st of the month</>}
        />
        <StatCard
          icon="bi-hourglass-split"
          tone="amber"
          label="Awaiting delivery"
          value={formatNumber(stats.pending || 0)}
          meta={<>Orders still marked “ordered”</>}
        />
        <StatCard
          icon="bi-exclamation-circle"
          tone="violet"
          label="Outstanding payment"
          value={formatCurrency(stats.outstanding || 0)}
          meta={<>Unpaid or part-paid invoices</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference, invoice, supplier or notes…"
          />
          <select
            className="control filter-select"
            value={paymentStatus}
            onChange={(event) => setPaymentStatus(event.target.value)}
          >
            <option value="">Any payment status</option>
            <option value="paid">Paid</option>
            <option value="partial">Part paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <div className="toolbar-spacer" />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            <i className="bi bi-info-circle" /> {formatNumber(data.total || 0)} matching orders
          </span>
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <FilterTabs
            options={STATUS_TABS.map((tab) => ({
              ...tab,
              count: tab.value ? stats[tab.value] : stats.orders,
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
          <PageLoader label="Loading purchase orders…" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th className="text-end">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((purchase) => (
                  <tr
                    key={purchase._id}
                    className="is-clickable"
                    onClick={() => setDetail(purchase)}
                    {...interactiveProps(() => setDetail(purchase), `Open ${purchase.reference}`)}
                  >
                    <td>
                      <p className="cell-title mono">{purchase.reference}</p>
                      <p className="cell-sub">{purchase.invoiceNo ? `Invoice ${purchase.invoiceNo}` : 'No invoice number'}</p>
                    </td>
                    <td>
                      <p className="cell-title">{purchase.supplier?.name || purchase.supplierName}</p>
                      <p className="cell-sub">By {purchase.createdBy?.name || 'System'}</p>
                    </td>
                    <td>{formatDate(purchase.purchaseDate)}</td>
                    <td className="num">{purchase.items?.length || 0}</td>
                    <td><StatusPill status={purchase.paymentStatus} /></td>
                    <td><StatusPill status={purchase.status} /></td>
                    <td className="text-end num cell-strong">{formatCurrency(purchase.totalAmount)}</td>
                    <td className="text-end" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="btn btn-outline-soft btn-sm" onClick={() => setDetail(purchase)}>
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
            icon="bi-truck"
            title="No purchases found"
            message="Record a supplier order to begin tracking procurement and deliveries."
            action={
              canManage ? (
                <button type="button" className="btn btn-brand" onClick={() => setCreateOpen(true)}>
                  <i className="bi bi-plus-lg" />
                  New purchase
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
          noun="purchase orders"
        />
      </Panel>

      <PurchaseDrawer
        open={createOpen}
        onClose={closeCreate}
        products={products}
        onSaved={() => { load(); closeCreate(); }}
      />

      <PurchaseDetailDrawer
        purchase={detail}
        onClose={() => setDetail(null)}
        canManage={canManage}
        onReceive={(purchase) => { setReceiving(purchase); setReceiveLocation('main'); }}
        onCancel={(purchase) => setCancelling(purchase)}
        onChangePayment={(purchase) => setPaying(purchase)}
      />

      <ConfirmDialog
        open={Boolean(receiving)}
        onClose={() => setReceiving(null)}
        onConfirm={receive}
        busy={receiveBusy}
        title="Receive this purchase?"
        confirmLabel="Receive into stock"
        tone="warn"
        message={
          receiving
            ? `${receiving.reference} will be marked received and every line added to stock. This also creates purchase ledger entries.`
            : ''
        }
      >
        <Field label="Receive into which store?" required>
          <Segmented
            value={receiveLocation}
            onChange={setReceiveLocation}
            options={[
              { value: 'main', label: 'Main campus', icon: 'bi-building' },
              { value: 'branch', label: 'Branch campus', icon: 'bi-buildings' },
            ]}
          />
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={cancel}
        busy={cancelBusy}
        title="Cancel this purchase?"
        confirmLabel="Cancel purchase"
        tone="danger"
        message={
          cancelling
            ? `${cancelling.reference} will be marked cancelled. If stock was already received it cannot be cancelled.`
            : ''
        }
      />

      <PaymentDialog
        purchase={paying}
        busy={updatingPay}
        onClose={() => setPaying(null)}
        onConfirm={updatePayment}
      />
    </div>
  );
}

function PurchaseDrawer({ open, onClose, products, onSaved }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    supplier: '',
    invoiceNo: '',
    purchaseDate: toInputDate(),
    paymentStatus: 'unpaid',
    notes: '',
  });
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      supplier: '',
      invoiceNo: '',
      purchaseDate: toInputDate(),
      paymentStatus: 'unpaid',
      notes: '',
    });
    setLines([emptyLine()]);
    api
      .get('/suppliers', { params: { status: 'active', limit: 100 } })
      .then(({ data }) => setSuppliers(data.items || []))
      .catch(() => setSuppliers([]));
  }, [open]);

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0),
    [lines]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.supplier) {
      setError('Choose the supplier for this purchase.');
      return;
    }
    const validLines = lines.filter((line) => line.product);
    if (!validLines.length) {
      setError('Add at least one product line.');
      return;
    }
    if (validLines.some((line) => !(Number(line.quantity) > 0))) {
      setError('Every line needs a quantity greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.post('/purchases', {
        supplier: form.supplier,
        invoiceNo: form.invoiceNo.trim(),
        purchaseDate: form.purchaseDate,
        paymentStatus: form.paymentStatus,
        notes: form.notes.trim(),
        items: validLines.map((line) => ({
          product: line.product,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost) || 0,
        })),
      });
      toast.success('Purchase recorded', data.message);
      onSaved?.(data.purchase);
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
      title="Record a purchase"
      subtitle="Create a purchase order now and receive it into stock when the goods arrive."
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="purchase-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            Save purchase
          </button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Order details</p>
          <div className="form-grid">
            <Field label="Supplier" required>
              <select
                className="control"
                value={form.supplier}
                onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))}
                required
              >
                <option value="">Select a supplier…</option>
                {suppliers.map((supplier) => (
                  <option value={supplier._id} key={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice number" hint="Optional supplier invoice reference.">
              <input
                className="control"
                value={form.invoiceNo}
                onChange={(event) => setForm((current) => ({ ...current, invoiceNo: event.target.value }))}
                placeholder="e.g. INV-2026-014"
                maxLength={60}
              />
            </Field>
            <Field label="Purchase date" required>
              <input
                type="date"
                className="control"
                value={form.purchaseDate}
                onChange={(event) => setForm((current) => ({ ...current, purchaseDate: event.target.value }))}
                required
              />
            </Field>
            <Field label="Payment status">
              <select
                className="control"
                value={form.paymentStatus}
                onChange={(event) => setForm((current) => ({ ...current, paymentStatus: event.target.value }))}
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Part paid</option>
                <option value="paid">Paid</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title">Items on this order</p>
          <PurchaseLineItems products={products} items={lines} setItems={setLines} />
        </div>

        <div className="form-section">
          <p className="form-section-title">Notes</p>
          <Field label="Delivery notes" hint="Anything the storekeeper should know when goods arrive.">
            <textarea
              className="control"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="e.g. Deliver to the main store before 10am"
              maxLength={500}
            />
          </Field>
          <div className="soft-note">
            <i className="bi bi-info-circle" />
            <span>
              Stock is not changed yet. The order stays “ordered” until you receive it, which updates
              balances and the ledger. Estimated total: <strong>{formatCurrency(total)}</strong>.
            </span>
          </div>
        </div>
      </form>
    </Drawer>
  );
}

function PurchaseDetailDrawer({ purchase, onClose, canManage, onReceive, onCancel, onChangePayment }) {
  if (!purchase) return null;
  const canReceive = purchase.status === 'ordered';
  const canCancel = purchase.status === 'ordered';

  return (
    <Drawer
      open
      onClose={onClose}
      title={purchase.reference}
      subtitle={`${purchase.supplier?.name || purchase.supplierName} · ${formatDate(purchase.purchaseDate)}`}
      wide
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose}>
            Close
          </button>
          {canManage && purchase.status !== 'cancelled' ? (
            <button type="button" className="btn btn-ghost" onClick={() => onChangePayment(purchase)}>
              <i className="bi bi-cash-coin" />
              Update payment
            </button>
          ) : null}
          {canManage && canCancel ? (
            <button type="button" className="btn btn-danger-soft" onClick={() => onCancel(purchase)}>
              <i className="bi bi-slash-circle" />
              Cancel order
            </button>
          ) : null}
          {canManage && canReceive ? (
            <button type="button" className="btn btn-brand" onClick={() => onReceive(purchase)}>
              <i className="bi bi-box-arrow-in-down" />
              Receive stock
            </button>
          ) : null}
        </>
      }
    >
      <div className="hstack wrap" style={{ gap: 8, marginBottom: 18 }}>
        <StatusPill status={purchase.status} />
        <StatusPill status={purchase.paymentStatus} />
        {purchase.invoiceNo ? <span className="code-chip"><i className="bi bi-receipt" />{purchase.invoiceNo}</span> : null}
      </div>

      <div className="detail-section">
        <p className="detail-section-title">
          <i className="bi bi-basket" />
          Items ordered
        </p>
        <div className="order-lines">
          {(purchase.items || []).map((item, index) => (
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
                <strong>{formatCurrency(item.lineTotal)}</strong>
                <span>line total</span>
              </div>
            </div>
          ))}
        </div>
        <div className="order-summary">
          <div className="kv-row">
            <span className="k">Items</span>
            <span className="v">{purchase.items?.length || 0} lines</span>
          </div>
          <div className="kv-row">
            <span className="k">Ordered by</span>
            <span className="v">{purchase.createdBy?.name || '—'}</span>
          </div>
          {purchase.receivedBy?.name ? (
            <div className="kv-row">
              <span className="k">Received by</span>
              <span className="v">{purchase.receivedBy.name}</span>
            </div>
          ) : null}
          <div className="line-total">
            <span>Order total</span>
            <strong>{formatCurrency(purchase.totalAmount)}</strong>
          </div>
        </div>
      </div>

      {purchase.notes ? (
        <div className="detail-section">
          <p className="detail-section-title">
            <i className="bi bi-journal-text" />
            Notes
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7, margin: 0 }}>{purchase.notes}</p>
        </div>
      ) : null}
    </Drawer>
  );
}

function PaymentDialog({ purchase, busy, onClose, onConfirm }) {
  const [status, setStatus] = useState('paid');
  useEffect(() => {
    if (purchase) setStatus(purchase.paymentStatus === 'paid' ? 'unpaid' : 'paid');
  }, [purchase]);

  return (
    <ConfirmDialog
      open={Boolean(purchase)}
      onClose={onClose}
      onConfirm={() => onConfirm(status)}
      busy={busy}
      title="Update payment status"
      message={purchase ? `${purchase.reference} · ${formatCurrency(purchase.totalAmount)} currently ${purchase.paymentStatus}.` : ''}
      confirmLabel="Save payment status"
      tone="warn"
    >
      <Field label="New payment status" required>
        <select className="control" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Part paid</option>
          <option value="paid">Paid</option>
        </select>
      </Field>
    </ConfirmDialog>
  );
}
