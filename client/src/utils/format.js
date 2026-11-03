const currencyFormatter = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 1 });

export const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

export const formatNumber = (value) => numberFormatter.format(Number(value) || 0);

export const formatCompact = (value) => {
  const number = Number(value) || 0;
  if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}k`;
  return numberFormatter.format(number);
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })} · ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
};

export const formatTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export const toInputDate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export const timeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

export const titleCase = (value = '') =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const stockState = (product) => {
  const quantity = product?.quantity ?? 0;
  const reorder = product?.reorderLevel ?? 0;
  if (quantity <= 0) return 'out';
  if (quantity <= reorder) return 'low';
  return 'ok';
};

export const stockPercent = (product) => {
  const quantity = product?.quantity ?? 0;
  const reorder = product?.reorderLevel || 1;
  return Math.min(100, Math.round((quantity / reorder) * 100));
};

export const stockTone = (status) => {
  if (status === 'out') return 'danger';
  if (status === 'low') return 'warn';
  return 'success';
};

export const stockLabel = (status) => {
  if (status === 'out') return 'Out of stock';
  if (status === 'low') return 'Low stock';
  return 'In stock';
};

export const getErrorMessage = (error) => {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return 'Something went wrong';
};

export const getErrorDetails = (error) => {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return [];
  return details;
};

const csvEscape = (value) => {
  const string = value === null || value === undefined ? '' : String(value);
  return `"${string.replace(/"/g, '""')}"`;
};

export const downloadCsv = (filename, columns, rows) => {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const body = (rows || [])
    .map((row) =>
      columns
        .map((column) => {
          const raw = typeof column.value === 'function' ? column.value(row) : row[column.key];
          return csvEscape(raw);
        })
        .join(',')
    )
    .join('\r\n');

  const blob = new Blob([`\uFEFF${header}\r\n${body}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCsvSections = (filename, sections = []) => {
  const parts = [];
  sections.forEach((section, index) => {
    if (!section) return;
    if (section.title) {
      parts.push([csvEscape(section.title)].join(','));
      parts.push('');
    }
    if (Array.isArray(section.columns) && section.columns.length) {
      parts.push(section.columns.map((column) => csvEscape(column.label)).join(','));
      const rows = section.rows || [];
      if (rows.length) {
        rows.forEach((row) => {
          const line = section.columns
            .map((column) => {
              const raw = typeof column.value === 'function' ? column.value(row) : row[column.key];
              return csvEscape(raw === null || raw === undefined ? '' : raw);
            })
            .join(',');
          parts.push(line);
        });
      } else {
        parts.push([csvEscape(section.empty || 'No records')].join(','));
      }
    }
    if (index < sections.length - 1) parts.push('');
  });

  const blob = new Blob([`\uFEFF${parts.join('\r\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const passwordScore = (value = '') => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

export const passwordLabel = (score) => {
  if (score <= 1) return { label: 'Weak', className: 'weak', bars: 1 };
  if (score === 2) return { label: 'Fair', className: 'fair', bars: 2 };
  if (score === 3) return { label: 'Good', className: 'good', bars: 3 };
  return { label: 'Strong', className: 'strong', bars: 4 };
};

export const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
