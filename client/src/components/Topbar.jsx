import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotifications } from '../contexts/NotificationsContext.jsx';
import { ROLE_META } from '../utils/constants.js';
import { timeAgo } from '../utils/format.js';
import { Avatar } from './ui.jsx';

const notifIcon = (item) => {
  if (item.type === 'out_of_stock') return { icon: 'bi-x-octagon-fill', className: 'critical' };
  if (item.type === 'low_stock') return { icon: 'bi-exclamation-triangle-fill', className: 'warning' };
  return { icon: 'bi-info-circle-fill', className: 'info' };
};

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const role = ROLE_META[user?.role] || ROLE_META.accountant;

  useEffect(() => {
    setNotifOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onDown = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = search.trim();
    navigate(term ? `/products?search=${encodeURIComponent(term)}` : '/products');
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="sidebar-toggle" onClick={onToggleSidebar} aria-label="Open navigation">
          <i className="bi bi-list" />
        </button>
        <form className="topbar-search" onSubmit={submitSearch}>
          <i className="bi bi-search" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products, SKU or storage location…"
            aria-label="Search inventory"
          />
        </form>
      </div>

      <div className="topbar-actions">
        <span className="topbar-date">
          <i className="bi bi-calendar3" />
          {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
        </span>

        <div className="action-wrap" ref={notifRef}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setNotifOpen((value) => !value);
              setProfileOpen(false);
            }}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <i className="bi bi-bell" />
            {unreadCount > 0 ? (
              <span className="ping count">{unreadCount > 9 ? '9+' : unreadCount}</span>
            ) : null}
          </button>

          {notifOpen ? (
            <div className="popover-card" role="dialog" aria-label="Recent notifications">
              <div className="popover-head">
                <h3>Notifications</h3>
                <span className="count">{unreadCount} unread</span>
              </div>
              <div className="notif-list">
                {notifications.length ? (
                  notifications.map((item) => {
                    const unread = !item.readBy?.includes(user?._id);
                    const meta = notifIcon(item);
                    const productId = item.product?._id || item.product;
                    return (
                      <Link
                        key={item._id}
                        to={productId ? `/products/${productId}` : '/notifications'}
                        className={`notif-row ${unread ? 'unread' : ''}`.trim()}
                        onClick={() => {
                          if (unread) markRead(item._id).catch(() => {});
                          setNotifOpen(false);
                        }}
                        style={{ color: 'inherit' }}
                      >
                        <span className={`notif-icon ${meta.className}`}>
                          <i className={`bi ${meta.icon}`} />
                        </span>
                        <div className="notif-copy">
                          <strong>{item.title}</strong>
                          <p>{item.message}</p>
                          <span className="notif-time">
                            <i className="bi bi-clock" />
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
                    You are all caught up.
                  </div>
                )}
              </div>
              <div className="popover-foot hstack" style={{ justifyContent: 'space-between' }}>
                <Link to="/notifications" onClick={() => setNotifOpen(false)}>
                  Open notification centre
                </Link>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => markAllRead().catch(() => {})}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="action-wrap" ref={profileRef}>
          <button
            type="button"
            className="topbar-user"
            onClick={() => {
              setProfileOpen((value) => !value);
              setNotifOpen(false);
            }}
            aria-label="Account menu"
            aria-expanded={profileOpen}
          >
            <Avatar name={user?.name} src={user?.avatarUrl} size="sm" tone={role.tone} />
            <span className="who">
              <strong>{user?.name?.split(' ')[0] || 'Account'}</strong>
              <span>{role.label}</span>
            </span>
            <i className="bi bi-chevron-down" />
          </button>

          {profileOpen ? (
            <div className="popover-card profile-popover" role="dialog" aria-label="Account menu">
              <div className="mini-head">
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
              <Link to="/profile" className="popover-link" onClick={() => setProfileOpen(false)}>
                <i className="bi bi-person-circle" />
                My profile
              </Link>
              <Link to="/notifications" className="popover-link" onClick={() => setProfileOpen(false)}>
                <i className="bi bi-bell" />
                Notifications
                {unreadCount > 0 ? <span className="nav-badge" style={{ marginLeft: 'auto' }}>{unreadCount}</span> : null}
              </Link>
              <div className="menu-sep" />
              <button
                type="button"
                className="popover-link danger"
                onClick={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <i className="bi bi-box-arrow-right" />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
