import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Provider, Booking, Review } from './models.js';

const r = Router();
const fail = (res, code, message) => res.status(code).json({ message });
const sign = (u) => jwt.sign({ id: u._id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

const auth = (roles = []) => (req, res, next) => {
  try {
    req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
  } catch { return fail(res, 401, 'Please log in to continue'); }
  if (roles.length && !roles.includes(req.user.role)) return fail(res, 403, 'You cannot do this');
  next();
};

/* ---------- Auth ---------- */
r.post('/auth/register', async (req, res) => {
  const { name, email, password, phone, role, category, city } = req.body;
  if (!name || !email || !password || password.length < 6) return fail(res, 400, 'Name, email and a password of 6+ characters are required');
  if (await User.findOne({ email })) return fail(res, 409, 'This email is already registered');
  const user = await User.create({ name, email, phone, password: await bcrypt.hash(password, 10), role: role === 'provider' ? 'provider' : 'customer' });
  if (user.role === 'provider') await Provider.create({ user: user._id, category: category || 'Electrician', city: city || '' });
  res.status(201).json({ token: sign(user), user: { id: user._id, name: user.name, role: user.role } });
});

r.post('/auth/login', async (req, res) => {
  const user = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password))) return fail(res, 401, 'Email or password is wrong');
  res.json({ token: sign(user), user: { id: user._id, name: user.name, role: user.role } });
});

/* ---------- Providers ---------- */
r.get('/providers', async (req, res) => {
  const { category, city, sort } = req.query;
  const filter = { isVerified: true };
  if (category) filter.category = category;
  if (city) filter.city = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const order = sort === 'price' ? { price: 1 } : { avgRating: -1, reviewCount: -1 };
  res.json(await Provider.find(filter).sort(order).populate('user', 'name'));
});

r.get('/provider-profile', auth(['provider']), async (req, res) => res.json(await Provider.findOne({ user: req.user.id })));

r.put('/provider-profile', auth(['provider']), async (req, res) => {
  const { category, bio, city, experience, price } = req.body;
  res.json(await Provider.findOneAndUpdate({ user: req.user.id }, { category, bio, city, experience, price }, { new: true }));
});

r.get('/providers/:id', async (req, res) => {
  const p = await Provider.findById(req.params.id).populate('user', 'name');
  if (!p) return fail(res, 404, 'Provider not found');
  const reviews = await Review.find({ provider: p._id }).sort({ createdAt: -1 }).limit(20).populate('customer', 'name');
  res.json({ provider: p, reviews });
});

/* ---------- Bookings ---------- */
r.post('/bookings', auth(['customer']), async (req, res) => {
  const { provider, date, slot, address, note } = req.body;
  if (!provider || !date || !slot || !address) return fail(res, 400, 'Date, time slot and address are required');
  if (date < new Date().toISOString().slice(0, 10)) return fail(res, 400, 'Choose a date from today onward');
  const p = await Provider.findById(provider);
  if (!p || !p.isVerified) return fail(res, 404, 'Provider not available');
  const taken = await Booking.findOne({ provider, date, slot, status: { $in: ['pending', 'accepted'] } });
  if (taken) return fail(res, 409, 'That slot is already booked. Pick another time');
  res.status(201).json(await Booking.create({ customer: req.user.id, provider, date, slot, address, note }));
});

r.get('/bookings/mine', auth(['customer', 'provider']), async (req, res) => {
  let filter = { customer: req.user.id };
  if (req.user.role === 'provider') {
    const p = await Provider.findOne({ user: req.user.id });
    filter = { provider: p._id };
  }
  const list = await Booking.find(filter).sort({ date: -1 }).populate('customer', 'name phone').populate({ path: 'provider', populate: { path: 'user', select: 'name' } }).lean();
  const done = new Set((await Review.find({ booking: { $in: list.map((b) => b._id) } })).map((x) => String(x.booking)));
  res.json(list.map((b) => ({ ...b, reviewed: done.has(String(b._id)) })));
});

r.patch('/bookings/:id/status', auth(['customer', 'provider']), async (req, res) => {
  const b = await Booking.findById(req.params.id).populate('provider');
  if (!b) return fail(res, 404, 'Booking not found');
  const { status } = req.body;
  const isProvider = req.user.role === 'provider' && String(b.provider.user) === req.user.id;
  const isCustomer = req.user.role === 'customer' && String(b.customer) === req.user.id;
  const allowed = isProvider ? { pending: ['accepted', 'rejected'], accepted: ['completed', 'cancelled'] }
    : isCustomer ? { pending: ['cancelled'], accepted: ['cancelled'] } : {};
  if (!(allowed[b.status] || []).includes(status)) return fail(res, 400, `Cannot change a ${b.status} booking to ${status}`);
  b.status = status;
  res.json(await b.save());
});

/* ---------- Reviews ---------- */
r.post('/reviews', auth(['customer']), async (req, res) => {
  const { booking, rating, comment } = req.body;
  const b = await Booking.findById(booking);
  if (!b || String(b.customer) !== req.user.id || b.status !== 'completed') return fail(res, 400, 'You can review only completed bookings');
  if (await Review.findOne({ booking })) return fail(res, 409, 'You already reviewed this booking');
  await Review.create({ booking, customer: req.user.id, provider: b.provider, rating, comment });
  const [agg] = await Review.aggregate([{ $match: { provider: b.provider } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Provider.findByIdAndUpdate(b.provider, { avgRating: Math.round(agg.avg * 10) / 10, reviewCount: agg.n });
  res.status(201).json({ message: 'Review saved' });
});

/* ---------- Admin ---------- */
r.get('/admin/overview', auth(['admin']), async (req, res) => {
  const [users, providers, bookings, byCategory] = await Promise.all([
    User.countDocuments(), Provider.countDocuments(), Booking.countDocuments(),
    Booking.aggregate([{ $lookup: { from: 'providers', localField: 'provider', foreignField: '_id', as: 'p' } }, { $unwind: '$p' }, { $group: { _id: '$p.category', count: { $sum: 1 } } }]),
  ]);
  const list = await Provider.find().sort({ isVerified: 1, createdAt: -1 }).populate('user', 'name email');
  res.json({ stats: { users, providers, bookings }, byCategory, providers: list });
});

r.patch('/admin/providers/:id/verify', auth(['admin']), async (req, res) => {
  res.json(await Provider.findByIdAndUpdate(req.params.id, { isVerified: !!req.body.isVerified }, { new: true }));
});

export default r;
