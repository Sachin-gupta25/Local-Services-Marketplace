# LocalServe: Local Services Marketplace (MERN)

Customers find and book verified local providers. Providers manage their profile and bookings. An admin verifies providers and sees analytics.

## Run it
Requires Node 18+ and MongoDB (local or Atlas).

```bash
# 1. API
cd server
cp .env.example .env        # set MONGO_URI and JWT_SECRET
npm install
npm run seed                # optional demo data
npm run dev                 # http://localhost:5000

# 2. Web app (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Demo logins after seeding (password `password123`): `admin@localserve.in`, `customer@localserve.in`, `provider1@localserve.in`.

## Structure
- `server/models.js`: User, Provider, Booking, Review (Mongoose)
- `server/routes.js`: auth, providers, bookings, reviews, admin (JWT + role checks)
- `client/src/App.jsx`: pages (home search, provider page and booking, auth, dashboards)

## API
| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | anyone |
| GET | /api/providers?category&city&sort | anyone (verified only) |
| GET | /api/providers/:id | anyone |
| GET, PUT | /api/provider-profile | provider |
| POST | /api/bookings | customer |
| GET | /api/bookings/mine | customer, provider |
| PATCH | /api/bookings/:id/status | customer, provider (state rules enforced) |
| POST | /api/reviews | customer (completed bookings only) |
| GET | /api/admin/overview | admin |
| PATCH | /api/admin/providers/:id/verify | admin |

## Ideas to extend (for extra marks)
Socket.io chat and live notifications, Razorpay test payments, geospatial "near me" search with a 2dsphere index, Cloudinary photos, email alerts with Nodemailer, deployment on Render and Vercel.
