import Notification from '../models/Notification.js';
import { NOTIFICATION_AUDIENCE, ROLES } from '../config/constants.js';

/**
 * Keeps stock alerts in sync with the current quantity of a product.
 * Only the main campus store drives alerts; branch stock is informational.
 * Existing alerts are auto-resolved once stock is healthy again.
 */
export async function syncStockNotification(product) {
  try {
    if (!product?._id) return;

    const openAlerts = await Notification.find({
      product: product._id,
      type: { $in: ['low_stock', 'out_of_stock'] },
      resolvedAt: null,
    });

    let wantedType = null;
    if (product.quantity <= 0) wantedType = 'out_of_stock';
    else if (product.quantity <= product.reorderLevel) wantedType = 'low_stock';

    if (!wantedType) {
      if (openAlerts.length) {
        await Notification.updateMany(
          { _id: { $in: openAlerts.map((alert) => alert._id) } },
          { resolvedAt: new Date() }
        );
      }
      return;
    }

    // Resolve alerts that no longer match the current severity.
    const stale = openAlerts.filter((alert) => alert.type !== wantedType);
    if (stale.length) {
      await Notification.updateMany(
        { _id: { $in: stale.map((alert) => alert._id) } },
        { resolvedAt: new Date() }
      );
    }

    const existing = openAlerts.find((alert) => alert.type === wantedType);
    const isOut = wantedType === 'out_of_stock';
    const title = isOut ? `Out of stock: ${product.name}` : `Low stock: ${product.name}`;
    const message = isOut
      ? `${product.name} is completely out of stock at the Main Campus store. Raise a purchase order to restock.`
      : `${product.name} is down to ${product.quantity} ${product.unit} at the Main Campus store (reorder level: ${product.reorderLevel} ${product.unit}).`;

    if (existing) {
      await Notification.updateOne(
        { _id: existing._id },
        { title, message, meta: stockMeta(product) }
      );
      return;
    }

    await Notification.create({
      type: wantedType,
      title,
      message,
      severity: isOut ? 'critical' : 'warning',
      product: product._id,
      audience: [...NOTIFICATION_AUDIENCE, ROLES.STOREKEEPER],
      meta: stockMeta(product),
    });
  } catch (error) {
    // A failed alert must never roll back an inventory transaction.
    console.error('[notifications] failed to sync stock alert:', error.message);
  }
}

function stockMeta(product) {
  return {
    quantity: product.quantity,
    branchQuantity: product.branchQuantity,
    reorderLevel: product.reorderLevel,
    unit: product.unit,
    sku: product.sku,
  };
}

export async function resolveStockNotifications(productId) {
  await Notification.updateMany(
    { product: productId, type: { $in: ['low_stock', 'out_of_stock'] }, resolvedAt: null },
    { resolvedAt: new Date() }
  );
}
