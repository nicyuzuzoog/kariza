import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext.jsx';
import useDebouncedValue from '../hooks/useDebouncedValue.js';
import useProducts from '../hooks/useProducts.js';
import { api, BRANCH_LABELS, LEDGER_TYPE_META } from '../utils/constants.js';
import {
  downloadCsv,
  formatCurrency,
  formatDateTime,
  formatNumber,
  getErrorMessage,
  toInputDate,
} from '../utils/format.js';
import {
  CrumbBar,
  EmptyState,
  InlineAlert,
  PageLoader,
  Pagination,
  Panel,
  Pill,
  SearchInput,
  StatCard,
} from '../components/ui.jsx';

const TYPE_OPTIONS = Object.entries(LEDGER_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export default function Ledger() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [type, setType] = useState('');
  const [direction, setDirection] = useState('');
  const [location, setLocation] = useState('');
  const [product, setProduct] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, pages: 1, totals: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { products } = useProducts({ activeOnly: false });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: response } = await api.get('/ledger', {
        params: {
          search: debouncedSearch.trim(),
          type,
          direction,
          location,
          product,
          from,
          to,
          page,
          limit: 15,
        },
      });
      setData(response);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, type, direction, location, product, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, direction, location, product, from, to]);

  const items = data.items || [];
  const totals = data.totals || {};

  const reset = () => {
    setSearch('');
    setType('');
    setDirection('');
    setLocation('');
    setProduct('');
    setFrom('');
    setTo('');
  };

  const quickRange = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setFrom(toInputDate(start));
    setTo(toInputDate(end));
  };

  const exportCsv = () => {
    downloadCsv(
      `mrskariza-ledger-${new Date().toISOString().slice(0, 10)}`,
      [
        { label: 'Date', value: (row) => formatDateTime(row.createdAt) },
        { label: 'Type', value: (row) => LEDGER_TYPE_META[row.type]?.label || row.type },
        { label: 'Direction', key: 'direction' },
        { label: 'Product', key: 'productName' },
        { label: 'SKU', key: 'sku' },
        { label: 'Quantity', key: 'quantity' },
        { label: 'Unit', key: 'unit' },
        { label: 'Store', value: (row) => BRANCH_LABELS[row.location] },
        { label: 'Unit cost', key: 'unitCost' },
        { label: 'Total cost', key: 'totalCost' },
        { label: 'Party', key: 'party' },
        { label: 'Reference', key: 'referenceDoc' },
        { label: 'Note', key: 'note' },
        { label: 'Performed by', value: (row) => row.performedBy?.name || 'System' },
      ],
      items
    );
    toast.success('Export ready', 'The current ledger page has been downloaded as CSV.');
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Insights' }, { label: 'Stock ledger' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-journal-text" />
            Immutable movement history
          </span>
          <h1 className="page-title">Stock ledger</h1>
          <p className="page-sub">
            A permanent, chronological record of every unit that entered, left or moved between stores.
            Each row captures who did it, why, and the resulting balance.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline-soft" onClick={exportCsv} disabled={!items.length}>
            <i className="bi bi-download" />
            Export page
          </button>
        </div>
      </div>

      <div className="stat-grid stagger">
        <StatCard
          icon="bi-arrow-down-circle"
          tone="teal"
          label="Units in (filtered)"
          value={formatNumber(totals.unitsIn || 0)}
          meta={<><strong>{formatCurrency(totals.valueIn || 0)}</strong> received value</>}
        />
        <StatCard
          icon="bi-arrow-up-circle"
          tone="amber"
          label="Units out (filtered)"
          value={formatNumber(totals.unitsOut || 0)}
          meta={<><strong>{formatCurrency(totals.valueOut || 0)}</strong> issued value</>}
        />
        <StatCard
          icon="bi-journal-check"
          tone="brand"
          label="Ledger entries"
          value={formatNumber(data.total || 0)}
          meta={<>Matching your current filters</>}
        />
        <StatCard
          icon="bi-columns-gap"
          tone="violet"
          label="Net movement"
          value={formatNumber((totals.unitsIn || 0) - (totals.unitsOut || 0))}
          meta={<>Units in minus units out</>}
        />
      </div>

      <Panel bodyClassName="panel-body tight">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search product, reference, party or note…" />
          <select className="control filter-select" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All movement types</option>
            {TYPE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select className="control filter-select" value={direction} onChange={(event) => setDirection(event.target.value)}>
            <option value="">In and out</option>
            <option value="in">Stock in</option>
            <option value="out">Stock out</option>
          </select>
          <select className="control filter-select" value={location} onChange={(event) => setLocation(event.target.value)}>
            <option value="">Both stores</option>
            <option value="main">Main campus</option>
            <option value="branch">Branch campus</option>
          </select>
          <select className="control filter-select" value={product} onChange={(event) => setProduct(event.target.value)}>
            <option value="">All products</option>
            {products.map((item) => (
              <option value={item._id} key={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar" style={{ paddingTop: 0 }}>
          <div className="date-range">
            <span>From</span>
            <input type="date" className="control" value={from} onChange={(event) => setFrom(event.target.value)} />
            <span>To</span>
            <input type="date" className="control" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="preset-btns">
            <button type="button" onClick={() => quickRange(7)}>Last 7 days</button>
            <button type="button" onClick={() => quickRange(30)}>30 days</button>
            <button type="button" onClick={() => quickRange(90)}>90 days</button>
          </div>
          <div className="toolbar-spacer" />
          <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
            <i className="bi bi-x-circle" />
            Clear filters
          </button>
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
          <PageLoader label="Reading the ledger…" />
        ) : items.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Movement</th>
                  <th>Product</th>
                  <th>Store</th>
                  <th>Party / reference</th>
                  <th className="text-end">In</th>
                  <th className="text-end">Out</th>
                  <th className="text-end">Balance</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const meta = LEDGER_TYPE_META[entry.type] || LEDGER_TYPE_META.adjustment_in;
                  return (
                    <tr key={entry._id}>
                      <td>
                        <p className="cell-title" style={{ fontSize: 11.5 }}>{formatDateTime(entry.createdAt)}</p>
                        <p className="cell-sub mono">{entry.reference}</p>
                      </td>
                      <td>
                        <Pill tone={meta.tone} icon={meta.icon}>
                          {meta.label}
                        </Pill>
                      </td>
                      <td>
                        <p className="cell-title">{entry.productName}</p>
                        <p className="cell-sub">{entry.sku || 'No SKU'}</p>
                      </td>
                      <td>{entry.location === 'branch' ? 'Branch' : 'Main'}</td>
                      <td>
                        <p className="cell-title" style={{ fontSize: 11.5 }}>{entry.party || '—'}</p>
                        <p className="cell-sub mono">{entry.referenceDoc || 'No reference'}</p>
                      </td>
                      <td className="text-end num ledger-in">
                        {entry.direction === 'in' ? `${formatNumber(entry.quantity)} ${entry.unit}` : '—'}
                      </td>
                      <td className="text-end num ledger-out">
                        {entry.direction === 'out' ? `${formatNumber(entry.quantity)} ${entry.unit}` : '—'}
                      </td>
                      <td className="text-end num">
                        {entry.balanceAfter
                          ? `${formatNumber(entry.balanceAfter[entry.location] ?? 0)} ${entry.unit}`
                          : '—'}
                      </td>
                      <td>
                        <p className="cell-title" style={{ fontSize: 11.5 }}>{entry.performedBy?.name || 'System'}</p>
                        <p className="cell-sub">{entry.performedBy?.role ? entry.performedBy.role.replace('_', ' ') : 'automated'}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="bi-journal-text"
            title="No ledger entries found"
            message="Try widening the date range or clearing a few filters. Movements appear here as soon as stock changes."
          />
        )}

        <Pagination
          page={data.page || page}
          pages={data.pages || 1}
          total={data.total || 0}
          limit={15}
          onChange={setPage}
          noun="ledger entries"
        />
      </Panel>

      <div className="soft-note gray mt-3">
        <i className="bi bi-shield-check" />
        <span>
          Ledger entries are append-only. Correcting a mistake means recording a reversal — such as voiding
          an issue or cancelling a transfer — so the full trail remains visible.
        </span>
      </div>
    </div>
  );
}
