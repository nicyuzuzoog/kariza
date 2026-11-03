import { LEDGER_TYPE_META, ROLE_META } from './constants.js';
import {
  downloadCsvSections,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  titleCase,
} from './format.js';
import { exportPdf } from './pdf.js';

const CURRENCY_NOTE = 'All monetary values are in Rwandan Francs (RWF).';

function authorLine(profile) {
  if (!profile?.name) return 'Mrskariza inventory team';
  const role = ROLE_META[profile.role]?.label || titleCase(profile.role || '');
  return `${profile.name}${role ? ` · ${role}` : ''}`;
}

function periodLabel(range) {
  if (!range?.from || !range?.to) return 'All active records';
  return `${formatDate(range.from)} to ${formatDate(range.to)}`;
}

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function infoSection({ title, period, profile, note, reference }) {
  return {
    title: 'Report information',
    columns: [
      { label: 'Field', key: 'field' },
      { label: 'Details', key: 'value' },
    ],
    rows: [
      { field: 'Report', value: title },
      { field: 'Period', value: period },
      { field: 'Prepared by', value: authorLine(profile) },
      { field: 'Generated', value: formatDateTime(new Date()) },
      { field: 'Reference', value: reference },
      { field: 'Note', value: note },
    ].filter((row) => row.value),
  };
}

const csvSections = (sections) => sections.filter(Boolean);

/* ══════════════════════════════════════════════════════════════════════════
   Stock on hand
   ══════════════════════════════════════════════════════════════════════════ */

function stockStatus(product) {
  if (product.quantity <= 0) return 'Out of stock';
  if (product.quantity <= product.reorderLevel) return 'Low stock';
  return 'In stock';
}

function stockValue(product) {
  return (product.quantity + product.branchQuantity) * product.unitCost;
}

