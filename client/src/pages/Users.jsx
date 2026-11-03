import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import { api, ROLE_META, ROLES } from '../utils/constants.js';
import {
  formatDate,
  formatNumber,
  getErrorMessage,
  passwordLabel,
  passwordScore,
  timeAgo,
} from '../utils/format.js';
import {
  ActionMenu,
  Avatar,
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
  StatCard,
} from '../components/ui.jsx';

const STATUS_TABS = [
  { value: '', label: 'All accounts' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function Users() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/users', {
        params: { search: debouncedSearch.trim(), role, status, page, limit: 10 },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, role, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, status]);

  const users = data.items || [];
  const stats = data.stats || {};

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (account) => {
    setEditing(account);
    setDrawerOpen(true);
  };

  const deactivate = async () => {
    if (!deactivating) return;
    setBusy(true);
    try {
      const { data: response } = await api.delete(`/users/${deactivating._id}`);
      toast.success('Account deactivated', response.message);
      setDeactivating(null);
      load();
    } catch (requestError) {
      toast.error('Could not deactivate account', getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async (account) => {
    try {
      const { data: response } = await api.patch(`/users/${account._id}`, { status: 'active' });
      toast.success('Account reactivated', response.message);
      load();
    } catch (requestError) {
      toast.error('Could not reactivate account', getErrorMessage(requestError));
    }
  };

  const actions = (account) => [
    { label: 'Edit account', icon: 'bi-pencil-square', onClick: () => openEdit(account) },
    { label: 'Reset password', icon: 'bi-key', onClick: () => setResetting(account) },
    account.status === 'active' && account._id !== currentUser?._id && {
      separator: true,
    },
    account.status === 'active' && account._id !== currentUser?._id && {
      label: 'Deactivate',
      icon: 'bi-person-dash',
      danger: true,
      onClick: () => setDeactivating(account),
    },
    account.status !== 'active' && {
      label: 'Reactivate',
      icon: 'bi-person-check',
      onClick: () => reactivate(account),
    },
  ];

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Manage' }, { label: 'Team & roles' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-person-gear" />
            Access control
          </span>
          <h1 className="page-title">Team & roles</h1>
          <p className="page-sub">
            Manage who can access Mrskariza. Each role has a deliberately narrow set of permissions, and
            deactivation instantly revokes existing sessions.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-brand" onClick={openCreate}>
            <i className="bi bi-person-plus" />
            Add account
          </button>
        </div>
      </div>

      <div className="role-grid stagger">
        {ROLES.map((roleKey) => {
          const meta = ROLE_META[roleKey];
          return (
            <button
              type="button"
              key={roleKey}
              className="role-card"
              onClick={() => setRole(role === roleKey ? '' : roleKey)}
              style={{ textAlign: 'left', border: role === roleKey ? '1.5px solid var(--brand-400)' : undefined }}
            >
              <span className={`role-icon ${roleKey}`}>
                <i className={`bi ${meta.icon}`} />
              </span>
              <strong>{meta.label}</strong>
              <span>{meta.short}</span>
              <span className="n">{formatNumber(stats[roleKey] || 0)}</span>
            </button>
          );
        })}
      </div>

      <div className="stat-grid">
        <StatCard icon="bi-people" tone="brand" label="Total accounts" value={formatNumber(stats.total || 0)} meta={<>Across all four roles</>} />
        <StatCard icon="bi-person-check" tone="teal" label="Active accounts" value={formatNumber(stats.active || 0)} meta={<>Can sign in right now</>} />
        <StatCard icon="bi-shield-lock" tone="violet" label="Super Admins" value={formatNumber(stats.super_admin || 0)} meta={<>Full system access</>} />
        <StatCard icon="bi-person-dash" tone="amber" label="Inactive accounts" value={formatNumber(Math.max(0, (stats.total || 0) - (stats.active || 0)))} meta={<>Sessions revoked</>} />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone…" />
          <select className="control filter-select" value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((roleKey) => (
              <option value={roleKey} key={roleKey}>
                {ROLE_META[roleKey].label}
              </option>
            ))}
          </select>
          <div className="toolbar-spacer" />
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
        ) : loading && !users.length ? (
          <PageLoader label="Loading team accounts…" />
        ) : users.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((account) => {
                  const meta = ROLE_META[account.role] || ROLE_META.storekeeper;
                  return (
                    <tr key={account._id}>
                      <td>
                        <div className="table-media">
                          <Avatar name={account.name} src={account.avatarUrl} tone={meta.tone} />
                          <div>
                            <p className="cell-title">
                              {account.name}
                              {account._id === currentUser?._id ? (
                                <span className="pill tone-brand" style={{ marginLeft: 8, padding: '1px 6px', fontSize: 9.5 }}>You</span>
                              ) : null}
                            </p>
                            <p className="cell-sub">{account.email}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Pill tone={meta.tone} icon={meta.icon}>{meta.label}</Pill>
                      </td>
                      <td>{account.phone || '—'}</td>
                      <td>
                        <Pill tone={account.status === 'active' ? 'success' : 'neutral'} dot>
                          {account.status === 'active' ? 'Active' : 'Inactive'}
                        </Pill>
                      </td>
                      <td>
                        {account.lastLoginAt ? timeAgo(account.lastLoginAt) : 'Never'}
                        <p className="cell-sub">{account.lastLoginAt ? formatDate(account.lastLoginAt) : 'No sign-in yet'}</p>
                      </td>
                      <td>{formatDate(account.createdAt)}</td>
                      <td className="text-end"><ActionMenu items={actions(account)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="bi-people"
            title="No accounts found"
            message="Create an account for a colleague, or adjust the filters."
            action={
              <button type="button" className="btn btn-brand" onClick={openCreate}>
                <i className="bi bi-person-plus" />
                Add account
              </button>
            }
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={10}
          onChange={setPage}
          noun="accounts"
        />
      </Panel>

      <UserDrawer
        open={drawerOpen}
        account={editing}
        currentUserId={currentUser?._id}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={() => { load(); setDrawerOpen(false); setEditing(null); }}
      />

      <ResetPasswordDialog
        account={resetting}
        onClose={() => setResetting(null)}
        onSaved={() => { setResetting(null); load(); }}
      />

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => setDeactivating(null)}
        onConfirm={deactivate}
        busy={busy}
        title="Deactivate this account?"
        message={
          deactivating
            ? `${deactivating.name} will be signed out immediately and will not be able to sign in again until reactivated.`
            : ''
        }
        confirmLabel="Deactivate account"
        tone="warn"
      />
    </div>
  );
}

function UserDrawer({ open, account, currentUserId, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(account?._id);
  const isSelf = editing && account?._id === currentUserId;
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'storekeeper',
    phone: '',
    status: 'active',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm({
      name: account?.name || '',
      email: account?.email || '',
      password: '',
      confirmPassword: '',
      role: account?.role || 'storekeeper',
      phone: account?.phone || '',
      status: account?.status || 'active',
    });
  }, [open, account]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const score = passwordScore(form.password);
  const strength = passwordLabel(score);

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.name.trim().length < 2) {
      setError('Enter the person’s full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!editing) {
      if (form.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
        setError('Password must include at least one letter and one number.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('The two passwords do not match.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        role: form.role,
        status: form.status,
      };
      if (!editing) {
        payload.email = form.email.trim();
        payload.password = form.password;
      }
      const { data: response } = editing
        ? await api.patch(`/users/${account._id}`, payload)
        : await api.post('/users', payload);
      toast.success(editing ? 'Account updated' : 'Account created', response.message);
      onSaved?.(response.user);
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
      title={editing ? `Edit ${account.name}` : 'Create an account'}
      subtitle={editing ? 'Role or status changes sign the person out immediately.' : 'Give a colleague access with the right level of permission.'}
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="user-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            {editing ? 'Save account' : 'Create account'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Person</p>
          <div className="form-grid">
            <Field label="Full name" required>
              <input
                className="control"
                value={form.name}
                onChange={(event) => update({ name: event.target.value })}
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
          </div>
          <Field label="Email address" required hint={editing ? 'Email addresses cannot be changed after creation.' : 'Used to sign in.'}>
            <input
              type="email"
              className="control"
              value={form.email}
              onChange={(event) => update({ email: event.target.value })}
              placeholder="name@mrskariza.school"
              disabled={editing}
              required
            />
          </Field>
        </div>

        <div className="form-section">
          <p className="form-section-title">Role & access</p>
          <div className="form-grid">
            <Field label="Role" required hint={isSelf ? 'You cannot change your own role.' : undefined}>
              <select
                className="control"
                value={form.role}
                onChange={(event) => update({ role: event.target.value })}
                disabled={isSelf}
              >
                {ROLES.map((roleKey) => (
                  <option value={roleKey} key={roleKey}>
                    {ROLE_META[roleKey].label} — {ROLE_META[roleKey].short}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account status">
              <select
                className="control"
                value={form.status}
                onChange={(event) => update({ status: event.target.value })}
                disabled={isSelf}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          <div className="soft-note">
            <i className={`bi ${ROLE_META[form.role].icon}`} />
            <span>
              <strong>{ROLE_META[form.role].label}:</strong> {ROLE_META[form.role].description}
            </span>
          </div>
        </div>

        {!editing ? (
          <div className="form-section">
            <p className="form-section-title">Initial password</p>
            <div className="form-grid">
              <Field label="Password" required hint="At least 8 characters, with a letter and a number.">
                <input
                  type="password"
                  className="control"
                  value={form.password}
                  onChange={(event) => update({ password: event.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Confirm password" required>
                <input
                  type="password"
                  className="control"
                  value={form.confirmPassword}
                  onChange={(event) => update({ confirmPassword: event.target.value })}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            {form.password ? (
              <div className="hstack" style={{ gap: 10 }}>
                <div className="strength-meter">
                  {[1, 2, 3, 4].map((bar) => (
                    <span key={bar} className={bar <= strength.bars ? `on ${strength.className}` : ''} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{strength.label} password</span>
              </div>
            ) : null}
            <div className="soft-note amber">
              <i className="bi bi-shield-lock" />
              <span>Share the password securely. The person can change it from their profile after signing in.</span>
            </div>
          </div>
        ) : null}
      </form>
    </Drawer>
  );
}

function ResetPasswordDialog({ account, onClose, onSaved }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    setPassword('');
    setConfirm('');
    setError('');
  }, [account]);

  const score = passwordScore(password);
  const strength = passwordLabel(score);

  const submit = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password must include at least one letter and one number.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const { data: response } = await api.post(`/users/${account._id}/reset-password`, { password });
      toast.success('Password reset', response.message);
      onSaved?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmDialog
      open={Boolean(account)}
      onClose={onClose}
      onConfirm={submit}
      busy={saving}
      title={account ? `Reset password for ${account.name}` : 'Reset password'}
      message="This immediately revokes the person’s existing sessions. Share the new password securely."
      confirmLabel="Reset password"
      tone="warn"
    >
      {error ? <InlineAlert type="error">{error}</InlineAlert> : null}
      <Field label="New password" required>
        <input
          type="password"
          className="control"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password" required>
        <input
          type="password"
          className="control"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
        />
      </Field>
      {password ? (
        <div className="hstack" style={{ gap: 10 }}>
          <div className="strength-meter">
            {[1, 2, 3, 4].map((bar) => (
              <span key={bar} className={bar <= strength.bars ? `on ${strength.className}` : ''} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{strength.label}</span>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
