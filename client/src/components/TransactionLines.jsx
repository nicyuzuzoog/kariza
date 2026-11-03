import { useMemo } from 'react';
import { formatCurrency, formatNumber } from '../utils/format.js';

const emptyPurchaseLine = () => ({ product: '', quantity: '1', unitCost: '' });

export function PurchaseLineItems({ products, items, setItems, error }) {
  const updateLine = (index, patch) => {
    setItems((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    );
  };

  const onProductChange = (index, productId) => {
    const product = products.find((item) => item._id === productId);
    updateLine(index, {
      product: productId,
      unitCost: product ? String(product.unitCost ?? 0) : '',
    });
  };

  const total = useMemo(
    () =>
      items.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0),
        0
      ),
    [items]
  );

  return (
    <div>
      <div className="item-lines">
        {items.map((line, index) => (
          <div className="item-line" key={index}>
            <select
              className="control"
              value={line.product}
              onChange={(event) => onProductChange(index, event.target.value)}
              aria-label="Product"
            >
              <option value="">Select a product…</option>
              {products.map((product) => (
                <option value={product._id} key={product._id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
            <input
              type="number"
              className="control"
              min="0.01"
              step="any"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: event.target.value })}
              placeholder="Qty"
              aria-label="Quantity"
            />
            <input
              type="number"
              className="control cost-cell"
              min="0"
              step="0.01"
              value={line.unitCost}
              onChange={(event) => updateLine(index, { unitCost: event.target.value })}
              placeholder="Unit cost"
              aria-label="Unit cost"
            />
            <button
              type="button"
              className="remove-line"
              onClick={() => setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}
              disabled={items.length === 1}
              aria-label="Remove line"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="add-line-btn"
        onClick={() => setItems((current) => [...current, emptyPurchaseLine()])}
      >
        <i className="bi bi-plus-lg" />
        Add another item
      </button>
      {error ? (
        <p className="field-error">
          <i className="bi bi-exclamation-circle" />
          {error}
        </p>
      ) : null}
      <div className="order-summary">
        <div className="kv-row">
          <span className="k">Items on this purchase</span>
          <span className="v">{items.length}</span>
        </div>
        <div className="line-total">
          <span>Purchase total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>
      </div>
    </div>
  );
}

const emptyStockLine = () => ({ product: '', quantity: '1' });

export function StockLineItems({ products, items, setItems, location = 'main', error }) {
  const updateLine = (index, patch) => {
    setItems((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line))
    );
  };

  const availableFor = (product) =>
    location === 'branch' ? product?.branchQuantity ?? 0 : product?.quantity ?? 0;

  const selectedIds = items.map((line) => line.product).filter(Boolean);

  return (
    <div>
      <div className="item-lines">
        {items.map((line, index) => {
          const product = products.find((item) => item._id === line.product);
          const available = availableFor(product);
          return (
            <div key={index}>
              <div className="item-line" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) 100px 32px' }}>
                <select
                  className="control"
                  value={line.product}
                  onChange={(event) => updateLine(index, { product: event.target.value })}
                  aria-label="Product"
                >
                  <option value="">Select a product…</option>
                  {products.map((item) => {
                    const stock = availableFor(item);
                    const isPickedElsewhere =
                      selectedIds.includes(item._id) && item._id !== line.product;
                    return (
                      <option value={item._id} key={item._id} disabled={stock <= 0 || isPickedElsewhere}>
                        {item.name} · {formatNumber(stock)} {item.unit} left
                        {isPickedElsewhere ? ' (already added)' : ''}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  className="control"
                  min="0.01"
                  step="any"
                  value={line.quantity}
                  onChange={(event) => updateLine(index, { quantity: event.target.value })}
                  placeholder="Qty"
                  aria-label="Quantity"
                />
                <button
                  type="button"
                  className="remove-line"
                  onClick={() => setItems((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                  disabled={items.length === 1}
                  aria-label="Remove line"
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
              {product ? (
                <p className="field-hint" style={{ marginTop: 2, marginBottom: 8 }}>
                  Available at {location === 'branch' ? 'branch' : 'main'} store:{' '}
                  <strong>
                    {formatNumber(available)} {product.unit}
                  </strong>
                  {Number(line.quantity) > available ? (
                    <span style={{ color: 'var(--rose-600)', fontWeight: 600 }}> · exceeds stock</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="add-line-btn"
        onClick={() => setItems((current) => [...current, emptyStockLine()])}
      >
        <i className="bi bi-plus-lg" />
        Add another item
      </button>
      {error ? (
        <p className="field-error">
          <i className="bi bi-exclamation-circle" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
