import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { api, can, CATEGORY_META, HERO_IMAGE, LEDGER_TYPE_META, ROLE_META } from '../utils/constants.js';
import {
  formatCompact,
  formatCurrency,
  formatNumber,
  getErrorMessage,
  greeting,
  timeAgo,
} from '../utils/format.js';
import {
  CrumbBar,
  EmptyState,
  InlineAlert,
  PageLoader,
  Panel,
  ProductThumb,
  StatCard,
  StatusPill,
  interactiveProps,
} from '../components/ui.jsx';

const CHART_COLORS = ['#4f46e5', '#14b8a6', '#f59e0b', '#8b5cf6', '#3b82f6', '#94a3b8'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="label">{label}</p>
      {payload.map((item) => (
        <div className="row" key={item.dataKey} style={{ color: item.color }}>
          <span>{item.dataKey === 'in' ? 'Stock in' : 'Stock out'}:</span>
          <span>{formatNumber(item.value)} units</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const role = ROLE_META[user?.role] || ROLE_META.accountant;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/dashboard');
      setData(response.data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || {};
  const movementTrend = data?.movementTrend || [];
  const lowStockItems = data?.lowStockItems || [];
  const categoryBreakdown = data?.categoryBreakdown || [];
  const recentActivity = data?.recentActivity || [];
  const recentPurchases = data?.recentPurchases || [];
  const topIssued = data?.topIssued || [];

  const categoryData = useMemo(
    () =>
      categoryBreakdown.map((row, index) => ({
        name: row._id,
        value: Math.round(row.value || 0),
        units: row.units || 0,
        count: row.count || 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
        icon: CATEGORY_META[row._id]?.icon || 'bi-box-seam',
      })),
    [categoryBreakdown]
  );

  const categoryTotal = categoryData.reduce((sum, row) => sum + row.value, 0);
  const quickActions = [
    can(user?.role, 'manageInventory') && {
      to: '/products?new=1',
      icon: 'bi-plus-square',
      title: 'Add a product',
      sub: 'Grow the inventory catalogue',
    },
    can(user?.role, 'recordIssues') && {
      to: '/issues?new=1',
      icon: 'bi-box-arrow-up',
      title: 'Issue supplies',
      sub: 'Record food or class issues',
    },
    can(user?.role, 'managePurchases') && {
      to: '/purchases?new=1',
      icon: 'bi-truck',
      title: 'New purchase',
      sub: 'Capture supplier procurement',
    },
    can(user?.role, 'manageTransfers') && {
      to: '/transfers?new=1',
      icon: 'bi-arrow-left-right',
      title: 'Transfer stock',
      sub: 'Dispatch to the branch',
    },
    { to: '/reports', icon: 'bi-graph-up-arrow', title: 'Open reports', sub: 'Review spending & usage' },
  ].filter(Boolean);

  if (loading && !data) {
    return (
      <>
        <CrumbBar items={[{ label: 'Dashboard' }]} />
        <PageLoader label="Loading your stock overview…" />
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <CrumbBar items={[{ label: 'Dashboard' }]} />
        <Panel title="Dashboard unavailable" icon="bi-exclamation-octagon">
          <InlineAlert type="error">{error}</InlineAlert>
          <button type="button" className="btn btn-brand" onClick={load}>
            <i className="bi bi-arrow-clockwise" />
            Try again
          </button>
        </Panel>
      </>
    );
  }

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Dashboard' }]} />

      <section className="dash-hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span className="dot" />
            Live stock overview
          </span>
          <h1 className="hero-title">
            {greeting()}, <span>{user?.name?.split(' ')[0] || 'there'}</span>
          </h1>
          <p className="hero-sub">
            {user?.role === 'principal'
              ? 'You have a read-only view of inventory health, spending and the full audit trail.'
              : `${role.description} Keep an eye on low stock, pending deliveries and today’s store activity.`}
          </p>

          <div className="hero-metrics">
            <Link to="/reports" className="hero-metric is-interactive" aria-label="Open inventory value report">
              Inventory value
              <strong>{formatCurrency(stats.inventoryValue || 0)}</strong>
            </Link>
            <Link to="/products" className="hero-metric is-interactive" aria-label="Browse products in stock">
              Units on hand
              <strong>{formatNumber(stats.unitsInStore || 0)}</strong>
            </Link>
            <Link to="/issues" className="hero-metric is-interactive" aria-label="Open issued records">
              Issued this month
              <strong>
                {formatNumber(stats.monthIssuedUnits || 0)} <span style={{ fontSize: 11 }}>units</span>
              </strong>
            </Link>
            <Link to="/notifications" className="hero-metric is-interactive" aria-label="Open stock alerts">
              Open alerts
              <strong>{formatNumber(stats.unreadAlerts || 0)}</strong>
            </Link>
          </div>

          <div className="hero-actions">
            <Link to="/products" className="btn btn-hero">
              <i className="bi bi-box-seam" />
              Browse inventory
            </Link>
            {can(user?.role, 'recordIssues') ? (
              <Link to="/issues?new=1" className="btn btn-hero-ghost">
                <i className="bi bi-box-arrow-up" />
                Record an issue
              </Link>
            ) : (
              <Link to="/reports" className="btn btn-hero-ghost">
                <i className="bi bi-graph-up-arrow" />
                View reports
              </Link>
            )}
          </div>
        </div>

        <div className="hero-visual">
          <img src={HERO_IMAGE} alt="School library and supplies" />
          <div className="hero-chip">
            <span className="ic">
              <i className="bi bi-buildings" />
            </span>
            <div>
              <strong>Two stores, one source of truth</strong>
              <span>Main campus & branch campus balances update together</span>
            </div>
          </div>
        </div>
      </section>

      {stats.lowStock > 0 ? (
        <div className="insight-strip">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>
            <strong>{stats.lowStock}</strong> product{stats.lowStock === 1 ? '' : 's'} at or below reorder
            level{stats.outOfStock ? `, including ${stats.outOfStock} fully out of stock` : ''}. Restock before
            the next school day.
          </span>
          <Link to="/products?status=low" className="link">
            Review low stock
          </Link>
        </div>
      ) : null}

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-cash-stack"
          tone="brand"
          label="Inventory value"
          value={formatCurrency(stats.inventoryValue || 0)}
          to="/reports"
          hint="Open the stock valuation report"
          meta={
            <>
              <strong>{formatCurrency(stats.mainValue || 0)}</strong> main
              <span className="meta-dot" />
              <strong>{formatCurrency(stats.branchValue || 0)}</strong> branch
            </>
          }
        />
        <StatCard
          icon="bi-boxes"
          tone="teal"
          label="Products tracked"
          value={formatNumber(stats.totalProducts || 0)}
          to="/products"
          hint="Browse all products"
          meta={
            <>
              <strong>{formatNumber(stats.unitsInStore || 0)}</strong> units across both stores
            </>
          }
        />
        <StatCard
          icon="bi-exclamation-triangle"
          tone="amber"
          label="Low stock items"
          value={formatNumber(stats.lowStock || 0)}
          to="/products?status=low"
          hint="Review low stock products"
          meta={
            stats.outOfStock ? (
              <>
                <span className="down">{stats.outOfStock} out of stock</span>
              </>
            ) : (
              <>All items above their reorder level</>
            )
          }
        />
        <StatCard
          icon="bi-wallet2"
          tone="violet"
          label="Spend this month"
          value={formatCurrency(stats.monthSpend || 0)}
          to="/purchases"
          hint="Open purchase records"
          meta={
            <>
              <strong>{formatNumber(stats.monthOrders || 0)}</strong> purchase orders
              {stats.pendingPurchases ? (
                <>
                  <span className="meta-dot" />
                  {stats.pendingPurchases} awaiting delivery
                </>
              ) : null}
            </>
          }
        />
      </div>

      <div className="dash-grid">
        <Panel
          title="Movement this week"
          icon="bi-activity"
          sub="Units received and issued across the last seven days"
          actions={
            <Link to="/ledger" className="btn btn-outline-soft btn-sm">
              <i className="bi bi-journal-text" />
              Full ledger
            </Link>
          }
          bodyClassName="panel-body tight"
        >
          <div className="chart-height">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={movementTrend} margin={{ top: 12, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f7" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10.5, fill: '#94a3b8' }}
                  width={40}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="in"
                  stroke="#6366f1"
                  strokeWidth={2.2}
                  fill="url(#inFill)"
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="out"
                  stroke="#14b8a6"
                  strokeWidth={2.2}
                  fill="url(#outFill)"
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="hstack" style={{ gap: 18, padding: '4px 8px 10px' }}>
            <span className="category-tag">
              <i className="bi bi-circle-fill" style={{ color: '#6366f1', fontSize: 8 }} />
              Stock in
            </span>
            <span className="category-tag">
              <i className="bi bi-circle-fill" style={{ color: '#14b8a6', fontSize: 8 }} />
              Stock out
            </span>
          </div>
        </Panel>

        <Panel
          title="Needs attention"
          icon="bi-exclamation-triangle"
          sub="Lowest balances at the main store"
          actions={
            <Link to="/products?status=low" className="btn btn-ghost btn-sm">
              View all
            </Link>
          }
          bodyClassName="panel-body tight"
        >
          {lowStockItems.length ? (
            <div className="low-list">
              {lowStockItems.map((product) => (
                <Link
                  to={`/products/${product._id}`}
                  className="low-item"
                  key={product._id}
                  style={{ color: 'inherit' }}
                >
                  <ProductThumb product={product} />
                  <div className="low-main">
                    <strong>{product.name}</strong>
                    <span>
                      <i className="bi bi-upc" />
                      {product.sku}
                    </span>
                  </div>
                  <div className="low-qty">
                    <strong>
                      {formatNumber(product.quantity)} {product.unit}
                    </strong>
                    <span>reorder at {formatNumber(product.reorderLevel)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="bi-check2-circle"
              title="Stock levels look healthy"
              message="No product is at or below its reorder level right now."
            />
          )}
        </Panel>
      </div>

      <div className="dash-grid-3 mt-3">
        <Panel
          title="Inventory mix"
          icon="bi-pie-chart"
          sub="Value distribution by category"
          bodyClassName="panel-body tight"
        >
          {categoryData.length ? (
            <>
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categoryData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [formatCurrency(value), name]}
                      contentStyle={{
                        borderRadius: 9,
                        fontSize: 11,
                        border: '1px solid #e6e9f2',
                        boxShadow: '0 12px 32px -16px rgba(16,24,40,.22)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <strong>{formatCompact(categoryTotal)}</strong>
                  <span>RWF value</span>
                </div>
              </div>
              <div className="legend-grid">
                {categoryData.slice(0, 5).map((entry) => (
                  <Link
                    to={`/products?category=${encodeURIComponent(entry.name)}`}
                    className="legend-item is-interactive"
                    key={entry.name}
                    aria-label={`Browse ${entry.name} products`}
                  >
                    <span className="legend-dot" style={{ background: entry.color }} />
                    <span className="truncate">{entry.name}</span>
                    <span className="val">{formatCurrency(entry.value)}</span>
                    <i className="bi bi-arrow-up-right legend-go" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon="bi-pie-chart" title="No category data yet" message="Add products to see the mix." />
          )}
        </Panel>

        <Panel
          title="Most issued"
          icon="bi-trophy"
          sub="Top consumption in the last 30 days"
          bodyClassName="panel-body tight"
        >
          {topIssued.length ? (
            <div className="rank-list">
              {topIssued.map((row, index) => {
                const max = topIssued[0]?.units || 1;
                return (
                  <Link
                    to={`/products?search=${encodeURIComponent(row.name)}`}
                    className="rank-item is-interactive"
                    key={`${row.name}-${index}`}
                    aria-label={`Find ${row.name} in inventory`}
                  >
                    <span className="rank-number">{index + 1}</span>
                    <div className="rank-main">
                      <div className="rank-label">
                        <span>{row.name}</span>
                        <strong>
                          {formatNumber(row.units)} {row.unit}
                        </strong>
                      </div>
                      <div className="rank-bar">
                        <span style={{ width: `${Math.max(4, (row.units / max) * 100)}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="bi-trophy" title="No issues recorded yet" message="Issued items will rank here." />
          )}
        </Panel>

        <div className="vstack" style={{ gap: 14 }}>
          <div className="branch-card">
            <span className="bc-title">
              <i className="bi bi-buildings" />
              Branch campus
            </span>
            <h3>{formatCurrency(stats.branchValue || 0)}</h3>
            <div className="branch-stats">
              <div>
                Products
                <strong>{formatNumber(stats.branchProducts || 0)}</strong>
              </div>
              <div>
                Units
                <strong>{formatNumber(stats.branchUnits || 0)}</strong>
              </div>
              <div>
                In transit
                <strong>{formatNumber(stats.pendingTransfers || 0)}</strong>
              </div>
            </div>
            <Link
              to="/transfers"
              className="btn btn-success-soft btn-sm"
              style={{ marginTop: 13, width: '100%' }}
            >
              <i className="bi bi-arrow-left-right" />
              Manage transfers
            </Link>
          </div>

          <Panel title="Quick actions" icon="bi-lightning-charge" bodyClassName="panel-body tight">
            <div className="quick-grid">
              {quickActions.map((action) => (
                <Link to={action.to} className="quick-tile" key={action.title}>
                  <i className={`bi ${action.icon}`} />
                  <span>
                    <strong>{action.title}</strong>
                    <span>{action.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="dash-grid mt-3">
        <Panel
          title="Recent activity"
          icon="bi-activity"
          sub="Every stock movement is captured in the ledger"
          actions={
            <Link to="/ledger" className="btn btn-ghost btn-sm">
              Open ledger
            </Link>
          }
          bodyClassName="panel-body tight"
        >
          {recentActivity.length ? (
            <div className="activity-list">
              {recentActivity.map((entry) => {
                const meta = LEDGER_TYPE_META[entry.type] || LEDGER_TYPE_META.adjustment_in;
                const link = entry.product
                  ? `/products/${entry.product._id || entry.product}`
                  : '/ledger';
                return (
                  <Link
                    to={link}
                    className="activity-item is-interactive"
                    key={entry._id}
                    aria-label={`Open ${entry.productName || 'ledger entry'}`}
                  >
                    <span className={`activity-icon ${entry.direction === 'in' ? 'in' : 'out'}`}>
                      <i className={`bi ${meta.icon}`} />
                    </span>
                    <div className="activity-copy">
                      <p>
                        <strong>{entry.productName}</strong>{' '}
                        {entry.direction === 'in' ? 'received' : 'issued'} ·{' '}
                        {formatNumber(entry.quantity)} {entry.unit}
                        {entry.party ? ` · ${entry.party}` : ''}
                      </p>
                      <div className="activity-meta">
                        <span className={`pill tone-${meta.tone}`} style={{ padding: '1px 6px', fontSize: 9.5 }}>
                          {meta.label}
                        </span>
                        <span className="meta-dot" />
                        <span>{entry.location === 'branch' ? 'Branch' : 'Main'} store</span>
                        <span className="meta-dot" />
                        <span>{entry.performedBy?.name || 'System'}</span>
                        <span className="meta-dot" />
                        <span>{timeAgo(entry.createdAt)}</span>
                      </div>
                    </div>
                    <i className="bi bi-chevron-right" aria-hidden="true" style={{ alignSelf: 'center', fontSize: 10, color: 'var(--muted-2)' }} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="bi-activity"
              title="No activity yet"
              message="Purchases, issues and transfers will appear here as they happen."
            />
          )}
        </Panel>

        <Panel
          title="Recent purchases"
          icon="bi-truck"
          sub="Latest procurement records"
          actions={
            <Link to="/purchases" className="btn btn-ghost btn-sm">
              View all
            </Link>
          }
          bodyClassName="panel-body tight"
        >
          {recentPurchases.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th className="text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPurchases.map((purchase) => (
                    <tr
                      key={purchase._id}
                      className="is-clickable"
                      onClick={() => navigate('/purchases')}
                      {...interactiveProps(() => navigate('/purchases'), 'Open purchases')}
                    >
                      <td>
                        <p className="cell-title mono">{purchase.reference}</p>
                        <p className="cell-sub">{new Date(purchase.purchaseDate).toLocaleDateString('en-GB')}</p>
                      </td>
                      <td>{purchase.supplier?.name || purchase.supplierName || '—'}</td>
                      <td>
                        <StatusPill status={purchase.status} />
                      </td>
                      <td className="text-end num cell-strong">{formatCurrency(purchase.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon="bi-truck"
              title="No purchases recorded"
              message="Procurement records will show up here."
            />
          )}
        </Panel>
      </div>

      <div className="soft-note gray mt-3">
        <i className="bi bi-info-circle" />
        <span>
          Low-stock alerts are generated automatically for the main campus store and resolve themselves once
          stock recovers. Branch quantities are tracked separately and never trigger main-store alerts.
        </span>
      </div>
    </div>
  );
}
