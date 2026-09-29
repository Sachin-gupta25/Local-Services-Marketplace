import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name, required: true });

export const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  phone: String,
  role: { type: String, enum: ['customer', 'provider', 'admin'], default: 'customer' },
}, { timestamps: true }));

export const Provider = model('Provider', new Schema({
  user: { ...ref('User'), unique: true },
  category: String, bio: String, city: String,
  experience: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
}, { timestamps: true }));

export const Booking = model('Booking', new Schema({
  customer: ref('User'), provider: ref('Provider'),
  date: { type: String, required: true }, slot: { type: String, required: true },
  address: { type: String, required: true }, note: String,
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], default: 'pending' },
}, { timestamps: true }));

export const Review = model('Review', new Schema({
  booking: { ...ref('Booking'), unique: true },
  customer: ref('User'), provider: ref('Provider'),
  rating: { type: Number, min: 1, max: 5, required: true }, comment: String,
}, { timestamps: true }));
