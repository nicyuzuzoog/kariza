import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import api from '../services/api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { PRODUCT_CATEGORIES, UNITS } from '../utils/constants.js';
import { formatNumber, getErrorMessage } from '../utils/format.js';
import { Drawer, Field, InlineAlert, Segmented } from './ui.jsx';

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function ProductFormDrawer({ open, onClose, product, onSaved }) {
  const toast = useToast();
  const editing = Boolean(product?._id);
  const [options, setOptions] = useState({ categories: PRODUCT_CATEGORIES, units: UNITS, suppliers: [] });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: '',
      sku: '',
      category: PRODUCT_CATEGORIES[0],
      unit: 'piece',
      supplier: '',
      reorderLevel: 10,
      unitCost: 0,
      storageLocation: '',
      description: '',
      imageUrl: '',
      quantity: 0,
      branchQuantity: 0,
    },
  });

  useEffect(() => {
    if (!open) return;
    setError('');
    reset({
      name: product?.name || '',
      sku: product?.sku || '',
      category: product?.category || PRODUCT_CATEGORIES[0],
      unit: product?.unit || 'piece',
      supplier: product?.supplier?._id || product?.supplier || '',
      reorderLevel: product?.reorderLevel ?? 10,
      unitCost: product?.unitCost ?? 0,
      storageLocation: product?.storageLocation || '',
      description: product?.description || '',
      imageUrl: product?.imageUrl || '',
      quantity: product?.quantity ?? 0,
      branchQuantity: product?.branchQuantity ?? 0,
    });
  }, [open, product, reset]);

  useEffect(() => {
    if (!open) return;
    api
      .get('/products/meta/options')
      .then(({ data }) => setOptions(data))
      .catch(() => {});
  }, [open]);

  const submit = async (values) => {
    setSaving(true);
    setError('');
    const payload = {
      name: values.name.trim(),
      sku: values.sku?.trim() || '',
      category: values.category,
      unit: values.unit,
      supplier: values.supplier || '',
      reorderLevel: numberOrZero(values.reorderLevel),
      unitCost: numberOrZero(values.unitCost),
      storageLocation: values.storageLocation?.trim() || '',
      description: values.description?.trim() || '',
      imageUrl: values.imageUrl?.trim() || '',
    };

    if (!editing) {
      payload.quantity = numberOrZero(values.quantity);
      payload.branchQuantity = numberOrZero(values.branchQuantity);
    }

    try {
      const response = editing
        ? await api.patch(`/products/${product._id}`, payload)
        : await api.post('/products', payload);
      toast.success(editing ? 'Product updated' : 'Product added', response.data.message);
      onSaved?.(response.data.product);
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${product?.name}` : 'Add a product'}
      subtitle={
        editing
          ? 'Update catalogue details. Use “Adjust stock” for quantity changes.'
          : 'Create a catalogue item with its opening balance and reorder threshold.'
      }
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="product-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            {editing ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(submit)}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Product details</p>
          <Field label="Product name" required error={errors.name?.message}>
            <input
              className={`control ${errors.name ? 'is-invalid' : ''}`.trim()}
              placeholder="e.g. Maize meal — 2kg"
              {...register('name', {
                required: 'Product name is required',
                minLength: { value: 2, message: 'Use at least 2 characters' },
                maxLength: { value: 120, message: 'Keep it under 120 characters' },
              })}
            />
          </Field>

          <div className="form-grid">
            <Field label="Category" required error={errors.category?.message}>
              <select className="control" {...register('category', { required: 'Choose a category' })}>
                {options.categories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Unit" required error={errors.unit?.message}>
              <select className="control" {...register('unit', { required: 'Choose a unit' })}>
                {options.units.map((unit) => (
                  <option value={unit} key={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="SKU" hint="Leave blank to generate one automatically." error={errors.sku?.message}>
              <input className="control" placeholder="e.g. FOOD-001" {...register('sku')} />
            </Field>
            <Field label="Supplier">
              <select className="control" {...register('supplier')}>
                <option value="">No supplier linked</option>
                {options.suppliers.map((supplier) => (
                  <option value={supplier._id} key={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reorder level" required error={errors.reorderLevel?.message}>
              <input
                type="number"
                min="0"
                step="any"
                className={`control ${errors.reorderLevel ? 'is-invalid' : ''}`.trim()}
                {...register('reorderLevel', {
                  required: 'Set a reorder level',
                  min: { value: 0, message: 'Cannot be negative' },
                })}
              />
            </Field>
            <Field label="Unit cost (RWF)" error={errors.unitCost?.message}>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`control ${errors.unitCost ? 'is-invalid' : ''}`.trim()}
                {...register('unitCost', { min: { value: 0, message: 'Cannot be negative' } })}
              />
            </Field>
            <Field label="Storage location" error={errors.storageLocation?.message}>
              <input className="control" placeholder="e.g. Store room A — shelf 3" {...register('storageLocation')} />
            </Field>
            <Field label="Image URL" hint="Optional photo used on product cards." error={errors.imageUrl?.message}>
              <input
                className={`control ${errors.imageUrl ? 'is-invalid' : ''}`.trim()}
                placeholder="https://…"
                {...register('imageUrl', {
                  pattern: { value: /^https?:\/\/.+/i, message: 'Enter a valid http(s) image URL' },
                })}
              />
            </Field>
            <Field label="Description" error={errors.description?.message}>
              <textarea className="control" rows={3} placeholder="Notes about this product" {...register('description')} />
            </Field>
          </div>
        </div>

        {!editing ? (
          <div className="form-section">
            <p className="form-section-title">Opening balance</p>
            <div className="form-grid">
              <Field label="Main store quantity" error={errors.quantity?.message}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="control"
                  {...register('quantity', { min: { value: 0, message: 'Cannot be negative' } })}
                />
              </Field>
              <Field label="Branch quantity" error={errors.branchQuantity?.message}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="control"
                  {...register('branchQuantity', { min: { value: 0, message: 'Cannot be negative' } })}
                />
              </Field>
            </div>
            <div className="soft-note mt-2">
              <i className="bi bi-info-circle" />
              <span>
                Opening quantities create an auditable “Opening stock balance” ledger entry. After this, all
                changes must go through purchases, issues, transfers or adjustments.
              </span>
            </div>
          </div>
        ) : null}
      </form>
    </Drawer>
  );
}

export function AdjustStockDrawer({ open, onClose, product, onSaved }) {
  const toast = useToast();
  const [direction, setDirection] = useState('in');
  const [location, setLocation] = useState('main');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection('in');
    setLocation('main');
    setQuantity('1');
    setReason('');
    setError('');
  }, [open, product]);

  const current = location === 'branch' ? product?.branchQuantity || 0 : product?.quantity || 0;
  const qty = Number(quantity) || 0;
  const resulting = direction === 'in' ? current + qty : current - qty;

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    if (qty <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }
    if (direction === 'out' && qty > current) {
      setError(
        `Only ${formatNumber(current)} ${product?.unit} available at this store. Reduce the quantity or choose the other location.`
      );
      return;
    }
    if (reason.trim().length < 3) {
      setError('Please give a short reason for this adjustment.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post(`/products/${product._id}/adjust`, {
        quantity: qty,
        direction,
        reason: reason.trim(),
        location,
      });
      toast.success('Stock adjusted', response.data.message);
      onSaved?.(response.data.product);
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Adjust stock"
      subtitle={`Record a movement for ${product?.name || 'this product'}.`}
      footer={
        <>
          <button type="button" className="btn btn-outline-soft" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="adjust-form" className="btn btn-brand" disabled={saving}>
            {saving ? <span className="spinner-ring sm" /> : <i className="bi bi-check2" />}
            Save adjustment
          </button>
        </>
      }
    >
      <form id="adjust-form" onSubmit={submit}>
        {error ? <InlineAlert type="error">{error}</InlineAlert> : null}

        <div className="form-section">
          <p className="form-section-title">Movement direction</p>
          <Segmented
            value={direction}
            onChange={setDirection}
            options={[
              { value: 'in', label: 'Add stock', icon: 'bi-plus-circle', className: 'in' },
              { value: 'out', label: 'Remove stock', icon: 'bi-dash-circle', className: 'out' },
            ]}
          />
        </div>

        <div className="form-grid">
          <Field label="Store" required>
            <select className="control" value={location} onChange={(event) => setLocation(event.target.value)}>
              <option value="main">Main campus store</option>
              <option value="branch">Branch campus store</option>
            </select>
          </Field>
          <Field label="Quantity" required>
            <input
              type="number"
              min="0.01"
              step="any"
              className="control"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Reason" required>
          <textarea
            className="control"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Damaged cartons written off, or stock count correction"
          />
        </Field>

        <div className="order-summary">
          <div className="kv-row">
            <span className="k">Current at this store</span>
            <span className="v">
              {formatNumber(current)} {product?.unit}
            </span>
          </div>
          <div className="kv-row">
            <span className="k">Movement</span>
            <span className={`v ${direction === 'in' ? 'ledger-in' : 'ledger-out'}`}>
              {direction === 'in' ? '+' : '−'}
              {formatNumber(qty)} {product?.unit}
            </span>
          </div>
          <div className="line-total">
            <span>New balance</span>
            <strong style={{ color: resulting < 0 ? 'var(--rose-600)' : undefined }}>
              {formatNumber(resulting)} {product?.unit}
            </strong>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
