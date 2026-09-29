import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Provider } from './models.js';

await mongoose.connect(process.env.MONGO_URI);
await Promise.all([User.deleteMany({}), Provider.deleteMany({})]);
const password = await bcrypt.hash('password123', 10);
await User.create({ name: 'Admin', email: 'admin@localserve.in', password, role: 'admin' });
await User.create({ name: 'Demo Customer', email: 'customer@localserve.in', password });
const demo = [
  ['Ramesh Yadav', 'Electrician', 'Lucknow', 8, 350, 'Wiring, fan and inverter repair. Same-day visits.'],
  ['Sunita Verma', 'Tutor', 'Lucknow', 5, 400, 'Maths and science for classes 8 to 12.'],
  ['Imran Khan', 'Plumber', 'Kanpur', 10, 300, 'Leakage, bathroom fittings and motor repair.'],
  ['Meena Devi', 'Tiffin', 'Lucknow', 6, 90, 'Home-style veg thali delivered daily.'],
];
for (const [i, [name, category, city, experience, price, bio]] of demo.entries()) {
  const u = await User.create({ name, email: `provider${i + 1}@localserve.in`, password, role: 'provider' });
  await Provider.create({ user: u._id, category, city, experience, price, bio, isVerified: true });
}
console.log('Seeded. Logins: admin@localserve.in, customer@localserve.in, provider1@localserve.in (password: password123)');
process.exit(0);
