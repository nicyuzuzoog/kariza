import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_LIST, ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: { values: ROLE_LIST, message: 'Invalid role' },
      default: ROLES.STOREKEEPER,
    },
    phone: { type: String, trim: true, maxlength: 30 },
    avatarUrl: { type: String, trim: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    lastLoginAt: Date,
    passwordChangedAt: Date,
    tokenVersion: { type: Number, default: 0, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual('initials').get(function initials() {
  return (this.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
