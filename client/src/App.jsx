import { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { api } from './api.js';

const CATEGORIES = ['Electrician', 'Plumber', 'Tutor', 'Tiffin', 'AC repair', 'Carpenter', 'Painter'];
const SLOTS = ['9:00-11:00', '11:00-13:00', '14:00-16:00', '16:00-18:00'];
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const nav = useNavigate();
  const save = ({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); setUser(user); nav('/dashboard'); };
  const logout = () => { localStorage.clear(); setUser(null); nav('/'); };
  return (
    <>
      <header className="bar">
        <Link to="/" className="logo">LocalServe</Link>
        <nav>
          {user ? (<><Link to="/dashboard">{user.name}</Link><button className="link" onClick={logout}>Log out</button></>)
            : (<><Link to="/login">Log in</Link><Link to="/register" className="btn small">Sign up</Link></>)}
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/provider/:id" element={<ProviderPage user={user} />} />
          <Route path="/login" element={<Auth mode="login" onDone={save} />} />
          <Route path="/register" element={<Auth mode="register" onDone={save} />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </>
  );
}

const Stars = ({ n, count }) => <span className="stars">{n ? `★ ${n}` : 'New'}{count ? ` (${count})` : ''}</span>;

function Home() {
  const [q, setQ] = useState({ category: '', city: '', sort: 'rating' });
  const [list, setList] = useState(null);
  useEffect(() => { api('/providers?' + new URLSearchParams(q)).then(setList).catch(() => setList([])); }, [q]);
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  return (
    <>
      <section className="hero">
        <h1>Someone reliable, nearby.</h1>
        <p>Electricians, tutors, plumbers and tiffin makers in your town. Verified, rated, booked in a minute.</p>
        <div className="search">
          <select value={q.category} onChange={set('category')} aria-label="Service"><option value="">All services</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          <input placeholder="Your city" value={q.city} onChange={set('city')} aria-label="City" />
          <select value={q.sort} onChange={set('sort')} aria-label="Sort by"><option value="rating">Top rated</option><option value="price">Lowest price</option></select>
        </div>
      </section>
      <section className="grid">
        {list === null && <p>Loading providers...</p>}
        {list && !list.length && <p>No providers match yet. Try another service or city.</p>}
        {list?.map((p) => (
          <Link key={p._id} to={`/provider/${p._id}`} className="card">
            <h3>{p.user?.name}</h3>
            <p className="muted">{p.category} · {p.city || 'City not set'}</p>
            <p>{p.bio}</p>
            <div className="row"><strong>₹{p.price}</strong><Stars n={p.avgRating} count={p.reviewCount} /></div>
          </Link>
        ))}
      </section>
    </>
  );
}

function ProviderPage({ user }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [f, setF] = useState({ date: today(), slot: SLOTS[0], address: '', note: '' });
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/providers/' + id).then(setData).catch((e) => setMsg(e.message)); }, [id]);
  if (!data) return <p className="pad">{msg || 'Loading...'}</p>;
  const { provider: p, reviews } = data;
  const book = async (e) => {
    e.preventDefault();
    try { await api('/bookings', 'POST', { ...f, provider: id }); nav('/dashboard'); } catch (err) { setMsg(err.message); }
  };
  return (
    <div className="two pad">
      <section>
        <h2>{p.user?.name}</h2>
        <p className="muted">{p.category} · {p.city} · {p.experience} yrs experience</p>
        <p>{p.bio}</p>
        <p><strong>₹{p.price}</strong> per visit · <Stars n={p.avgRating} count={p.reviewCount} /></p>
        <h3>Reviews</h3>
        {!reviews.length && <p className="muted">No reviews yet.</p>}
        {reviews.map((r) => <div key={r._id} className="review"><strong>{'★'.repeat(r.rating)}</strong> {r.customer?.name}<p>{r.comment}</p></div>)}
      </section>
      <aside className="panel">
        <h3>Book a visit</h3>
        {user?.role === 'customer' ? (
          <form onSubmit={book}>
            <label>Date<input type="date" min={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></label>
            <label>Time slot<select value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>{SLOTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Address<input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required /></label>
            <label>Note (optional)<textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            <button className="btn">Request booking</button>
          </form>
        ) : <p>{user ? 'Only customer accounts can book.' : <><Link to="/login">Log in</Link> as a customer to book.</>}</p>}
        {msg && <p className="error">{msg}</p>}
      </aside>
    </div>
  );
}

function Auth({ mode, onDone }) {
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', role: 'customer', category: CATEGORIES[0], city: '' });
  const [err, setErr] = useState('');
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => { e.preventDefault(); try { onDone(await api('/auth/' + mode, 'POST', f)); } catch (x) { setErr(x.message); } };
  const reg = mode === 'register';
  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>{reg ? 'Create your account' : 'Welcome back'}</h2>
      {reg && <label>Full name<input value={f.name} onChange={up('name')} required /></label>}
      <label>Email<input type="email" value={f.email} onChange={up('email')} required /></label>
      <label>Password<input type="password" minLength={6} value={f.password} onChange={up('password')} required /></label>
      {reg && <>
        <label>I want to<select value={f.role} onChange={up('role')}><option value="customer">Find a service</option><option value="provider">Offer a service</option></select></label>
        {f.role === 'provider' && <>
          <label>Service<select value={f.category} onChange={up('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>City<input value={f.city} onChange={up('city')} required /></label>
          <p className="muted">An admin will verify your profile before it appears in search.</p>
        </>}
      </>}
      {err && <p className="error">{err}</p>}
      <button className="btn">{reg ? 'Create account' : 'Log in'}</button>
    </form>
  );
}

function Dashboard({ user }) {
  if (user.role === 'admin') return <Admin />;
  return <Bookings user={user} />;
}

function Bookings({ user }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const load = () => api('/bookings/mine').then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = (id, status) => api(`/bookings/${id}/status`, 'PATCH', { status }).then(load).catch((e) => setErr(e.message));
  const review = async (id) => {
    const rating = Number(prompt('Rating from 1 to 5')); if (!rating) return;
    await api('/reviews', 'POST', { booking: id, rating, comment: prompt('Add a comment (optional)') || '' }).then(load).catch((e) => setErr(e.message));
  };
  const isP = user.role === 'provider';
  return (
    <div className="pad">
      {isP && <ProfileForm />}
      <h2>{isP ? 'Booking requests' : 'Your bookings'}</h2>
      {err && <p className="error">{err}</p>}
      {!list.length && <p className="muted">{isP ? 'No requests yet.' : 'No bookings yet. Find a provider on the home page.'}</p>}
      {list.map((b) => (
        <div key={b._id} className="card row wrap">
          <div>
            <strong>{isP ? b.customer?.name : b.provider?.user?.name}</strong> · {b.date}, {b.slot}
            <p className="muted">{b.address}{b.note && ` · ${b.note}`}{isP && b.customer?.phone && ` · ${b.customer.phone}`}</p>
          </div>
          <div className="actions">
            <span className={'tag ' + b.status}>{b.status}</span>
            {isP && b.status === 'pending' && <><button className="btn small" onClick={() => act(b._id, 'accepted')}>Accept</button><button className="link" onClick={() => act(b._id, 'rejected')}>Reject</button></>}
            {isP && b.status === 'accepted' && <button className="btn small" onClick={() => act(b._id, 'completed')}>Mark completed</button>}
            {!isP && ['pending', 'accepted'].includes(b.status) && <button className="link" onClick={() => act(b._id, 'cancelled')}>Cancel</button>}
            {!isP && b.status === 'completed' && !b.reviewed && <button className="btn small" onClick={() => review(b._id)}>Write review</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileForm() {
  const [p, setP] = useState(null);
  const [ok, setOk] = useState('');
  useEffect(() => { api('/provider-profile').then(setP); }, []);
  if (!p) return null;
  const up = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const save = async (e) => { e.preventDefault(); await api('/provider-profile', 'PUT', p); setOk('Profile saved'); };
  return (
    <form className="panel" onSubmit={save}>
      <h3>Your profile {p.isVerified ? <span className="tag completed">verified</span> : <span className="tag pending">awaiting verification</span>}</h3>
      <div className="fields">
        <label>Service<select value={p.category} onChange={up('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>City<input value={p.city || ''} onChange={up('city')} /></label>
        <label>Price per visit (₹)<input type="number" min="0" value={p.price} onChange={up('price')} /></label>
        <label>Experience (years)<input type="number" min="0" value={p.experience} onChange={up('experience')} /></label>
      </div>
      <label>About your work<textarea value={p.bio || ''} onChange={up('bio')} /></label>
      <button className="btn small">Save profile</button> {ok && <span className="muted">{ok}</span>}
    </form>
  );
}

function Admin() {
  const [d, setD] = useState(null);
  const load = () => api('/admin/overview').then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <p className="pad">Loading...</p>;
  const toggle = (p) => api(`/admin/providers/${p._id}/verify`, 'PATCH', { isVerified: !p.isVerified }).then(load);
  const max = Math.max(1, ...d.byCategory.map((c) => c.count));
  return (
    <div className="pad">
      <h2>Overview</h2>
      <div className="stats">{Object.entries(d.stats).map(([k, v]) => <div key={k} className="panel"><strong className="big">{v}</strong><span className="muted">{k}</span></div>)}</div>
      <h3>Bookings by service</h3>
      {d.byCategory.map((c) => <div key={c._id} className="bar-row"><span>{c._id}</span><i style={{ width: `${(c.count / max) * 100}%` }} /><b>{c.count}</b></div>)}
      <h3>Providers</h3>
      {d.providers.map((p) => (
        <div key={p._id} className="card row"><div><strong>{p.user?.name}</strong> · {p.category} · {p.city}<p className="muted">{p.user?.email}</p></div>
          <button className={p.isVerified ? 'link' : 'btn small'} onClick={() => toggle(p)}>{p.isVerified ? 'Remove verification' : 'Verify'}</button></div>
      ))}
    </div>
  );
}
