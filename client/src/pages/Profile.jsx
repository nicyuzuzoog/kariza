import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { api, ROLE_META } from '../utils/constants.js';
import {
  formatDate,
  formatDateTime,
  getErrorMessage,
  passwordLabel,
  passwordScore,
} from '../utils/format.js';
import {
  Avatar,
  CrumbBar,
  Field,
  InlineAlert,
  Panel,
  Pill,
} from '../components/ui.jsx';

export default function Profile() {
  const { user, applyUser, updateSession } = useAuth();
  const toast = useToast();
  const role = ROLE_META[user?.role] || ROLE_META.accountant;

  const [profile, setProfile] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    avatarUrl: user?.avatarUrl || '',
  });
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const score = passwordScore(passwords.newPassword);
  const strength = passwordLabel(score);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError('');
    if (profile.name.trim().length < 2) {
      setProfileError('Your name must be at least 2 characters.');
      return;
    }
    if (profile.avatarUrl && !/^https?:\/\/.+/i.test(profile.avatarUrl.trim())) {
      setProfileError('Enter a valid http(s) image URL, or leave it empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await api.patch('/auth/profile', {
        name: profile.name.trim(),
        phone: profile.phone.trim(),
        avatarUrl: profile.avatarUrl.trim(),
      });
      applyUser(data.user);
      toast.success('Profile updated', data.message);
    } catch (requestError) {
      setProfileError(getErrorMessage(requestError));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');

    if (!passwords.currentPassword) {
      setPasswordError('Enter your current password.');
      return;
    }
    if (passwords.newPassword.length < 8) {
      setPasswordError('Your new password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(passwords.newPassword) || !/[0-9]/.test(passwords.newPassword)) {
      setPasswordError('Your new password must include at least one letter and one number.');
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError('The two new passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      updateSession(data.token, data.user);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password changed', 'Use your new password the next time you sign in.');
    } catch (requestError) {
      setPasswordError(getErrorMessage(requestError));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Manage' }, { label: 'My profile' }]} />

      <section className="profile-header">
        <Avatar name={user?.name} src={user?.avatarUrl} size="xl" tone={role.tone} />
        <div className="who">
          <span className="eyebrow">
            <i className="bi bi-person-circle" />
            Your account
          </span>
          <h1>{user?.name}</h1>
          <p>{user?.email}</p>
          <div className="profile-badges">
            <Pill tone={role.tone} icon={role.icon}>{role.label}</Pill>
            <Pill tone={user?.status === 'active' ? 'success' : 'neutral'} dot>
              {user?.status === 'active' ? 'Active account' : 'Inactive'}
            </Pill>
            <Pill tone="neutral" icon="bi-clock">
              Last sign in {user?.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'just now'}
            </Pill>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <Panel title="Profile details" icon="bi-person-vcard" sub="How your name appears across the system">
          <form onSubmit={saveProfile}>
            {profileError ? <InlineAlert type="error">{profileError}</InlineAlert> : null}
            <Field label="Full name" required>
              <input
                className="control"
                value={profile.name}
                onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))}
                maxLength={80}
              />
            </Field>
            <Field label="Email address" hint="Email sign-in is managed by the Super Admin.">
              <input className="control" value={user?.email || ''} disabled />
            </Field>
            <Field label="Phone number">
              <input
                className="control"
                value={profile.phone}
                onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+254 7xx xxx xxx"
                maxLength={30}
              />
            </Field>
            <Field label="Avatar image URL" hint="Optional. Use a square image for best results.">
              <input
                className="control"
                value={profile.avatarUrl}
                onChange={(event) => setProfile((current) => ({ ...current, avatarUrl: event.target.value }))}
                placeholder="https://…"
              />
            </Field>
            <button type="submit" className="btn btn-brand" disabled={savingProfile}>
              {savingProfile ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
              Save profile
            </button>
          </form>
        </Panel>

        <Panel title="Change password" icon="bi-key" sub="Passwords are hashed and never stored in plain text">
          <form onSubmit={savePassword}>
            {passwordError ? <InlineAlert type="error">{passwordError}</InlineAlert> : null}
            <Field label="Current password" required>
              <div className="input-affix">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="control"
                  value={passwords.currentPassword}
                  onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="affix"
                  onClick={() => setShowPasswords((value) => !value)}
                  aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                >
                  <i className={`bi ${showPasswords ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </Field>
            <Field label="New password" required hint="At least 8 characters, with a letter and a number.">
              <input
                type={showPasswords ? 'text' : 'password'}
                className="control"
                value={passwords.newPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password" required>
              <input
                type={showPasswords ? 'text' : 'password'}
                className="control"
                value={passwords.confirmPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                autoComplete="new-password"
              />
            </Field>
            {passwords.newPassword ? (
              <div className="hstack" style={{ gap: 10 }}>
                <div className="strength-meter">
                  {[1, 2, 3, 4].map((bar) => (
                    <span key={bar} className={bar <= strength.bars ? `on ${strength.className}` : ''} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{strength.label} password</span>
              </div>
            ) : null}
            <button type="submit" className="btn btn-brand" disabled={savingPassword}>
              {savingPassword ? <span className="spinner-ring sm" /> : <i className="bi bi-shield-lock" />}
              Update password
            </button>
            <div className="soft-note mt-3">
              <i className="bi bi-info-circle" />
              <span>Changing your password signs out other sessions immediately. You will stay signed in here.</span>
            </div>
          </form>
        </Panel>

        <Panel title="Role & permissions" icon="bi-shield-check" sub="What this account can do">
          <div className="soft-note" style={{ marginTop: 0 }}>
            <i className={`bi ${role.icon}`} />
            <span>
              <strong>{role.label}:</strong> {role.description}
            </span>
          </div>
          <div className="permission-list">
            {[
              ['manageInventory', 'Create products and adjust stock'],
              ['managePurchases', 'Record and receive purchases'],
              ['recordIssues', 'Issue stock and void mistakes'],
              ['manageTransfers', 'Dispatch and receive branch transfers'],
              ['manageSuppliers', 'Maintain the supplier directory'],
              ['manageUsers', 'Create accounts and reset passwords'],
              ['viewAudit', 'Read the full audit trail'],
              ['viewReports', 'View reports and export data'],
            ].map(([action, label]) => {
              const allowed =
                user?.role === 'super_admin' ||
                ['manageInventory', 'managePurchases', 'recordIssues', 'manageTransfers', 'manageSuppliers', 'manageUsers', 'viewAudit', 'viewReports']
                  .includes(action);
              const permissionMap = {
                manageInventory: ['super_admin', 'accountant'],
                managePurchases: ['super_admin', 'accountant'],
                recordIssues: ['super_admin', 'accountant', 'storekeeper'],
                manageTransfers: ['super_admin', 'accountant', 'storekeeper'],
                manageSuppliers: ['super_admin', 'accountant'],
                manageUsers: ['super_admin'],
                viewAudit: ['super_admin', 'principal'],
                viewReports: ['super_admin', 'accountant', 'storekeeper', 'principal'],
              };
              const enabled = permissionMap[action]?.includes(user?.role) || user?.role === 'super_admin';
              return (
                <div key={action}>
                  <i className={`bi ${enabled ? 'bi-check-circle-fill' : 'bi-dash-circle'}`} style={{ color: enabled ? 'var(--teal-600)' : 'var(--muted)' }} />
                  <span style={{ opacity: enabled ? 1 : 0.55 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Account information" icon="bi-info-circle" sub="Session and audit details">
          <div className="profile-meta-list">
            <div className="profile-meta-item">
              <i className="bi bi-person-badge" />
              <span className="k">Account ID</span>
              <span className="v mono">#{user?._id?.slice(-10)}</span>
            </div>
            <div className="profile-meta-item">
              <i className="bi bi-shield-lock" />
              <span className="k">Role</span>
              <span className="v">{role.label}</span>
            </div>
            <div className="profile-meta-item">
              <i className="bi bi-calendar-plus" />
              <span className="k">Account created</span>
              <span className="v">{formatDate(user?.createdAt)}</span>
            </div>
            <div className="profile-meta-item">
              <i className="bi bi-clock-history" />
              <span className="k">Last sign in</span>
              <span className="v">{formatDateTime(user?.lastLoginAt)}</span>
            </div>
            <div className="profile-meta-item">
              <i className="bi bi-envelope-check" />
              <span className="k">Email</span>
              <span className="v">{user?.email}</span>
            </div>
            <div className="profile-meta-item">
              <i className="bi bi-telephone" />
              <span className="k">Phone</span>
              <span className="v">{user?.phone || 'Not provided'}</span>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
