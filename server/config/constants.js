export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ACCOUNTANT: 'accountant',
  STOREKEEPER: 'storekeeper',
  PRINCIPAL: 'principal',
};

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  accountant: 'Accountant',
  storekeeper: 'Storekeeper',
  principal: 'Principal',
};

export const ROLE_LIST = Object.values(ROLES);

export const PRODUCT_CATEGORIES = [
  'Food & Provisions',
  'Stationery & Supplies',
  'Cleaning & Hygiene',
  'Uniforms & Wear',
  'Furniture & Equipment',
  'Other',
];

export const UNITS = ['piece', 'pack', 'box', 'carton', 'ream', 'dozen', 'kg', 'g', 'litre', 'ml'];

export const BRANCHES = ['main', 'branch'];

export const LOCATION_LABELS = {
  main: 'Main Campus Store',
  branch: 'Branch Campus Store',
};

export const LEDGER_TYPES = [
  'purchase',
  'issue',
  'transfer_out',
  'transfer_in',
  'adjustment_in',
  'adjustment_out',
  'return',
];

export const LEDGER_TYPE_LABELS = {
  purchase: 'Purchase received',
  issue: 'Issued out',
  transfer_out: 'Transfer out',
  transfer_in: 'Transfer in',
  adjustment_in: 'Adjustment in',
  adjustment_out: 'Adjustment out',
  return: 'Returned to store',
};

export const NOTIFICATION_AUDIENCE = [ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT, ROLES.PRINCIPAL];

export const PAGINATION_DEFAULT = 12;
export const PAGINATION_MAX = 100;
