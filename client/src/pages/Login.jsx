import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { AUTH_IMAGE, ROLE_META } from '../utils/constants.js';
import { getErrorMessage } from '../utils/format.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { Field } from '../components/ui.jsx';

const DEMO = [
  { email: 'superadmin@mrskariza.school', password: 'Admin@1234', role: 'super_admin' },
  { email: 'accountant@mrskariza.school', password: 'Account@1234', role: 'accountant' },
  { email: 'storekeeper@mrskariza.school', password: 'Store@1234', role: 'storekeeper' },
  { email: 'principal@mrskariza.school', password: 'Principal@1234', role: 'principal' },
];

export default function Login() {
  const { login, user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const showDemo = import.meta.env.VITE_SHOW_DEMO === 'true' || import.meta.env.DEV;

  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(form.email.trim(), form.password);
      toast.success('Welcome back', 'Signed in successfully.');
    } catch (error) {
      toast.error('Sign in failed', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const useDemo = (account) => {
    setForm({ email: account.email, password: account.password });
  };

  return (
    <div className="auth-page">
      <div className="auth-form-side">
        <div className="auth-brand">
          <div className="brand-mark">M</div>
          <div className="brand-text">
            <div className="brand-name">Mrskariza</div>
            <div className="brand-sub">School stock control</div>
          </div>
        </div>

        <div className="auth-form-wrap">
          <span className="auth-kicker">
            <span className="dot" />
            Secure sign in
          </span>
          <h1 className="auth-title">Sign in to your workspace</h1>
          <p className="auth-sub">
            Track procurement, issues, transfers and low-stock alerts across your main and branch stores
            from one calm, accountable dashboard.
          </p>

          <form className="auth-form" onSubmit={submit}>
            <Field label="Email address" required htmlFor="email">
              <div className="input-icon">
                <i className="bi bi-envelope" />
                <input
                  id="email"
                  type="email"
                  className="control"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="name@mrskariza.school"
                  autoComplete="email"
                  required
                />
              </div>
            </Field>

            <Field label="Password" required htmlFor="password">
              <div className="input-affix">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="control"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="affix"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
                </button>
              </div>
            </Field>

            <div className="auth-row">
              <span className="auth-remember">
                <input type="checkbox" className="form-check-input" id="remember" defaultChecked />
                <label htmlFor="remember">Keep me signed in</label>
              </span>
              <span className="auth-help">Use your assigned credentials</span>
            </div>

            <button type="submit" className="btn btn-brand auth-submit" disabled={loading}>
              {loading ? <span className="spinner-ring sm" /> : <i className="bi bi-box-arrow-in-right" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {showDemo ? (
            <>
              <div className="auth-divider">
                <span>Demo accounts</span>
              </div>
              <div className="demo-box">
                <div className="demo-box-title">
                  <span>One-click sign in</span>
                  <span>For preview only</span>
                </div>
                <div className="demo-grid">
                  {DEMO.map((account) => {
                    const meta = ROLE_META[account.role];
                    return (
                      <button
                        type="button"
                        className="demo-btn"
                        key={account.email}
                        onClick={() => useDemo(account)}
                      >
                        <i className={`bi ${meta.icon}`} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          <div className="auth-note">
            <i className="bi bi-shield-lock" />
            <span>All actions are audited. Passwords are securely hashed and sessions can be revoked on demand.</span>
          </div>
        </div>

        <div className="auth-foot">
          <i className="bi bi-dot" style={{ color: 'var(--teal-600)' }} />
          Mrskariza · Built for accountable school stock control
        </div>
      </div>

      <div className="auth-visual">
        <img src={AUTH_IMAGE} alt="Well organised school store shelves" />
        <div className="auth-visual-top">
          <span className="visual-badge">
            <span className="dot" />
            Real-time stock awareness
          </span>
          <div className="visual-brand">
            <div className="brand-mark">M</div>
            Mrskariza
          </div>
        </div>

        <div className="floating-alert">
          <div className="floating-alert-head">
            <span className="floating-alert-icon">
              <i className="bi bi-exclamation-triangle-fill" />
            </span>
            <div>
              <strong>Low stock alert</strong>
              <span>Auto-notified to key roles</span>
            </div>
          </div>
          <p className="floating-alert-body">
            Maize meal fell below the reorder level. Super Admin, Accountant and Storekeeper see this
            instantly.
          </p>
          <div className="floating-alert-bars">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="auth-visual-content">
          <div className="auth-quote-mark">
            <i className="bi bi-quote" />
          </div>
          <p className="auth-quote">
            Clarity on <span>procurement</span>, confidence in <span>issues</span>, and a clean trail for
            every movement.
          </p>
          <div className="auth-perks">
            <div className="auth-perk">
              <i className="bi bi-check2" />
              <span>Immutable ledger for purchases, issues, transfers and adjustments</span>
            </div>
            <div className="auth-perk">
              <i className="bi bi-check2" />
              <span>Role-based access with full auditability and session controls</span>
            </div>
            <div className="auth-perk">
              <i className="bi bi-check2" />
              <span>Branch transfers with dispatch & receipt tracking</span>
            </div>
          </div>
        </div>

        <div className="auth-visual-foot">
          <div>
            <p className="visual-metric">Designed for</p>
            <strong>Primary & secondary schools</strong>
          </div>
          <div>
            <p className="visual-metric">Focus</p>
            <strong>Food • Supplies • Accountability</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
