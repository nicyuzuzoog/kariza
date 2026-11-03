import Product from '../models/Product.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { badRequest, notFound } from './ApiError.js';
import { makeReference } from './helpers.js';
import { syncStockNotification } from './notifications.js';

export const locationField = (location = 'main') =>
  location === 'branch' ? 'branchQuantity' : 'quantity';

export const locationLabel = (location = 'main') =>
  location === 'branch' ? 'Branch campus store' : 'Main campus store';

/**
 * The single gateway for every stock change. Updates the product balance and
 * writes an immutable ledger entry with the resulting balance snapshot.
 */
export async function moveStock({
  productId,
  quantity,
  direction,
  type,
  location = 'main',
  unitCost,
  party,
  referenceDoc,
  note,
  performedBy,
  reference,
  occurredAt,
}) {
  const product = await Product.findById(productId);
  if (!product) throw notFound('Product not found');
  if (!product.isActive) {
    throw badRequest(`${product.name} is archived. Restore it before moving stock.`);
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw badRequest('Quantity must be greater than zero');
  }

  const field = locationField(location);
  const current = product[field] || 0;

  if (direction === 'out' && current < qty) {
    throw badRequest(
      `Insufficient stock for ${product.name} at the ${locationLabel(location)}. Available: ${current} ${
        product.unit
      }, requested: ${qty} ${product.unit}.`
    );
  }

  product[field] = direction === 'in' ? current + qty : current - qty;
  await product.save();

  const resolvedCost = unitCost === undefined || unitCost === null ? product.unitCost : unitCost;

  const entry = await LedgerEntry.create({
    reference: reference || makeReference('MOV'),
    type,
    direction,
    product: product._id,
    productName: product.name,
    sku: product.sku,
    quantity: qty,
    unit: product.unit,
    location,
    unitCost: resolvedCost || 0,
    totalCost: (resolvedCost || 0) * qty,
    party: party || '',
    referenceDoc: referenceDoc || '',
    note: note || '',
    performedBy,
    balanceAfter: { main: product.quantity, branch: product.branchQuantity },
    ...(occurredAt ? { createdAt: occurredAt } : {}),
  });

  await syncStockNotification(product);

  return { product, entry };
}

/**
 * Validates that every line can be fulfilled before anything is deducted.
 * Prevents partial issues that leave the store in an inconsistent state.
 */
export async function assertStockAvailable(items, location = 'main') {
  const field = locationField(location);
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw notFound('One of the selected products no longer exists');
    if (!product.isActive) throw badRequest(`${product.name} is archived and cannot be issued`);
    const available = product[field] || 0;
    if (available < item.quantity) {
      throw badRequest(
        `Insufficient stock for ${product.name}. Available: ${available} ${product.unit}, requested: ${item.quantity} ${product.unit}.`
      );
    }
  }
}

export async function buildItemsWithNames(items) {
  const enriched = [];
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) throw notFound('One of the selected products no longer exists');
    enriched.push({
      product: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: item.quantity,
      unitCost: item.unitCost ?? product.unitCost,
    });
  }
  return enriched;
}

/**
 * Reverses every ledger movement written under a document reference and
 * removes those entries. Used to keep stock consistent if a multi-item
 * operation fails halfway through.
 */
export async function rollbackMovements(referenceDoc) {
  const entries = await LedgerEntry.find({ referenceDoc });
  for (const entry of entries) {
    const field = locationField(entry.location);
    const delta = entry.direction === 'out' ? entry.quantity : -entry.quantity;
    await Product.updateOne({ _id: entry.product }, { $inc: { [field]: delta } });
  }
  await LedgerEntry.deleteMany({ referenceDoc });
  return entries.length;
}
