import { z } from 'zod';
import {
  BRANCHES,
  PRODUCT_CATEGORIES,
  ROLE_LIST,
  UNIFORM_CATEGORY,
  UNIFORM_VARIANTS,
  UNITS,
} from '../config/constants.js';

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Please select a valid record');

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(''));
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password cannot exceed 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

const quantity = z.coerce
  .number({ invalid_type_error: 'Enter a valid number' })
  .positive('Must be greater than zero');

const nonNegative = z.coerce
  .number({ invalid_type_error: 'Enter a valid number' })
  .min(0, 'Cannot be negative');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: password,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  phone: optionalText(30),
  avatarUrl: z.union([z.literal(''), z.string().url('Enter a valid image URL')]).optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  role: z.enum(ROLE_LIST),
  phone: optionalText(30),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80).optional(),
  role: z.enum(ROLE_LIST).optional(),
  phone: optionalText(30),
  status: z.enum(['active', 'inactive']).optional(),
});

export const resetPasswordSchema = z.object({
  password,
});

const productBaseSchema = z.object({
  name: z.string().trim().min(2, 'Product name must be at least 2 characters').max(120),
  sku: z.string().trim().max(40).optional().or(z.literal('')),
  category: z.enum(PRODUCT_CATEGORIES),
  unit: z.enum(UNITS),
  variant: z.enum(UNIFORM_VARIANTS).optional().or(z.literal('')),
  description: optionalText(500),
  imageUrl: z.union([z.literal(''), z.string().url('Enter a valid image URL')]).optional(),
  quantity: nonNegative.default(0),
  branchQuantity: nonNegative.default(0),
  reorderLevel: nonNegative.default(10),
  unitCost: nonNegative.default(0),
  supplier: z.union([objectId, z.literal('')]).optional(),
  storageLocation: optionalText(120),
});

export const productSchema = productBaseSchema.refine(
  (data) => data.category !== UNIFORM_CATEGORY || Boolean(data.variant),
  {
    message: 'Choose the uniform item — skirt, trousers, shirt, sweater, socks, …',
    path: ['variant'],
  }
);

export const productUpdateSchema = productBaseSchema.partial();

export const adjustStockSchema = z.object({
  quantity,
  direction: z.enum(['in', 'out']),
  reason: z.string().trim().min(3, 'Please provide a short reason').max(300),
  location: z.enum(BRANCHES).default('main'),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, 'Supplier name is required').max(120),
  contactName: optionalText(80),
  phone: optionalText(30),
  email: z.union([z.literal(''), z.string().email('Enter a valid email address')]).optional(),
  address: optionalText(200),
  category: z
    .enum([...PRODUCT_CATEGORIES, 'General'])
    .default('General'),
  notes: optionalText(500),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const supplierUpdateSchema = supplierSchema.partial();

const purchaseItem = z.object({
  product: objectId,
  quantity,
  unitCost: nonNegative,
});

export const purchaseSchema = z.object({
  supplier: objectId,
  invoiceNo: optionalText(60),
  purchaseDate: z.coerce.date().optional(),
  items: z.array(purchaseItem).min(1, 'Add at least one item to the purchase'),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).default('unpaid'),
  notes: optionalText(500),
});

export const purchaseUpdateSchema = z.object({
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
  invoiceNo: optionalText(60),
  notes: optionalText(500),
});

export const issueItem = z.object({
  product: objectId,
  quantity,
});

export const issueSchema = z.object({
  items: z.array(issueItem).min(1, 'Add at least one item to issue'),
  recipientName: z.string().trim().min(2, 'Recipient is required').max(120),
  recipientType: z.enum(['student', 'class', 'department', 'staff', 'other']).default('department'),
  className: optionalText(60),
  department: optionalText(80),
  purpose: optionalText(300),
  location: z.enum(BRANCHES).default('main'),
  issueDate: z.coerce.date().optional(),
});

export const voidIssueSchema = z.object({
  reason: z.string().trim().min(3, 'Please state why this issue is being voided').max(300),
});

export const transferItem = z.object({
  product: objectId,
  quantity,
});

export const transferSchema = z
  .object({
    from: z.enum(BRANCHES),
    to: z.enum(BRANCHES),
    items: z.array(transferItem).min(1, 'Add at least one item to transfer'),
    notes: optionalText(500),
  })
  .refine((data) => data.from !== data.to, {
    message: 'Source and destination stores must be different',
    path: ['to'],
  });

export const transferStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
  reason: optionalText(300),
});

export const cancelTransferSchema = z.object({
  reason: optionalText(300),
});

export const adjustUserStatusSchema = z.object({
  status: z.enum(['active', 'inactive']),
});
