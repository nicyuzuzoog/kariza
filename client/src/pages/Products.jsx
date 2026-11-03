import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import {
  api,
  can,
  CATEGORY_META,
  PRODUCT_CATEGORIES,
} from '../utils/constants.js';
import {
  downloadCsv,
  formatCurrency,
  formatNumber,
  getErrorMessage,
} from '../utils/format.js';
import {
  ActionMenu,
  CategoryTag,
  ConfirmDialog,
  CrumbBar,
  EmptyState,
  FilterTabs,
  InlineAlert,
  PageLoader,
  Pagination,
  Panel,
  ProductThumb,
  SearchInput,
  StatCard,
  StockBadge,
  StockIndicator,
  interactiveProps,
} from '../components/ui.jsx';
import { AdjustStockDrawer, ProductFormDrawer } from '../components/InventoryForms.jsx';

const STATUS_TABS = [
  { value: 'all', label: 'All items' },
  { value: 'ok', label: 'Healthy' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'branch', label: 'At branch' },
  { value: 'archived', label: 'Archived' },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A–Z' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'category', label: 'Category' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'created', label: 'Newest first' },
];

export default function Products() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [sort, setSort] = useState('name');
  const [dir, setDir] = useState('asc');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ items: [], total: 0, pages: 1, stats: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const canManage = can(user?.role, 'manageInventory');

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch.trim()) next.set('search', debouncedSearch.trim());
    if (status !== 'all') next.set('status', status);
    if (category) next.set('category', category);
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, status, category, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/products', {
        params: {
          search: debouncedSearch.trim(),
          status,
          category,
          sort,
          dir,
          page,
          limit: 12,
        },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, category, sort, dir, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, category, sort, dir]);

  const items = data.items || [];
  const stats = data.stats || {};

  const activeFilters = [debouncedSearch.trim(), status !== 'all' ? status : '', category].filter(Boolean).length;

  const resetFilters = () => {
    setSearch('');
    setStatus('all');
    setCategory('');
    setSort('name');
    setDir('asc');
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    if (searchParams.get('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const archive = async () => {
    if (!archiving) return;
    setArchiveBusy(true);
    try {
      const { data: response } = await api.delete(`/products/${archiving._id}`);
      toast.success('Product archived', response.message);
      setArchiving(null);
      load();
    } catch (requestError) {
      toast.error('Could not archive', getErrorMessage(requestError));
    } finally {
      setArchiveBusy(false);
    }
  };

  const restore = async (product) => {
    try {
      const { data: response } = await api.post(`/products/${product._id}/restore`);
      toast.success('Product restored', response.message);
      load();
    } catch (requestError) {
      toast.error('Could not restore', getErrorMessage(requestError));
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `mrskariza-inventory-${new Date().toISOString().slice(0, 10)}`,
      [
        { label: 'Product', key: 'name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Category', key: 'category' },
        { label: 'Unit', key: 'unit' },
        { label: 'Main quantity', key: 'quantity' },
        { label: 'Branch quantity', key: 'branchQuantity' },
        { label: 'Reorder level', key: 'reorderLevel' },
        { label: 'Unit cost', key: 'unitCost' },
        { label: 'Total value', value: (row) => row.totalValue },
        { label: 'Supplier', value: (row) => row.supplier?.name || '' },
        { label: 'Storage location', key: 'storageLocation' },
        { label: 'Status', value: (row) => row.stockStatus },
      ],
      items
    );
    toast.success('Export ready', 'The current page of inventory has been downloaded as CSV.');
  };

  const actionItems = (product) => [
    { label: 'Open product', icon: 'bi-box-arrow-up-right', onClick: () => navigate(`/products/${product._id}`) },
    canManage && { label: 'Edit details', icon: 'bi-pencil-square', onClick: () => { setEditing(product); setFormOpen(true); } },
    canManage && !product.isActive && { label: 'Restore product', icon: 'bi-arrow-counterclockwise', onClick: () => restore(product) },
    canManage && { label: 'Adjust stock', icon: 'bi-sliders', onClick: () => setAdjusting(product) },
    canManage && product.isActive && { separator: true },
    canManage && product.isActive && { label: 'Archive product', icon: 'bi-archive', danger: true, onClick: () => setArchiving(product) },
  ];

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Workspace' }, { label: 'Inventory' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-box-seam" />
            Inventory catalogue
          </span>
          <h1 className="page-title">Products & supplies</h1>
          <p className="page-sub">
            Every item the school buys, stores or issues — from food and stationery to uniforms and
            equipment. Main and branch balances are tracked separately.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline-soft" onClick={exportCsv} disabled={!items.length}>
            <i className="bi bi-download" />
            Export CSV
          </button>
          {canManage ? (
            <button type="button" className="btn btn-brand" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <i className="bi bi-plus-lg" />
              Add product
            </button>
          ) : null}
        </div>
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-boxes"
          tone="brand"
          label="Products on file"
          value={formatNumber(stats.total || 0)}
          onClick={() => setStatus('all')}
          hint="Show every product"
          meta={<><strong>{formatNumber(stats.unitsInStore || 0)}</strong> units in both stores</>}
        />
        <StatCard
          icon="bi-cash-stack"
          tone="teal"
          label="Inventory value"
          value={formatCurrency(stats.inventoryValue || 0)}
          to="/reports"
          hint="Open the stock valuation report"
          meta={<><strong>{formatCurrency(stats.mainValue || 0)}</strong> main store</>}
        />
        <StatCard
          icon="bi-exclamation-triangle"
          tone="amber"
          label="Low stock"
          value={formatNumber(stats.lowStock || 0)}
          onClick={() => setStatus('low')}
          hint="Show low stock products"
          meta={<><span className="down">{formatNumber(stats.outOfStock || 0)} out of stock</span></>}
        />
        <StatCard
          icon="bi-buildings"
          tone="violet"
          label="Branch holdings"
          value={formatCurrency(stats.branchValue || 0)}
          onClick={() => setStatus('branch')}
          hint="Show products held at the branch"
          meta={<>Held at the branch campus store</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, SKU or storage location…"
          />
          <select className="control filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {PRODUCT_CATEGORIES.map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="control filter-select" value={`${sort}:${dir}`} onChange={(event) => {
            const [nextSort, nextDir] = event.target.value.split(':');
            setSort(nextSort);
            setDir(nextDir);
          }}>
            {SORT_OPTIONS.map((option) => (
              <option value={`${option.value}:asc`} key={option.value}>
                {option.label}
              </option>
            ))}
            <option value="quantity:desc">Highest quantity</option>
            <option value="updated:desc">Least recently updated</option>
          </select>
          <div className="toolbar-spacer" />
          {activeFilters ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              <i className="bi bi-x-circle" />
              Clear filters
            </button>
          ) : null}
          <div className="view-toggle">
            <button type="button" className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label="Grid view">
              <i className="bi bi-grid-3x3-gap" />
            </button>
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view">
              <i className="bi bi-list-ul" />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 18px 14px' }}>
          <FilterTabs
            options={STATUS_TABS.map((tab) => ({
              ...tab,
              count:
                tab.value === 'all'
                  ? stats.total
                  : tab.value === 'low'
                    ? stats.lowStock
                    : tab.value === 'out'
                      ? stats.outOfStock
                      : undefined,
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
          <PageLoader label="Loading inventory…" />
        ) : items.length ? (
          view === 'grid' ? (
            <div className="product-grid">
              {items.map((product) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  actions={canManage ? <ActionMenu items={actionItems(product)} /> : null}
                />
              ))}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Main store</th>
                    <th>Branch</th>
                    <th>Unit cost</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((product) => (
                    <tr
                      key={product._id}
                      className="is-clickable"
                      onClick={() => navigate(`/products/${product._id}`)}
                      {...interactiveProps(() => navigate(`/products/${product._id}`), `Open ${product.name}`)}
                    >
                      <td>
                        <div className="table-media">
                          <ProductThumb product={product} />
                          <div>
                            <Link
                              to={`/products/${product._id}`}
                              className="cell-title"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {product.name}
                            </Link>
                            <p className="cell-sub">
                              {product.sku} · {product.storageLocation || 'No storage location'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td><CategoryTag category={product.category} /></td>
                      <td className="num cell-strong">{formatNumber(product.quantity)} {product.unit}</td>
                      <td className="num">{formatNumber(product.branchQuantity)} {product.unit}</td>
                      <td className="num">{formatCurrency(product.unitCost)}</td>
                      <td><StockBadge product={product} /></td>
                      <td
                        className="text-end"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {canManage ? <ActionMenu items={actionItems(product)} /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <EmptyState
            icon="bi-box-seam"
            title="No products match those filters"
            message="Try a different search term, or add the first product to start tracking stock."
            action={
              canManage ? (
                <button type="button" className="btn btn-brand" onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <i className="bi bi-plus-lg" />
                  Add a product
                </button>
              ) : null
            }
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={12}
          onChange={setPage}
          noun="products"
        />
      </Panel>

      <ProductFormDrawer
        open={formOpen}
        product={editing}
        onClose={closeForm}
        onSaved={() => load()}
      />
      <AdjustStockDrawer
        open={Boolean(adjusting)}
        product={adjusting}
        onClose={() => setAdjusting(null)}
        onSaved={() => load()}
      />

      <ConfirmDialog
        open={Boolean(archiving)}
        onClose={() => setArchiving(null)}
        onConfirm={archive}
        busy={archiveBusy}
        title="Archive this product?"
        message={
          archiving
            ? `${archiving.name} will be hidden from active inventory, but its purchase, issue and ledger history is preserved. You can restore it later.`
            : ''
        }
        confirmLabel="Archive product"
        tone="warn"
      />
    </div>
  );
}

function ProductCard({ product, actions }) {
  const meta = CATEGORY_META[product.category] || CATEGORY_META.Other;
  const navigate = useNavigate();
  const open = () => navigate(`/products/${product._id}`);
  return (
    <article
      className="product-card is-interactive"
      onClick={open}
      {...interactiveProps(open, `Open ${product.name}`)}
    >
      <Link
        to={`/products/${product._id}`}
        className="product-cover"
        aria-label={product.name}
        onClick={(event) => event.stopPropagation()}
      >
        <ProductThumb product={product} size="xl" />
        <span className="cover-badge">
          <i className={`bi ${meta.icon}`} />
          {product.category}
        </span>
        <span className="cover-icon">
          <i className="bi bi-arrow-up-right" />
        </span>
      </Link>
      <div className="product-card-body">
        <div className="hstack" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h3>{product.name}</h3>
            <p className="product-sku">
              <i className="bi bi-upc" />
              {product.sku}
              {product.storageLocation ? <> · {product.storageLocation}</> : null}
            </p>
          </div>
          {actions ? (
            <span
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              style={{ display: 'inline-flex' }}
            >
              {actions}
            </span>
          ) : null}
        </div>

        <div className="product-figures">
          <div className="product-figure">
            <span>Main store</span>
            <strong className={product.quantity <= 0 ? 'danger' : product.quantity <= product.reorderLevel ? 'warn' : ''}>
              {formatNumber(product.quantity)} <small>{product.unit}</small>
            </strong>
          </div>
          <div className="product-figure">
            <span>Branch</span>
            <strong>
              {formatNumber(product.branchQuantity)} <small>{product.unit}</small>
            </strong>
          </div>
          <div className="product-figure">
            <span>Unit cost</span>
            <strong>{formatCurrency(product.unitCost)}</strong>
          </div>
        </div>
      </div>
      <div className="product-card-foot">
        <StockIndicator product={product} />
        <StockBadge product={product} />
      </div>
    </article>
  );
}