function stockPdf(data, profile) {
  const totals = data.totals || {};
  const categories = data.categories || [];
  const products = data.products || [];
  const reference = `STK-${stamp()}`;

  return {
    fileName: `mrskariza-stock-report-${stamp()}`,
    title: 'Stock on Hand Report',
    subtitle: 'Every active product with store, branch and valuation detail',
    reference,
    preparedBy: authorLine(profile),
    meta: [CURRENCY_NOTE],
    summary: [
      { label: 'Products tracked', value: formatNumber(totals.products || 0), tone: 'brand' },
      { label: 'Main store units', value: formatNumber(totals.mainUnits || 0), tone: 'teal' },
      { label: 'Branch units', value: formatNumber(totals.branchUnits || 0), tone: 'violet' },
      { label: 'Total stock value', value: formatCurrency(totals.value || 0), tone: 'sky' },
      { label: 'Low stock', value: formatNumber(totals.lowStock || 0), tone: 'amber', hint: 'At or below reorder' },
      { label: 'Out of stock', value: formatNumber(totals.outOfStock || 0), tone: 'rose', hint: 'Needs urgent action' },
    ],
    sections: [
      {
        title: 'Totals by category',
        columns: [
          { header: 'Category', key: '_id', width: 150 },
          { header: 'Products', value: (row) => formatNumber(row.products), align: 'right', width: 60 },
          { header: 'Main units', value: (row) => formatNumber(row.mainUnits), align: 'right', width: 75 },
          { header: 'Branch units', value: (row) => formatNumber(row.branchUnits), align: 'right', width: 80 },
          { header: 'Stock value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: categories,
      },
      {
        title: 'Product valuation',
        columns: [
          { header: 'Product', key: 'name', width: 130 },
          { header: 'SKU', key: 'sku', width: 70 },
          { header: 'Category', key: 'category', width: 92 },
          { header: 'Unit', key: 'unit', width: 42 },
          { header: 'Main', value: (row) => formatNumber(row.quantity), align: 'right', width: 45 },
          { header: 'Branch', value: (row) => formatNumber(row.branchQuantity), align: 'right', width: 48 },
          { header: 'Reorder', value: (row) => formatNumber(row.reorderLevel), align: 'right', width: 50 },
          { header: 'Unit cost', value: (row) => formatCurrency(row.unitCost), align: 'right', width: 62 },
          { header: 'Total value', value: (row) => formatCurrency(stockValue(row)), align: 'right', width: 70 },
          { header: 'Stock status', value: stockStatus, width: 70 },
          { header: 'Supplier', value: (row) => row.supplier?.name || 'No supplier' },
        ],
        rows: products,
        empty: 'No active products have been recorded yet.',
      },
    ],
  };
}

function stockCsv(data, profile) {
  const totals = data.totals || {};
  const categories = data.categories || [];
  const products = data.products || [];
  const reference = `STK-${stamp()}`;

  return csvSections([
    infoSection({
      title: 'Stock on Hand Report',
      period: 'Current stock position',
      profile,
      note: CURRENCY_NOTE,
      reference,
    }),
    {
      title: 'Summary totals',
      columns: [
        { label: 'Measure', key: 'label' },
        { label: 'Value', key: 'value' },
      ],
      rows: [
        { label: 'Products tracked', value: totals.products || 0 },
        { label: 'Main store units', value: totals.mainUnits || 0 },
        { label: 'Branch units', value: totals.branchUnits || 0 },
        { label: 'Total stock value (RWF)', value: totals.value || 0 },
        { label: 'Low stock products', value: totals.lowStock || 0 },
        { label: 'Out of stock products', value: totals.outOfStock || 0 },
      ],
    },
    {
      title: 'Totals by category',
      columns: [
        { label: 'Category', key: '_id' },
        { label: 'Products', value: (row) => row.products },
        { label: 'Main units', value: (row) => row.mainUnits },
        { label: 'Branch units', value: (row) => row.branchUnits },
        { label: 'Stock value (RWF)', value: (row) => row.value },
      ],
      rows: categories,
    },
    {
      title: 'Product valuation',
      columns: [
        { label: 'Product', key: 'name' },
        { label: 'SKU', key: 'sku' },
        { label: 'Category', key: 'category' },
        { label: 'Unit', key: 'unit' },
        { label: 'Main store quantity', value: (row) => row.quantity },
        { label: 'Branch quantity', value: (row) => row.branchQuantity },
        { label: 'Reorder level', value: (row) => row.reorderLevel },
        { label: 'Unit cost (RWF)', value: (row) => row.unitCost },
        { label: 'Total value (RWF)', value: (row) => stockValue(row) },
        { label: 'Stock status', value: stockStatus },
        { label: 'Supplier', value: (row) => row.supplier?.name || 'No supplier' },
      ],
      rows: products,
      empty: 'No active products have been recorded yet.',
    },
  ]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Movements
   ══════════════════════════════════════════════════════════════════════════ */

function dailyRows(byDay = []) {
  const map = new Map();
  byDay.forEach((row) => {
    const day = row._id?.day;
    if (!day) return;
    if (!map.has(day)) map.set(day, { day, in: 0, out: 0 });
    map.get(day)[row._id.direction] = row.units;
  });
  return [...map.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((row) => ({ ...row, net: row.in - row.out }));
}

function movementPdf(data, profile) {
  const summary = data.summary || {};
  const days = dailyRows(data.byDay);
  const byType = data.byType || [];
  const byCategory = data.byCategory || [];
  const topProducts = data.topProducts || [];
  const period = periodLabel(data.range);
  const reference = `MOV-${stamp()}`;

  return {
    fileName: `mrskariza-movement-report-${stamp()}`,
    title: 'Stock Movement Report',
    subtitle: `Stock in, stock out and ledger activity · ${period}`,
    reference,
    preparedBy: authorLine(profile),
    meta: [period, CURRENCY_NOTE],
    summary: [
      { label: 'Units received', value: formatNumber(summary.unitsIn || 0), tone: 'teal' },
      { label: 'Purchase value in', value: formatCurrency(summary.valueIn || 0), tone: 'sky' },
      { label: 'Units issued', value: formatNumber(summary.unitsOut || 0), tone: 'amber' },
      { label: 'Issued value out', value: formatCurrency(summary.valueOut || 0), tone: 'rose' },
      { label: 'Ledger entries', value: formatNumber(summary.entries || 0), tone: 'brand' },
      {
        label: 'Net units',
        value: formatNumber((summary.unitsIn || 0) - (summary.unitsOut || 0)),
        tone: 'violet',
        hint: 'Received minus issued',
      },
    ],
    sections: [
      {
        title: 'Daily movement',
        columns: [
          { header: 'Date', value: (row) => formatDate(row.day), width: 140 },
          { header: 'Units in', value: (row) => formatNumber(row.in), align: 'right', width: 90 },
          { header: 'Units out', value: (row) => formatNumber(row.out), align: 'right', width: 90 },
          { header: 'Net units', value: (row) => formatNumber(row.net), align: 'right', width: 90 },
        ],
        rows: days,
        empty: 'No movements were recorded for this period.',
      },
      {
        title: 'Movement by type',
        columns: [
          {
            header: 'Movement type',
            value: (row) => LEDGER_TYPE_META[row._id]?.label || titleCase(row._id || 'Other'),
            width: 150,
          },
          { header: 'Direction', value: (row) => (row.direction === 'out' ? 'Stock out' : 'Stock in'), width: 80 },
          { header: 'Entries', value: (row) => formatNumber(row.entries), align: 'right', width: 70 },
          { header: 'Units', value: (row) => formatNumber(row.units), align: 'right', width: 70 },
          { header: 'Value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: byType,
        empty: 'No movement types for this period.',
      },
      {
        title: 'Movement by category',
        columns: [
          { header: 'Category', key: '_id', width: 170 },
          { header: 'Units in', value: (row) => formatNumber(row.unitsIn), align: 'right', width: 80 },
          { header: 'Units out', value: (row) => formatNumber(row.unitsOut), align: 'right', width: 80 },
          { header: 'Value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: byCategory,
        empty: 'No category movement for this period.',
      },
      {
        title: 'Top products by movement',
        columns: [
          { header: 'Product', key: 'name', width: 190 },
          { header: 'Unit', key: 'unit', width: 60 },
          { header: 'Units in', value: (row) => formatNumber(row.unitsIn), align: 'right', width: 75 },
          { header: 'Units out', value: (row) => formatNumber(row.unitsOut), align: 'right', width: 75 },
          { header: 'Total moved', value: (row) => formatNumber(row.unitsIn + row.unitsOut), align: 'right', width: 80 },
          { header: 'Value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: topProducts,
        empty: 'No product movement for this period.',
      },
    ],
  };
}

function movementCsv(data, profile) {
  const summary = data.summary || {};
  const days = dailyRows(data.byDay);
  const byType = data.byType || [];
  const byCategory = data.byCategory || [];
  const topProducts = data.topProducts || [];
  const period = periodLabel(data.range);
  const reference = `MOV-${stamp()}`;

  return csvSections([
    infoSection({
      title: 'Stock Movement Report',
      period,
      profile,
      note: CURRENCY_NOTE,
      reference,
    }),
    {
      title: 'Summary totals',
      columns: [
        { label: 'Measure', key: 'label' },
        { label: 'Value', key: 'value' },
      ],
      rows: [
        { label: 'Units received', value: summary.unitsIn || 0 },
        { label: 'Purchase value in (RWF)', value: summary.valueIn || 0 },
        { label: 'Units issued', value: summary.unitsOut || 0 },
        { label: 'Issued value out (RWF)', value: summary.valueOut || 0 },
        { label: 'Ledger entries', value: summary.entries || 0 },
        { label: 'Net units', value: (summary.unitsIn || 0) - (summary.unitsOut || 0) },
      ],
    },
    {
      title: 'Daily movement',
      columns: [
        { label: 'Date', value: (row) => formatDate(row.day) },
        { label: 'Units in', value: (row) => row.in },
        { label: 'Units out', value: (row) => row.out },
        { label: 'Net units', value: (row) => row.net },
      ],
      rows: days,
      empty: 'No movements were recorded for this period.',
    },
    {
      title: 'Movement by type',
      columns: [
        { label: 'Movement type', value: (row) => LEDGER_TYPE_META[row._id]?.label || titleCase(row._id || 'Other') },
        { label: 'Direction', value: (row) => (row.direction === 'out' ? 'Stock out' : 'Stock in') },
        { label: 'Entries', value: (row) => row.entries },
        { label: 'Units', value: (row) => row.units },
        { label: 'Value (RWF)', value: (row) => row.value },
      ],
      rows: byType,
      empty: 'No movement types for this period.',
    },
    {
      title: 'Movement by category',
      columns: [
        { label: 'Category', key: '_id' },
        { label: 'Units in', value: (row) => row.unitsIn },
        { label: 'Units out', value: (row) => row.unitsOut },
        { label: 'Value (RWF)', value: (row) => row.value },
      ],
      rows: byCategory,
      empty: 'No category movement for this period.',
    },
    {
      title: 'Top products by movement',
      columns: [
        { label: 'Product', key: 'name' },
        { label: 'Unit', key: 'unit' },
        { label: 'Units in', value: (row) => row.unitsIn },
        { label: 'Units out', value: (row) => row.unitsOut },
        { label: 'Total moved', value: (row) => row.unitsIn + row.unitsOut },
        { label: 'Value (RWF)', value: (row) => row.value },
      ],
      rows: topProducts,
      empty: 'No product movement for this period.',
    },
  ]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Consumption
   ══════════════════════════════════════════════════════════════════════════ */

function consumptionPdf(data, profile) {
  const summary = data.summary || {};
  const byDepartment = data.byDepartment || [];
  const byProduct = data.byProduct || [];
  const byRecipientType = data.byRecipientType || [];
  const period = periodLabel(data.range);
  const reference = `CON-${stamp()}`;
  const totalUnits = summary.units || byProduct.reduce((sum, row) => sum + row.units, 0) || 1;

  return {
    fileName: `mrskariza-consumption-report-${stamp()}`,
    title: 'Consumption Report',
    subtitle: `Food and supplies issued to classes and departments · ${period}`,
    reference,
    preparedBy: authorLine(profile),
    meta: [period, 'Only completed issues are counted. Voided records are excluded.', CURRENCY_NOTE],
    summary: [
      { label: 'Units consumed', value: formatNumber(summary.units || 0), tone: 'brand' },
      { label: 'Consumption value', value: formatCurrency(summary.value || 0), tone: 'teal' },
      { label: 'Issue records', value: formatNumber(summary.records || 0), tone: 'violet' },
      { label: 'Products issued', value: formatNumber(byProduct.length || 0), tone: 'amber' },
      { label: 'Recipient groups', value: formatNumber(byDepartment.length || 0), tone: 'sky' },
    ],
    sections: [
      {
        title: 'Consumption by department / class',
        columns: [
          { header: 'Department / class', key: '_id', width: 230 },
          { header: 'Issue records', value: (row) => formatNumber(row.records), align: 'right', width: 90 },
          { header: 'Units issued', value: (row) => formatNumber(row.units), align: 'right', width: 90 },
          { header: 'Share of units', value: (row) => `${Math.round((row.units / totalUnits) * 100)}%`, align: 'right', width: 90 },
          { header: 'Value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: byDepartment,
        empty: 'No consumption was recorded for this period.',
      },
      {
        title: 'Consumption by product',
        columns: [
          { header: 'Product', key: 'name', width: 230 },
          { header: 'Unit', key: 'unit', width: 65 },
          { header: 'Units issued', value: (row) => formatNumber(row.units), align: 'right', width: 95 },
          { header: 'Share of units', value: (row) => `${Math.round((row.units / totalUnits) * 100)}%`, align: 'right', width: 95 },
          { header: 'Estimated value', value: (row) => formatCurrency(row.value), align: 'right' },
        ],
        rows: byProduct,
        empty: 'No products were issued for this period.',
      },
      {
        title: 'Consumption by recipient type',
        columns: [
          { header: 'Recipient type', value: (row) => titleCase(row._id || 'Other'), width: 200 },
          { header: 'Issue records', value: (row) => formatNumber(row.records), align: 'right', width: 110 },
          { header: 'Units issued', value: (row) => formatNumber(row.units), align: 'right', width: 110 },
          { header: 'Share of units', value: (row) => `${Math.round((row.units / totalUnits) * 100)}%`, align: 'right' },
        ],
        rows: byRecipientType,
        empty: 'No recipient data for this period.',
      },
    ],
  };
}

function consumptionCsv(data, profile) {
  const summary = data.summary || {};
  const byDepartment = data.byDepartment || [];
  const byProduct = data.byProduct || [];
  const byRecipientType = data.byRecipientType || [];
  const period = periodLabel(data.range);
  const reference = `CON-${stamp()}`;
  const totalUnits = summary.units || byProduct.reduce((sum, row) => sum + row.units, 0) || 1;

  return csvSections([
    infoSection({
      title: 'Consumption Report',
      period,
      profile,
      note: 'Only completed issues are counted. Voided records are excluded. All monetary values are in RWF.',
      reference,
    }),
    {
      title: 'Summary totals',
      columns: [
        { label: 'Measure', key: 'label' },
        { label: 'Value', key: 'value' },
      ],
      rows: [
        { label: 'Units consumed', value: summary.units || 0 },
        { label: 'Consumption value (RWF)', value: summary.value || 0 },
        { label: 'Issue records', value: summary.records || 0 },
        { label: 'Products issued', value: byProduct.length },
        { label: 'Recipient groups', value: byDepartment.length },
      ],
    },
    {
      title: 'Consumption by department / class',
      columns: [
        { label: 'Department / class', key: '_id' },
        { label: 'Issue records', value: (row) => row.records },
        { label: 'Units issued', value: (row) => row.units },
        { label: 'Share of units (%)', value: (row) => Math.round((row.units / totalUnits) * 100) },
        { label: 'Value (RWF)', value: (row) => row.value },
      ],
      rows: byDepartment,
      empty: 'No consumption was recorded for this period.',
    },
    {
      title: 'Consumption by product',
      columns: [
        { label: 'Product', key: 'name' },
        { label: 'Unit', key: 'unit' },
        { label: 'Units issued', value: (row) => row.units },
        { label: 'Share of units (%)', value: (row) => Math.round((row.units / totalUnits) * 100) },
        { label: 'Estimated value (RWF)', value: (row) => row.value },
      ],
      rows: byProduct,
      empty: 'No products were issued for this period.',
    },
    {
      title: 'Consumption by recipient type',
      columns: [
        { label: 'Recipient type', value: (row) => titleCase(row._id || 'Other') },
        { label: 'Issue records', value: (row) => row.records },
        { label: 'Units issued', value: (row) => row.units },
        { label: 'Share of units (%)', value: (row) => Math.round((row.units / totalUnits) * 100) },
      ],
      rows: byRecipientType,
      empty: 'No recipient data for this period.',
    },
  ]);
}

/* ══════════════════════════════════════════════════════════════════════════
   Public helpers
   ══════════════════════════════════════════════════════════════════════════ */

const CSV_BUILDERS = {
  stock: stockCsv,
  movements: movementCsv,
  consumption: consumptionCsv,
};

const PDF_BUILDERS = {
  stock: stockPdf,
  movements: movementPdf,
  consumption: consumptionPdf,
};

export async function exportReportPdf(tab, data, profile) {
  const builder = PDF_BUILDERS[tab];
  if (!builder || !data) throw new Error('There is no report data to export yet.');
  await exportPdf(builder(data, profile));
}

export function exportReportCsv(tab, data, profile) {
  const builder = CSV_BUILDERS[tab];
  if (!builder || !data) throw new Error('There is no report data to export yet.');
  const reference = { stock: 'STK', movements: 'MOV', consumption: 'CON' }[tab] || 'RPT';
  downloadCsvSections(`mrskariza-${tab}-report-${stamp()}.csv`, builder(data, profile, reference));
}
