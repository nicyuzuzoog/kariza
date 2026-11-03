import { formatCurrency, formatDate, formatDateTime, formatNumber } from './format.js';

const COLORS = {
  ink: [11, 18, 32],
  inkSoft: [30, 44, 74],
  brand: [79, 70, 229],
  brandLight: [238, 242, 255],
  teal: [13, 148, 136],
  tealLight: [236, 253, 248],
  amber: [217, 119, 6],
  amberLight: [255, 251, 235],
  rose: [225, 29, 72],
  roseLight: [255, 241, 242],
  violet: [124, 58, 237],
  violetLight: [245, 243, 255],
  sky: [37, 99, 235],
  skyLight: [239, 246, 255],
  text: [51, 65, 85],
  muted: [100, 116, 139],
  line: [230, 233, 242],
  surface: [248, 250, 252],
  white: [255, 255, 255],
};

const TONES = {
  brand: { accent: COLORS.brand, soft: COLORS.brandLight },
  teal: { accent: COLORS.teal, soft: COLORS.tealLight },
  amber: { accent: COLORS.amber, soft: COLORS.amberLight },
  rose: { accent: COLORS.rose, soft: COLORS.roseLight },
  violet: { accent: COLORS.violet, soft: COLORS.violetLight },
  sky: { accent: COLORS.sky, soft: COLORS.skyLight },
};

const statusTokens = {
  danger: ['out', 'out of stock', 'critical', 'unpaid', 'voided', 'cancelled'],
  warn: ['low', 'low stock', 'ordered', 'in transit', 'partial', 'warning'],
  success: ['ok', 'in stock', 'healthy', 'paid', 'received', 'completed', 'issued', 'active', 'resolved'],
};

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '');
}

function statusTone(raw) {
  const value = String(raw || '').toLowerCase().trim();
  const match = Object.entries(statusTokens).find(([, words]) => words.includes(value));
  return match ? match[0] : '';
}

/**
 * Build and download a designed, colour-coded PDF report.
 *
 * sections: [{ title, columns: [{ header, key?, value?, width?, align?, status? }], rows }]
 */
