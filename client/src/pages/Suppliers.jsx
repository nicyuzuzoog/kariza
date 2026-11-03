import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { api, can, PRODUCT_CATEGORIES } from '../utils/constants.js';
import { formatCurrency, formatNumber, getErrorMessage, initials, titleCase } from '../utils/format.js';
import {
  ActionMenu,
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
  Pill,
  SearchInput,
} from '../components/ui.jsx';

const STATUS_TABS = [
  { value: '', label: 'All suppliers' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const EMPTY_FORM = {
  name: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  category: 'General',
  notes: '',
  status: 'active',
};

export default function Suppliers() {
  const { user } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [deactivateBusy, setDeactivateBusy] = useState(false);

  const canManage = can(user?.role, 'manageSuppliers');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/suppliers', {
        params: { search: debouncedSearch.trim(), status, page, limit: 9 },
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
  const activeCount = items.filter((item) => item.status === 'active').length;

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (supplier) => {
    setEditing(supplier);
    setDrawerOpen(true);
  };

  const deactivate = async () => {
    if (!deactivating) return;
    setDeactivateBusy(true);
    try {
      const { data: response } = await api.delete(`/suppliers/${deactivating._id}`);
      toast.success('Supplier deactivated', response.message);
      setDeactivating(null);
      load();
    } catch (requestError) {
      toast.error('Could not deactivate supplier', getErrorMessage(requestError));
    } finally {
      setDeactivateBusy(false);
    }
  };

  const actions = (supplier) => [
    canManage && { label: 'Edit supplier', icon: 'bi-pencil-square', onClick: () => openEdit(supplier) },
    supplier.status === 'active' && {
      label: 'Deactivate',
      icon: 'bi-person-dash',
      danger: true,
      onClick: () => setDeactivating(supplier),
    },
  ];

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Manage' }, { label: 'Suppliers' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-people" />
            Procurement partners
          </span>
          <h1 className="page-title">Suppliers directory</h1>
          <p className="page-sub">
            Keep supplier contacts and notes in one place. Linking products and purchases to a supplier
            makes spending and delivery history easy to review.
          </p>
        </div>
        {canManage ? (
          <div className="page-actions">
            <button type="button" className="btn btn-brand" onClick={openCreate}>
              <i className="bi bi-plus-lg" />
              Add supplier
            </button>
          </div>
        ) : null}
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, contact, phone or email…"
          />
          <div className="toolbar-spacer" />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            <i className="bi bi-check2-circle" /> {activeCount} active on this page
          </span>
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <FilterTabs options={STATUS_TABS} value={status} onChange={setStatus} />
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
          <PageLoader label="Loading suppliers…" />
        ) : items.length ? (
          <div className="supplier-grid">
            {items.map((supplier) => (
              <article className="supplier-card" key={supplier._id}>
                <div className="supplier-top">
                  <span className="supplier-avatar">{initials(supplier.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <h3>{supplier.name}</h3>
                    <span className="cat">{supplier.category}</span>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    {canManage ? <ActionMenu items={actions(supplier)} /> : null}
                  </div>
                </div>

                <div className="supplier-contact">
                  <span>
                    <i className="bi bi-person" />
                    <span className="truncate">{supplier.contactName || 'No contact person'}</span>
                  </span>
                  <span>
                    <i className="bi bi-telephone" />
                    <span className="truncate">{supplier.phone || 'No phone number'}</span>
                  </span>
                  <span>
                    <i className="bi bi-envelope" />
                    <span className="truncate">{supplier.email || 'No email address'}</span>
                  </span>
                  <span>
                    <i className="bi bi-geo-alt" />
                    <span className="truncate">{supplier.address || 'No address on file'}</span>
                  </span>
                </div>

                <div className="supplier-stats">
                  <div>
                    Products
                    <strong>{formatNumber(supplier.productCount || 0)}</strong>
                  </div>
                  <div>
                    Orders
                    <strong>{formatNumber(supplier.purchaseOrders || 0)}</strong>
                  </div>
                  <div>
                    Spend
                    <strong>{formatCurrency(supplier.purchaseValue || 0)}</strong>
                  </div>
                </div>

                <div className="supplier-foot">
                  <Pill tone={supplier.status === 'active' ? 'success' : 'neutral'} dot>
                    {titleCase(supplier.status)}
                  </Pill>
                  {supplier.notes ? <span className="truncate" style={{ fontSize: 11, color: 'var(--muted)' }}>{supplier.notes}</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="bi-people"
            title="No suppliers yet"
            message="Add the businesses and vendors that supply food, stationery and equipment."
            action={
              canManage ? (
                <button type="button" className="btn btn-brand" onClick={openCreate}>
                  <i className="bi bi-plus-lg" />
                  Add supplier
                </button>
              ) : null
            }
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={9}
          onChange={setPage}
          noun="suppliers"
        />
      </Panel>

      <SupplierDrawer
        open={drawerOpen}
        supplier={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={() => { load(); setDrawerOpen(false); setEditing(null); }}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
        busy={deactivateBusy}
        title="Deactivate this supplier?"
        message={
          deactivating
            ? `${deactivating.name} will be marked inactive and hidden from new purchase forms. Existing products and purchase history stay intact.`
            : ''
        }
        confirmLabel="Deactivate supplier"
        tone="warn"
      />
    </div>
  );
}

function SupplierDrawer({ open, supplier, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(supplier?._id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      editing
        ? {
            name: supplier.name || '',
            contactName: supplier.contactName || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            address: supplier.address || '',
            category: supplier.category || 'General',
            notes: supplier.notes || '',
            status: supplier.status || 'active',
          }
        : EMPTY_FORM
    );
  }, [open, editing, supplier]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.name.trim().length < 2) {
      setError('Supplier name is required.');
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid email address or leave it blank.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        category: form.category,
        notes: form.notes.trim(),
        status: form.status,
      };
      const { data: response } = editing
        ? await api.patch(`/suppliers/${supplier._id}`, payload)
        : await api.post('/suppliers', payload);
      toast.success(editing ? 'Supplier updated' : 'Supplier added', response.message);
      onSaved?.(response.supplier);
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
      title={editing ? `Edit ${supplier.name}` : 'Add a supplier'}
      subtitle="Contact details and category help the team know who to call."
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="supplier-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            {editing ? 'Save changes' : 'Add supplier'}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Business details</p>
          <div className="form-grid">
            <Field label="Supplier name" required>
              <input
                className="control"
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
                placeholder="e.g. Kilimani Foods Ltd"
                maxLength={120}
              />
            </Field>
            <Field label="Category">
              <select className="control" value={form.category} onChange={(event) => update({ category: event.target.value })}>
                <option value="General">General</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contact person">
              <input
                className="control"
                value={form.contactName}
                onChange={(event) => update({ contactName: event.target.value })}
                placeholder="e.g. Grace Mwangi"
                maxLength={80}
              />
            </Field>
            <Field label="Phone number">
              <input
                className="control"
                value={form.phone}
                onChange={(event) => update({ phone: event.target.value })}
                placeholder="+254 7xx xxx xxx"
                maxLength={30}
              />
            </Field>
            <Field label="Email address">
              <input
                type="email"
                className="control"
                value={form.email}
                onChange={(event) => update({ email: event.target.value })}
                placeholder="orders@supplier.co.ke"
                maxLength={120}
              />
            </Field>
            <Field label="Status">
              <select className="control" value={form.status} onChange={(event) => update({ status: event.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <Field label="Address">
            <input
              className="control"
              value={form.address}
              onChange={(event) => update({ address: event.target.value })}
              placeholder="e.g. Industrial Area, Nairobi"
              maxLength={200}
            />
          </Field>
          <Field label="Notes" hint="Delivery days, payment terms or other useful details.">
            <textarea
              className="control"
              rows={3}
              value={form.notes}
              onChange={(event) => update({ notes: event.target.value })}
              placeholder="e.g. Delivers every Tuesday morning"
              maxLength={500}
            />
          </Field>
        </div>
      </form>
    </Drawer>
  );
}
