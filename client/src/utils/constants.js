import api from '../services/api.js';

export { api };

export const CATEGORY_META = {
  'Food & Provisions': { icon: 'bi-basket2', tone: 'amber' },
  'Stationery & Supplies': { icon: 'bi-pencil-square', tone: 'brand' },
  'Cleaning & Hygiene': { icon: 'bi-droplet-half', tone: 'teal' },
  'Uniforms & Wear': { icon: 'bi-person-standing-dress', tone: 'violet' },
  'Furniture & Equipment': { icon: 'bi-tools', tone: 'sky' },
  Other: { icon: 'bi-box-seam', tone: 'neutral' },
};

export const CATEGORY_IMAGES = {
  'Food & Provisions':
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=75',
  'Stationery & Supplies':
    'https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=700&q=75',
  'Cleaning & Hygiene':
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?auto=format&fit=crop&w=700&q=75',
  'Uniforms & Wear':
    'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=700&q=75',
  'Furniture & Equipment':
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=700&q=75',
  Other:
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=700&q=75',
};

export const AUTH_IMAGE =
  'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1500&q=80';

export const HERO_IMAGE =
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80';

export const ROLE_META = {
  super_admin: {
    label: 'Super Admin',
    short: 'Full access',
    icon: 'bi-shield-lock',
    tone: 'violet',
    description: 'Owns the system, manages accounts and sees everything.',
  },
  accountant: {
    label: 'Accountant',
    short: 'Inventory lead',
    icon: 'bi-calculator',
    tone: 'brand',
    description: 'Records purchases, stock movements, transfers and reports.',
  },
  storekeeper: {
    label: 'Storekeeper',
    short: 'Store operations',
    icon: 'bi-box-seam',
    tone: 'teal',
    description: 'Issues food and supplies, handles branch dispatches.',
  },
  principal: {
    label: 'Principal',
    short: 'Oversight',
    icon: 'bi-mortarboard',
    tone: 'amber',
    description: 'Read-only visibility into stock health, spending and audits.',
  },
};

export const ROLES = ['super_admin', 'accountant', 'storekeeper', 'principal'];

export const PERMISSIONS = {
  manageInventory: ['super_admin', 'accountant'],
  recordIssues: ['super_admin', 'accountant', 'storekeeper'],
  managePurchases: ['super_admin', 'accountant'],
  manageSuppliers: ['super_admin', 'accountant'],
  manageTransfers: ['super_admin', 'accountant', 'storekeeper'],
  manageUsers: ['super_admin'],
  viewAudit: ['super_admin', 'principal'],
  viewReports: ['super_admin', 'accountant', 'storekeeper', 'principal'],
  viewNotifications: ['super_admin', 'accountant', 'storekeeper', 'principal'],
  viewLedger: ['super_admin', 'accountant', 'storekeeper', 'principal'],
};

export const can = (role, action) => {
  if (!role) return false;
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(role);
};

export const RECIPIENT_TYPES = [
  { value: 'class', label: 'Class' },
  { value: 'student', label: 'Student' },
  { value: 'department', label: 'Department' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' },
];

export const LEDGER_TYPE_META = {
  purchase: { label: 'Purchase', icon: 'bi-truck', tone: 'info' },
  issue: { label: 'Issued', icon: 'bi-box-arrow-up', tone: 'warn' },
  transfer_out: { label: 'Transfer out', icon: 'bi-arrow-left-right', tone: 'violet' },
  transfer_in: { label: 'Transfer in', icon: 'bi-arrow-left-right', tone: 'success' },
  adjustment_in: { label: 'Adjustment in', icon: 'bi-plus-circle', tone: 'success' },
  adjustment_out: { label: 'Adjustment out', icon: 'bi-dash-circle', tone: 'danger' },
  return: { label: 'Returned', icon: 'bi-arrow-counterclockwise', tone: 'success' },
};

export const BRANCH_LABELS = {
  main: 'Main campus',
  branch: 'Branch campus',
};

export const UNITS = ['piece', 'pack', 'box', 'carton', 'ream', 'dozen', 'kg', 'g', 'litre', 'ml'];

export const PRODUCT_CATEGORIES = [
  'Food & Provisions',
  'Stationery & Supplies',
  'Cleaning & Hygiene',
  'Uniforms & Wear',
  'Furniture & Equipment',
  'Other',
];
