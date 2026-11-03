import { NavLink } from 'react-router-dom';
import { ROLE_META } from '../utils/constants.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotifications } from '../contexts/NotificationsContext.jsx';
import { Avatar } from './ui.jsx';

const SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { to: '/', label: 'Dashboard', icon: 'bi-grid-1x2', end: true },
      { to: '/products', label: 'Inventory', icon: 'bi-box-seam' },
      { to: '/purchases', label: 'Purchases', icon: 'bi-truck' },
      { to: '/issues', label: 'Issues', icon: 'bi-box-arrow-up' },
      { to: '/transfers', label: 'Transfers', icon: 'bi-arrow-left-right' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/reports', label: 'Reports', icon: 'bi-graph-up-arrow' },
      { to: '/ledger', label: 'Stock ledger', icon: 'bi-journal-text' },
      { to: '/notifications', label: 'Notifications', icon: 'bi-bell', badge: 'alerts' },
      { to: '/audit', label: 'Audit log', icon: 'bi-shield-check', roles: ['super_admin', 'principal'] },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/suppliers', label: 'Suppliers', icon: 'bi-people' },
      { to: '/users', label: 'Team & roles', icon: 'bi-person-gear', roles: ['super_admin'] },
      { to: '/profile', label: 'My profile', icon: 'bi-person-circle' },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const role = ROLE_META[user?.role] || ROLE_META.accountant;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(user?.role)),
  })).filter((section) => section.items.length);

  return (
    <>
      {open ? <div className="sidebar-overlay" onClick={onClose} aria-hidden="true" /> : null}
      <aside className={`sidebar ${open ? 'open' : ''}`.trim()}>
        <div className="sidebar-brand">
          <div className="brand-mark">M</div>
          <div className="brand-text">
            <div className="brand-name">Mrskariza</div>
            <div className="brand-sub">School stock control</div>
          </div>
        </div>

        <div className="sidebar-scroll">
          {visibleSections.map((section) => (
            <div className="nav-section" key={section.label}>
              <p className="nav-section-label">{section.label}</p>
              <ul className="nav-list">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `nav-link-item ${isActive ? 'active' : ''}`.trim()}
                      onClick={onClose}
                    >
                      <i className={`bi ${item.icon}`} />
                      <span>{item.label}</span>
                      {item.badge === 'alerts' && unreadCount > 0 ? (
                        <span className="nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                      ) : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" tone={role.tone} />
            <div className="meta">
              <div className="name">{user?.name || 'Signed in'}</div>
              <div className="role">{role.label}</div>
            </div>
            <button type="button" className="sidebar-signout" onClick={logout} title="Sign out" aria-label="Sign out">
              <i className="bi bi-box-arrow-right" />
            </button>
          </div>
          <div className="sidebar-note">
            <span className="dot" />
            Connected to the live store database
          </div>
        </div>
      </aside>
    </>
  );
}