export async function exportPdf({
  fileName,
  title,
  subtitle,
  reference,
  preparedBy,
  meta = [],
  summary = [],
  sections = [],
  orientation = 'landscape',
}) {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default || autoTableModule.autoTable;

  const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  const generatedAt = new Date();

  // ── Cover band ──────────────────────────────────────────────────────────
  doc.setFillColor(...COLORS.ink);
  doc.rect(0, 0, pageWidth, 108, 'F');
  doc.setFillColor(...COLORS.brand);
  doc.rect(0, 0, 6, 108, 'F');
  doc.setFillColor(...COLORS.teal);
  doc.rect(6, 0, 3, 108, 'F');

  doc.setFillColor(...COLORS.brand);
  doc.roundedRect(margin, 24, 38, 38, 10, 10, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(21);
  doc.text('M', margin + 19, 49.5, { align: 'center' });

  doc.setFontSize(16);
  doc.text('Mrskariza', margin + 50, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(165, 180, 252);
  doc.text('SCHOOL STOCK & SUPPLIES MANAGEMENT', margin + 50, 55);

  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated ${formatDateTime(generatedAt)}`, pageWidth - margin, 35, { align: 'right' });
  if (preparedBy) {
    doc.text(`Prepared by ${clean(preparedBy)}`, pageWidth - margin, 49, { align: 'right' });
  }
  if (reference) {
    doc.setTextColor(94, 234, 212);
    doc.text(clean(reference), pageWidth - margin, 63, { align: 'right' });
  }

  // ── Report heading ──────────────────────────────────────────────────────
  let cursor = 136;
  doc.setTextColor(...COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(clean(title), margin, cursor);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  cursor += 15;
  if (subtitle) {
    doc.text(clean(subtitle), margin, cursor);
    cursor += 13;
  }
  if (meta.length) {
    doc.setFontSize(7.5);
    doc.text(meta.map((item) => clean(item)).join('   •   '), margin, cursor);
    cursor += 8;
  }

  // ── Summary cards ───────────────────────────────────────────────────────
  if (summary.length) {
    cursor += 10;
    const perRow = summary.length > 4 ? 3 : summary.length;
    const gap = 9;
    const cardWidth = (contentWidth - gap * (perRow - 1)) / perRow;
    const cardHeight = 48;

    summary.forEach((item, index) => {
      const row = Math.floor(index / perRow);
      const column = index % perRow;
      const x = margin + column * (cardWidth + gap);
      const y = cursor + row * (cardHeight + gap);
      const tone = TONES[item.tone] || TONES.brand;

      doc.setFillColor(...tone.soft);
      doc.roundedRect(x, y, cardWidth, cardHeight, 7, 7, 'F');
      doc.setFillColor(...tone.accent);
      doc.rect(x, y + 7, 3, cardHeight - 14, 'F');

      doc.setTextColor(...COLORS.muted);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(clean(item.label).toUpperCase(), x + 12, y + 15);

      doc.setTextColor(...COLORS.ink);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      const value = typeof item.value === 'function' ? item.value() : item.value;
      doc.text(clean(value), x + 12, y + 32);

      if (item.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.3);
        doc.setTextColor(...COLORS.muted);
        doc.text(clean(item.hint), x + 12, y + 41);
      }
    });

    const rows = Math.ceil(summary.length / perRow);
    cursor += rows * cardHeight + (rows - 1) * gap + 16;
  }

  // ── Tables ──────────────────────────────────────────────────────────────
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) cursor += 12;

    if (cursor > pageHeight - 120) {
      doc.addPage();
      cursor = margin + 18;
    }

    if (section.title) {
      doc.setFillColor(...COLORS.brand);
      doc.roundedRect(margin, cursor - 7, 4, 12, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.ink);
      doc.text(clean(section.title).toUpperCase(), margin + 11, cursor + 2);
      cursor += 13;
    }

    const body = (section.rows || []).length
      ? section.rows.map((row) =>
          section.columns.map((column) => {
            const value = typeof column.value === 'function' ? column.value(row) : row[column.key];
            return clean(value === null || value === undefined || value === '' ? '-' : value);
          })
        )
      : [section.columns.map((_, index) => (index === 0 ? clean(section.empty || 'No records for this period') : ''))];

    autoTable(doc, {
      startY: cursor,
      head: [section.columns.map((column) => clean(column.header))],
      body,
      margin: { left: margin, right: margin, top: 40, bottom: 42 },
      styles: {
        font: 'helvetica',
        fontSize: 7,
        cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
        textColor: COLORS.text,
        lineColor: COLORS.line,
        lineWidth: 0.35,
        overflow: 'linebreak',
        valign: 'middle',
      },
      headStyles: {
        fillColor: COLORS.brand,
        textColor: COLORS.white,
        fontStyle: 'bold',
        fontSize: 6.8,
        halign: 'left',
        minCellHeight: 18,
      },
      alternateRowStyles: { fillColor: COLORS.surface },
      columnStyles: section.columns.reduce((styles, column, index) => {
        styles[index] = {
          halign: column.align || 'left',
          cellWidth: column.width || 'auto',
        };
        return styles;
      }, {}),
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const header = String(data.column.header || '').toLowerCase();
        const isStatusColumn =
          header.includes('status') ||
          header.includes('health') ||
          header.includes('payment') ||
          header.includes('state');
        if (!isStatusColumn) return;
        const tone = statusTone(data.cell.raw);
        if (!tone) return;
        const palette = { danger: 'rose', warn: 'amber', success: 'teal' }[tone];
        data.cell.styles.textColor = COLORS[palette];
        data.cell.styles.fontStyle = 'bold';
      },
      didDrawPage: (data) => {
        // Running header on continuation pages.
        if (doc.getCurrentPageInfo().pageNumber > 1) {
          doc.setFillColor(...COLORS.ink);
          doc.rect(0, 0, pageWidth, 26, 'F');
          doc.setFillColor(...COLORS.brand);
          doc.rect(0, 0, pageWidth, 2, 'F');
          doc.setTextColor(...COLORS.white);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('Mrskariza', margin, 17);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(203, 213, 225);
          doc.text(clean(title), pageWidth - margin, 17, { align: 'right' });
          data.settings.margin.top = 40;
        }
      },
    });

    cursor = doc.lastAutoTable.finalY + 8;
  });

  // ── Footer on every page ────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.6);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.muted);
    doc.text('Mrskariza • Confidential school inventory report', margin, pageHeight - 18);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' });
  }

  doc.save(`${fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`}`);
}

export function reportCurrency(value) {
  return formatCurrency(value).replace(/\u00a0/g, ' ');
}

export function reportNumber(value) {
  return formatNumber(value);
}

export function reportDate(value) {
  return formatDate(value);
}
