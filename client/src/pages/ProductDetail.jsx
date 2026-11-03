import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { api, can, CATEGORY_META, LEDGER_TYPE_META } from '../utils/constants.js';
import { formatCurrency, formatDate, formatNumber, getErrorMessage, timeAgo } from '../utils/format.js';
import {
  CrumbBar,
  EmptyState,
  InlineAlert,
  PageHeader,
  PageLoader,
  Panel,
  Pill,
  ProductThumb,
  StatusPill,
  StockBadge,
  StockMeter,
} from '../components/ui.jsx';
import { AdjustStockDrawer, ProductFormDrawer } from '../components/InventoryForms.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const canManage = can(user?.role, 'manageInventory');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get(`/products/${id}`);
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) return <PageLoader label="Loading product details…" />;

  if (error && !data) {
    return (
      <>
        <CrumbBar items={[{ label: 'Inventory', to: '/products' }, { label: 'Product' }]} />
        <Panel title="Product unavailable" icon="bi-exclamation-octagon">
          <InlineAlert type="error">{error}</InlineAlert>
          <div className="hstack" style={{ marginTop: 14, gap: 10 }}>
            <button type="button" className="btn btn-brand" onClick={load}>
              <i className="bi bi-arrow-clockwise" />
              Try again
            </button>
            <button type="button" className="btn btn-outline-soft" onClick={() => navigate('/products')}>
              Back to inventory
            </button>
          </div>
        </Panel>
      </>
    );
  }

  const product = data.product;
  const meta = CATEGORY_META[product.category] || CATEGORY_META.Other;
  const recentMovements = data.recentMovements || [];
  const purchases = data.purchases || [];
  const usage = data.usage || {};

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Inventory', to: '/products' }, { label: product.name }]} />

      <PageHeader
        eyebrow="Product profile"
        icon="bi-box-seam"
        title={product.name}
        sub={
          <>
            <span className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
              <span className="category-tag">
                <i className={`bi ${meta.icon}`} />
                {product.category}
              </span>
              <span className="code-chip">
                <i className="bi bi-upc" />
                {product.sku}
              </span>
              <span className="code-chip">
                <i className="bi bi-rulers" />
                Measured in {product.unit}
              </span>
              {product.storageLocation ? (
                <span className="code-chip">
                  <i className="bi bi-geo-alt" />
                  {product.storageLocation}
                </span>
              ) : null}
            </span>
          </>
        }
        actions={
          <>
            <Link to="/products" className="btn btn-outline-soft">
              <i className="bi bi-arrow-left" />
              Back to inventory
            </Link>
            {canManage ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(true)}>
                  <i className="bi bi-pencil-square" />
                  Edit details
                </button>
                <button type="button" className="btn btn-brand" onClick={() => setAdjustOpen(true)}>
                  <i className="bi bi-sliders" />
                  Adjust stock
                </button>
              </>
            ) : null}
          </>
        }
      />

      <section className="detail-hero">
        <div className="detail-media">
          <ProductThumb product={product} size="xl" />
        </div>
        <div className="detail-copy">
          <div className="detail-title-row">
            <h1>{product.name}</h1>
            <StockBadge product={product} />
          </div>
          {product.description ? <p className="detail-description">{product.description}</p> : null}
          <div className="detail-stats">
            <div className="detail-stat">
              <span>Main store</span>
              <strong>
                {formatNumber(product.quantity)} {product.unit}
              </strong>
            </div>
            <div className="detail-stat">
              <span>Branch store</span>
              <strong>
                {formatNumber(product.branchQuantity)} {product.unit}
              </strong>
            </div>
            <div className="detail-stat">
              <span>Reorder level</span>
              <strong>
                {formatNumber(product.reorderLevel)} {product.unit}
              </strong>
            </div>
            <div className="detail-stat">
              <span>Unit cost</span>
              <strong>{formatCurrency(product.unitCost)}</strong>
            </div>
            <div className="detail-stat">
              <span>Total value (on hand)</span>
              <strong>
                {formatCurrency(
                  ((product.quantity || 0) + (product.branchQuantity || 0)) * (product.unitCost || 0)
                )}
              </strong>
            </div>
            <div className="detail-stat">
              <span>Total issued (all time)</span>
              <strong>
                {formatNumber(usage.totalOut || 0)} {product.unit}
              </strong>
            </div>
          </div>
          <div className="stock-split">
            <div>
              <div className="hstack" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>Main store health</span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {product.quantity <= product.reorderLevel && product.quantity > 0
                    ? 'Approaching reorder'
                    : product.quantity <= 0
                      ? 'Restock required'
                      : 'Healthy'}
                </span>
              </div>
              <StockMeter product={product} large />
            </div>
          </div>
        </div>
      </section>

      <div className="dash-grid mt-3">
        <Panel
          title="Stock locations"
          icon="bi-geo-alt"
          sub="Balances split across the two campuses"
          bodyClassName="panel-body tight"
        >
          <div className="vstack" style={{ gap: 12 }}>
            <div className="location-card">
              <div className="location-head">
                <i className="bi bi-building" />
                <strong>Main campus store</strong>
              </div>
              <div className="location-qty">
                <strong>
                  {formatNumber(product.quantity)} {product.unit}
                </strong>
                <span>In hand</span>
              </div>
              <div className="location-foot">
                <span>Reorder threshold: {formatNumber(product.reorderLevel)} {product.unit}</span>
                {canManage ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdjustOpen(true)}>
                    Adjust
                  </button>
                ) : null}
              </div>
            </div>
            <div className="location-card branch">
              <div className="location-head">
                <i className="bi bi-buildings" />
                <strong>Branch campus store</strong>
              </div>
              <div className="location-qty">
                <strong>
                  {formatNumber(product.branchQuantity)} {product.unit}
                </strong>
                <span>In hand</span>
              </div>
              <div className="location-foot">
                <span>Received via transfers</span>
                <Link to="/transfers" className="btn btn-ghost btn-sm">
                  View transfers
                </Link>
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Recent movements"
          icon="bi-activity"
          sub="Latest ledger entries for this product"
          actions={
            <Link to="/ledger" className="btn btn-ghost btn-sm">
              Open full ledger
            </Link>
          }
          bodyClassName="panel-body tight"
        >
          {recentMovements.length ? (
            <div className="activity-list">
              {recentMovements.map((entry) => {
                const metaEntry = LEDGER_TYPE_META[entry.type] || LEDGER_TYPE_META.adjustment_in;
                return (
                  <div className="activity-item" key={entry._id}>
                    <span className={`activity-icon ${entry.direction === 'in' ? 'in' : 'out'}`}>
                      <i className={`bi ${metaEntry.icon}`} />
                    </span>
                    <div className="activity-copy">
                      <p>
                        <strong>{formatNumber(entry.quantity)} {product.unit}</strong> {entry.direction === 'in' ? 'in' : 'out'} · {metaEntry.label}
                        {entry.referenceDoc ? <> · {entry.referenceDoc}</> : null}
                      </p>
                      <div className="activity-meta">
                        <span>{entry.location === 'branch' ? 'Branch' : 'Main'} store</span>
                        <span className="meta-dot" />
                        <span>{entry.performedBy?.name || 'System'}</span>
                        <span className="meta-dot" />
                        <span>{timeAgo(entry.createdAt)}</span>
                        {entry.party ? (
                          <>
                            <span className="meta-dot" />
                            <span>{entry.party}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="bi-activity" title="No movements yet" message="Purchases, issues or adjustments will appear here." />
          )}
        </Panel>
      </div>

      <div className="dash-grid mt-3">
        <Panel
          title="Purchase history"
          icon="bi-truck"
          sub="Orders that brought this item in"
          bodyClassName="panel-body tight"
        >
          {purchases.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Supplier</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="text-end">Qty on PO</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => {
                    const item = purchase.items?.find((line) => String(line.product) === String(product._id));
                    return (
                      <tr key={purchase._id} className="is-clickable" onClick={() => navigate('/purchases')}>
                        <td>
                          <p className="cell-title mono">{purchase.reference}</p>
                          {purchase.invoiceNo ? <p className="cell-sub">Invoice {purchase.invoiceNo}</p> : null}
                        </td>
                        <td>{purchase.supplier?.name || purchase.supplierName}</td>
                        <td>{formatDate(purchase.purchaseDate)}</td>
                        <td><StatusPill status={purchase.status} /></td>
                        <td className="text-end num cell-strong">
                          {item ? `${formatNumber(item.quantity)} ${product.unit}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="bi-truck" title="No purchase records" message="This product has not appeared on any purchase order yet." />
          )}
        </Panel>

        <Panel
          title="Product overview"
          icon="bi-info-circle"
          sub="Catalogue metadata"
          bodyClassName="panel-body"
        >
          <div className="kv-list">
            <div className="kv-row">
              <span className="k">Supplier</span>
              <span className="v">{product.supplier?.name || 'Not linked'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Unit of measure</span>
              <span className="v">{product.unit}</span>
            </div>
            <div className="kv-row">
              <span className="k">Storage location</span>
              <span className="v">{product.storageLocation || '—'}</span>
            </div>
            <div className="kv-row">
              <span className="k">Reorder level</span>
              <span className="v">
                {formatNumber(product.reorderLevel)} {product.unit}
              </span>
            </div>
            <div className="kv-row">
              <span className="k">Unit cost</span>
              <span className="v">{formatCurrency(product.unitCost)}</span>
            </div>
            <div className="kv-row">
              <span className="k">Created</span>
              <span className="v">{formatDate(product.createdAt)}</span>
            </div>
            <div className="kv-row">
              <span className="k">Last updated</span>
              <span className="v">{formatDate(product.updatedAt)}</span>
            </div>
            <div className="kv-row">
              <span className="k">Status</span>
              <span className="v">
                <Pill tone={product.isActive ? 'success' : 'neutral'} dot>
                  {product.isActive ? 'Active' : 'Archived'}
                </Pill>
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <ProductFormDrawer
        open={formOpen}
        product={product}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />
      <AdjustStockDrawer
        open={adjustOpen}
        product={product}
        onClose={() => setAdjustOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
