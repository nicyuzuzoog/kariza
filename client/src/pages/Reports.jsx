import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { api, CATEGORY_META, LEDGER_TYPE_META } from '../utils/constants.js';
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatNumber,
  getErrorMessage,
  titleCase,
  toInputDate,
} from '../utils/format.js';
import { exportReportCsv, exportReportPdf } from '../utils/reports.js';
import {
  CrumbBar,
  EmptyState,
  InlineAlert,
  PageLoader,
  PageTabs,
  Panel,
  Pill,
  StatCard,
} from '../components/ui.jsx';

const TABS = [
  { value: 'stock', label: 'Stock on hand', icon: 'bi-boxes' },
  { value: 'movements', label: 'Movements', icon: 'bi-activity' },
  { value: 'consumption', label: 'Consumption', icon: 'bi-pie-chart' },
];

const CHART_COLORS = { in: '#4f46e5', out: '#14b8a6' };

function rangeDefaults() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return { from: toInputDate(start), to: toInputDate(end) };
}

export default function Reports() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('stock');
  const [range, setRange] = useState(rangeDefaults);
  const [stock, setStock] = useState(null);
  const [movements, setMovements] = useState(null);
  const [consumption, setConsumption] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const loadStock = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/reports/stock');
      setStock(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/reports/movements', { params: range });
      setMovements(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [range]);

  const loadConsumption = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/reports/consumption', { params: range });
      setConsumption(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    if (tab === 'stock') loadStock();
    else if (tab === 'movements') loadMovements();
    else loadConsumption();
  }, [tab, loadStock, loadMovements, loadConsumption]);

  const preset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setRange({ from: toInputDate(start), to: toInputDate(end) });
  };

  const movementSeries = useMemo(() => {
    const map = new Map();
    (movements?.byDay || []).forEach((row) => {
      const day = row._id.day;
      if (!map.has(day)) map.set(day, { day, label: formatDate(day).slice(0, 6), in: 0, out: 0 });
      map.get(day)[row._id.direction] = row.units;
    });
    return [...map.values()];
  }, [movements]);

  const exportReport = async (format) => {
    const data = tab === 'stock' ? stock : tab === 'movements' ? movements : consumption;
    if (!data) return;

    setExporting(format);
    try {
      if (format === 'pdf') {
        await exportReportPdf(tab, data, user);
        toast.success('PDF report ready', 'A designed, print-ready PDF has been downloaded.');
      } else {
        exportReportCsv(tab, data, user);
        toast.success('CSV report ready', 'The full-detail CSV has been downloaded.');
      }
    } catch (exportError) {
      toast.error('Export failed', getErrorMessage(exportError));
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="fade-up">
      <CrumbBar items={[{ label: 'Insights' }, { label: 'Reports' }]} />

      <div className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow">
            <i className="bi bi-graph-up-arrow" />
            Analysis & accountability
          </span>
          <h1 className="page-title">Inventory reports</h1>
          <p className="page-sub">
            Understand what the school holds, how stock is moving, and where food and supplies are being
            consumed. Every report can be exported for meetings or audits.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-outline-soft"
            onClick={() => exportReport('csv')}
            disabled={loading || Boolean(exporting) || !(tab === 'stock' ? stock : tab === 'movements' ? movements : consumption)}
          >
            {exporting === 'csv' ? <span className="spinner-ring sm" /> : <i className="bi bi-filetype-csv" />}
            {exporting === 'csv' ? 'Building CSV…' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="btn btn-brand"
            onClick={() => exportReport('pdf')}
            disabled={loading || Boolean(exporting) || !(tab === 'stock' ? stock : tab === 'movements' ? movements : consumption)}
          >
            {exporting === 'pdf' ? <span className="spinner-ring sm" /> : <i className="bi bi-file-earmark-pdf" />}
            {exporting === 'pdf' ? 'Designing PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <div className="hstack wrap" style={{ justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <PageTabs tabs={TABS} value={tab} onChange={setTab} />
        {tab !== 'stock' ? (
          <div className="hstack wrap" style={{ gap: 10 }}>
            <div className="date-range">
              <span>From</span>
              <input type="date" className="control" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
              <span>To</span>
              <input type="date" className="control" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
            </div>
            <div className="preset-btns">
              <button type="button" onClick={() => preset(7)}>7d</button>
              <button type="button" onClick={() => preset(30)} className={!range.from ? 'active' : ''}>30d</button>
              <button type="button" onClick={() => preset(90)}>90d</button>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <Panel title="Report unavailable" icon="bi-exclamation-octagon">
          <InlineAlert type="error">{error}</InlineAlert>
          <button type="button" className="btn btn-brand" style={{ marginTop: 12 }} onClick={() => (tab === 'stock' ? loadStock() : tab === 'movements' ? loadMovements() : loadConsumption())}>
            <i className="bi bi-arrow-clockwise" />
            Try again
          </button>
        </Panel>
      ) : loading ? (
        <PageLoader label="Building your report…" />
      ) : tab === 'stock' ? (
        <StockReport data={stock} />
      ) : tab === 'movements' ? (
        <MovementReport data={movements} series={movementSeries} />
      ) : (
        <ConsumptionReport data={consumption} />
      )}
    </div>
  );
}

function StockReport({ data }) {
  if (!data) return null;
  const totals = data.totals || {};
  const categories = data.categories || [];
  const products = data.products || [];
  const maxValue = categories[0]?.value || 1;

  return (
    <>
      <div className="stat-grid stagger">
        <StatCard icon="bi-boxes" tone="brand" label="Products tracked" value={formatNumber(totals.products || 0)} meta={<><strong>{formatNumber(totals.mainUnits || 0)}</strong> units in main store</>} />
        <StatCard icon="bi-buildings" tone="violet" label="Branch units" value={formatNumber(totals.branchUnits || 0)} meta={<>Held at the branch campus</>} />
        <StatCard icon="bi-cash-stack" tone="teal" label="Total stock value" value={formatCurrency(totals.value || 0)} meta={<>Valued at current unit cost</>} />
        <StatCard icon="bi-exclamation-triangle" tone="amber" label="Stock risks" value={formatNumber((totals.lowStock || 0) + (totals.outOfStock || 0))} meta={<><span className="down">{formatNumber(totals.outOfStock || 0)} out of stock</span></>} />
      </div>

      <div className="report-layout mt-3">
        <Panel title="Value by category" icon="bi-pie-chart" sub="Where the school’s stock value sits" bodyClassName="panel-body">
          {categories.length ? (
            <div className="vstack" style={{ gap: 14 }}>
              {categories.map((category) => (
                <div key={category._id}>
                  <div className="report-bar-row">
                    <div className="report-bar-label">
                      <i className={`bi ${CATEGORY_META[category._id]?.icon || 'bi-box-seam'}`} />
                      <span className="truncate">{category._id}</span>
                    </div>
                    <div className="report-bar-track">
                      <div className="report-bar-fill" style={{ width: `${Math.max(3, (category.value / maxValue) * 100)}%` }} />
                    </div>
                    <div className="report-bar-value">{formatCompact(category.value)}</div>
                  </div>
                  <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '3px 0 0 22px' }}>
                    {formatNumber(category.products)} products · {formatNumber(category.mainUnits + category.branchUnits)} units
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="bi-pie-chart" title="No stock to analyse" message="Add products to generate this report." />
          )}
        </Panel>

        <Panel title="Stock health summary" icon="bi-clipboard2-pulse" sub="How the catalogue is holding up" bodyClassName="panel-body">
          <div className="report-totals">
            <div className="report-total">
              <span>Total products</span>
              <strong>{formatNumber(totals.products || 0)}</strong>
            </div>
            <div className="report-total">
              <span>Main store units</span>
              <strong>{formatNumber(totals.mainUnits || 0)}</strong>
            </div>
            <div className="report-total">
              <span>Branch units</span>
              <strong>{formatNumber(totals.branchUnits || 0)}</strong>
            </div>
            <div className="report-total">
              <span>At or below reorder</span>
              <strong className="amber">{formatNumber(totals.lowStock || 0)}</strong>
            </div>
            <div className="report-total">
              <span>Fully out of stock</span>
              <strong className="rose">{formatNumber(totals.outOfStock || 0)}</strong>
            </div>
          </div>
          <div className="soft-note gray mt-3">
            <i className="bi bi-info-circle" />
            <span>Low-stock counts are based on the main campus store only, matching the automatic alerts.</span>
          </div>
        </Panel>
      </div>

      <Panel title="Stock valuation" icon="bi-table" sub="Every active product, lowest balance first" bodyClassName="panel-body tight" className="mt-3">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Main</th>
                <th>Branch</th>
                <th>Reorder</th>
                <th>Unit cost</th>
                <th className="text-end">Value</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const state = product.quantity <= 0 ? 'out' : product.quantity <= product.reorderLevel ? 'low' : 'ok';
                return (
                  <tr key={product._id}>
                    <td>
                      <p className="cell-title">{product.name}</p>
                      <p className="cell-sub">{product.sku} · {product.supplier?.name || 'No supplier'}</p>
                    </td>
                    <td>{product.category}</td>
                    <td className="num cell-strong">{formatNumber(product.quantity)} {product.unit}</td>
                    <td className="num">{formatNumber(product.branchQuantity)} {product.unit}</td>
                    <td className="num">{formatNumber(product.reorderLevel)}</td>
                    <td className="num">{formatCurrency(product.unitCost)}</td>
                    <td className="text-end num cell-strong">{formatCurrency((product.quantity + product.branchQuantity) * product.unitCost)}</td>
                    <td><Pill tone={state === 'out' ? 'danger' : state === 'low' ? 'warn' : 'success'} dot>{state === 'out' ? 'Out' : state === 'low' ? 'Low' : 'OK'}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!products.length ? <EmptyState icon="bi-box" title="No products in stock" message="Add inventory to see the valuation." /> : null}
      </Panel>
    </>
  );
}

function MovementReport({ data, series }) {
  if (!data) return null;
  const summary = data.summary || {};
  const byType = data.byType || [];
  const topProducts = data.topProducts || [];
  const maxType = Math.max(...byType.map((row) => row.units), 1);
  const maxProduct = Math.max(...topProducts.map((row) => row.unitsIn + row.unitsOut), 1);

  return (
    <>
      <div className="stat-grid stagger">
        <StatCard icon="bi-arrow-down-circle" tone="teal" label="Units received" value={formatNumber(summary.unitsIn || 0)} meta={<><strong>{formatCurrency(summary.valueIn || 0)}</strong> purchase value</>} />
        <StatCard icon="bi-arrow-up-circle" tone="amber" label="Units issued" value={formatNumber(summary.unitsOut || 0)} meta={<><strong>{formatCurrency(summary.valueOut || 0)}</strong> issued value</>} />
        <StatCard icon="bi-journal-text" tone="brand" label="Ledger entries" value={formatNumber(summary.entries || 0)} meta={<>Every recorded stock movement</>} />
        <StatCard icon="bi-columns-gap" tone="violet" label="Net units" value={formatNumber((summary.unitsIn || 0) - (summary.unitsOut || 0))} meta={<>Movement during this period</>} />
      </div>

      <Panel title="Daily movement" icon="bi-activity" sub={`${formatDate(data.range?.from)} – ${formatDate(data.range?.to)}`} bodyClassName="panel-body tight" className="mt-3">
        {series.length ? (
          <div className="chart-height">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 18, right: 16, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.in} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.in} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="reportOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.out} stopOpacity={0.26} />
                    <stop offset="100%" stopColor={CHART_COLORS.out} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f7" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#94a3b8' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#94a3b8' }} width={44} />
                <Tooltip formatter={(value, name) => [`${formatNumber(value)} units`, name === 'in' ? 'Stock in' : 'Stock out']} />
                <Area type="monotone" dataKey="in" stroke={CHART_COLORS.in} strokeWidth={2.2} fill="url(#reportIn)" />
                <Area type="monotone" dataKey="out" stroke={CHART_COLORS.out} strokeWidth={2.2} fill="url(#reportOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon="bi-activity" title="No movements in this period" message="Try a wider date range." />
        )}
      </Panel>

      <div className="dash-grid mt-3">
        <Panel title="Movement by type" icon="bi-diagram-3" sub="Where stock changes came from" bodyClassName="panel-body">
          {byType.length ? (
            <div className="vstack" style={{ gap: 14 }}>
              {byType.map((row) => {
                const meta = LEDGER_TYPE_META[row._id] || { label: titleCase(row._id || 'Movement'), tone: 'neutral' };
                return (
                  <div key={row._id}>
                    <div className="report-bar-row">
                      <div className="report-bar-label"><span className="truncate">{meta.label}</span></div>
                      <div className="report-bar-track">
                        <div className={`report-bar-fill ${row.direction === 'out' ? 'rose' : 'teal'}`} style={{ width: `${Math.max(3, (row.units / maxType) * 100)}%` }} />
                      </div>
                      <div className="report-bar-value">{formatNumber(row.units)}</div>
                    </div>
                    <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '3px 0 0' }}>{row.entries} entries · {formatCurrency(row.value)}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="bi-diagram-3" title="Nothing to show" message="No movement types in this period." />
          )}
        </Panel>

        <Panel title="Busiest products" icon="bi-trophy" sub="Highest total movement in the period" bodyClassName="panel-body">
          {topProducts.length ? (
            <div className="rank-list">
              {topProducts.slice(0, 8).map((row, index) => {
                const totalUnits = row.unitsIn + row.unitsOut;
                return (
                  <div className="rank-item" key={`${row.name}-${index}`}>
                    <span className="rank-number">{index + 1}</span>
                    <div className="rank-main">
                      <div className="rank-label">
                        <span className="truncate">{row.name}</span>
                        <strong>{formatNumber(totalUnits)} {row.unit}</strong>
                      </div>
                      <div className="rank-bar"><span style={{ width: `${Math.max(4, (totalUnits / maxProduct) * 100)}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon="bi-trophy" title="No product movement" message="Try a different date range." />
          )}
        </Panel>
      </div>
    </>
  );
}

function ConsumptionReport({ data }) {
  if (!data) return null;
  const summary = data.summary || {};
  const byDepartment = data.byDepartment || [];
  const byProduct = data.byProduct || [];
  const byRecipientType = data.byRecipientType || [];
  const maxDept = Math.max(...byDepartment.map((row) => row.units), 1);

  return (
    <>
      <div className="stat-grid stagger">
        <StatCard icon="bi-box-arrow-up" tone="brand" label="Units consumed" value={formatNumber(summary.units || 0)} meta={<><strong>{formatNumber(summary.records || 0)}</strong> issue records</>} />
        <StatCard icon="bi-cash-stack" tone="teal" label="Consumption value" value={formatCurrency(summary.value || 0)} meta={<>Valued at issue unit cost</>} />
        <StatCard icon="bi-people" tone="violet" label="Recipient groups" value={formatNumber(byDepartment.length || 0)} meta={<>Classes or departments served</>} />
        <StatCard icon="bi-boxes" tone="amber" label="Products issued" value={formatNumber(byProduct.length || 0)} meta={<>Distinct items consumed</>} />
      </div>

      <div className="dash-grid mt-3">
        <Panel title="Consumption by department / class" icon="bi-people" sub="Who received the most units" bodyClassName="panel-body">
          {byDepartment.length ? (
            <div className="vstack" style={{ gap: 14 }}>
              {byDepartment.slice(0, 10).map((row) => (
                <div key={row._id}>
                  <div className="report-bar-row">
                    <div className="report-bar-label"><span className="truncate">{row._id}</span></div>
                    <div className="report-bar-track">
                      <div className="report-bar-fill" style={{ width: `${Math.max(3, (row.units / maxDept) * 100)}%` }} />
                    </div>
                    <div className="report-bar-value">{formatNumber(row.units)}</div>
                  </div>
                  <p style={{ fontSize: 10.5, color: 'var(--muted)', margin: '3px 0 0' }}>{row.records} records · {formatCurrency(row.value)}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="bi-people" title="No consumption recorded" message="Issues in this period will appear here." />
          )}
        </Panel>

        <Panel title="Recipient mix" icon="bi-pie-chart" sub="Units by recipient type" bodyClassName="panel-body">
          {byRecipientType.length ? (
            <div className="vstack" style={{ gap: 12 }}>
              {byRecipientType.map((row) => (
                <div className="kv-row" key={row._id}>
                  <span className="k">{titleCase(row._id || 'Other')}</span>
                  <span className="v">
                    {formatNumber(row.units)} units · {row.records} records
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="bi-pie-chart" title="No recipient data" message="Try a wider date range." />
          )}
          <div className="soft-note gray mt-3">
            <i className="bi bi-info-circle" />
            <span>Only completed issues are counted. Voided records are excluded from consumption totals.</span>
          </div>
        </Panel>
      </div>

      <Panel title="Product consumption" icon="bi-basket" sub="Highest usage in the selected period" bodyClassName="panel-body tight" className="mt-3">
        {byProduct.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="text-end">Units issued</th>
                  <th className="text-end">Estimated value</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((row) => {
                  const max = byProduct[0]?.units || 1;
                  return (
                    <tr key={`${row.name}-${row.unit}`}>
                      <td className="cell-title">{row.name}</td>
                      <td className="text-end num cell-strong">{formatNumber(row.units)} {row.unit}</td>
                      <td className="text-end num">{formatCurrency(row.value)}</td>
                      <td style={{ width: 180 }}>
                        <div className="report-bar-track">
                          <div className="report-bar-fill teal" style={{ width: `${Math.max(3, (row.units / max) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="bi-basket" title="No issues in this period" message="Once items are issued, product usage appears here." />
        )}
      </Panel>
    </>
  );
}
