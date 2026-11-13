import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  MapPin, Search, Sparkles, ShieldCheck, Zap, Globe2, Heart, UserRound,
  Bell, Settings, LogOut, LayoutDashboard, Store, ClipboardList,
  ChartNoAxesCombined, Star, Clock3, Menu, X, ChevronRight, SlidersHorizontal,
  Map, ArrowUpRight, Check, XCircle, Plus, BriefcaseBusiness, Users,
  FileCheck2, Tags, Flag, Activity, Phone, Navigation, MessageSquare,
  BadgeCheck, TrendingUp, Eye, Filter, CircleHelp, LockKeyhole, Languages,
  Building2, Wallet, CalendarDays, CheckCircle2, Trash2, Edit3, AlertTriangle,
  ExternalLink, CornerDownRight,
  Mic, MicOff, Lightbulb, Award, Scale
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import {
  BusinessVerificationPage,
  AdminSecurityCenter,
  SecurityProfileCard
} from './components/SecurityVerification';

const API = axios.create({ baseURL: 'http://127.0.0.1:5000/api' });

// Automatically attach Bearer token to all requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('ll_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const userStr = localStorage.getItem('ll_user');
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      if (u?.id) config.headers['X-User-Id'] = u.id;
    } catch (e) {}
  }
  return config;
});

const demoAccounts = {
  customer: ['customer@locallink.ai', 'User@123'],
  business: ['owner@locallink.ai', 'Owner@123'],
  admin: ['admin@locallink.ai', 'Admin@123']
};

const navItems = {
  customer: [
    { name: 'Home', path: '/customer/home', icon: LayoutDashboard },
    { name: 'Search Results', path: '/customer/search', icon: Search },
    { name: 'Business Details', path: '/customer/details', icon: Store },
    { name: 'Map View', path: '/customer/map', icon: Map },
    { name: 'Compare & Choose', path: '/customer/compare', icon: SlidersHorizontal },
    { name: 'My Requests', path: '/customer/requests', icon: ClipboardList },
    { name: 'Profile & Settings', path: '/customer/profile', icon: UserRound }
  ],
  business: [
    { name: 'Business Dashboard', path: '/business/home', icon: LayoutDashboard },
    { name: 'Manage Business', path: '/business/manage', icon: Store },
    { name: 'Verification & Trust', path: '/business/verification', icon: ShieldCheck },
    { name: 'Service Requests', path: '/business/requests', icon: ClipboardList },
    { name: 'Analytics', path: '/business/analytics', icon: ChartNoAxesCombined },
    { name: 'Reviews', path: '/business/reviews', icon: Star },
    { name: 'Availability', path: '/business/availability', icon: Clock3 },
    { name: 'Settings', path: '/business/settings', icon: Settings }
  ],
  admin: [
    { name: 'Admin Overview', path: '/admin/home', icon: LayoutDashboard },
    { name: 'User Management', path: '/admin/users', icon: Users },
    { name: 'Identity & Security', path: '/admin/verification', icon: ShieldCheck },
    { name: 'Reports & Insights', path: '/admin/reports', icon: ChartNoAxesCombined },
    { name: 'Manage Categories', path: '/admin/categories', icon: Tags },
    { name: 'Reported Content', path: '/admin/content', icon: Flag },
    { name: 'Settings', path: '/admin/settings', icon: Settings }
  ]
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const fallbackBusinesses = [
  { id: 1, name: 'TechFix Solutions', category: 'Electronics', description: 'Laptop, desktop and mobile repair with transparent upfront estimates.', address: 'Hampankatta, Mangaluru', area: 'Hampankatta', price_from: 299, rating: 4.8, reviews_count: 128, distance_km: 1.2, available: true, verified: true, image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?w=800', phone: '+91 98765 43210', working_hours: 'Mon - Sat: 9:00 AM - 7:30 PM, Sun: Closed' },
  { id: 2, name: 'SmartCare Electronics', category: 'Electronics', description: 'Motherboard repair, screen replacement and diagnostics.', address: 'Kadri, Mangaluru', area: 'Kadri', price_from: 349, rating: 4.6, reviews_count: 87, distance_km: 2.4, available: true, verified: true, image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800', phone: '+91 98222 33445', working_hours: 'Mon - Sat: 9:30 AM - 8:00 PM' },
  { id: 3, name: 'Laptop Doctor Plus', category: 'Electronics', description: 'Laptop servicing, RAM/SSD upgrades and data recovery.', address: 'Bejai, Mangaluru', area: 'Bejai', price_from: 399, rating: 4.7, reviews_count: 74, distance_km: 2.0, available: true, verified: false, image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800', phone: '+91 98111 22334', working_hours: 'Mon - Fri: 10:00 AM - 7:00 PM' },
  { id: 4, name: 'Fresh Bakes', category: 'Food & Dining', description: 'Fresh artisan breads, custom celebration cakes and pastries.', address: 'Kankanady, Mangaluru', area: 'Kankanady', price_from: 150, rating: 4.5, reviews_count: 62, distance_km: 1.8, available: true, verified: true, image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800', phone: '+91 98333 44556', working_hours: 'Daily: 7:00 AM - 10:00 PM' },
  { id: 5, name: 'Urban Cuts Studio', category: 'Personal Care', description: 'Modern haircuts, styling, beard grooming and skin treatments.', address: 'Balmatta, Mangaluru', area: 'Balmatta', price_from: 250, rating: 4.4, reviews_count: 51, distance_km: 3.1, available: true, verified: true, image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800', phone: '+91 98444 55667', working_hours: 'Tue - Sun: 9:00 AM - 8:30 PM' },
  { id: 6, name: 'Sunrise Electricals', category: 'Home Services', description: 'Home electrical repairs, switchboard wiring and appliance fixes.', address: 'Urwa, Mangaluru', area: 'Urwa', price_from: 199, rating: 4.3, reviews_count: 29, distance_km: 3.6, available: true, verified: false, image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800', phone: '+91 98555 66778', working_hours: 'Mon - Sat: 8:30 AM - 6:30 PM' }
];


// ==========================================
// ROOT APP COMPONENT
// ==========================================

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ll_user'));
    } catch {
      return null;
    }
  });

  const [businesses, setBusinesses] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [toast, setToast] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const notify = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const refreshBusinesses = async () => {
    try {
      const res = await API.get('/businesses');
      if (Array.isArray(res.data) && res.data.length > 0) {
        setBusinesses(res.data);
      } else {
        setBusinesses(fallbackBusinesses);
      }
    } catch (e) {
      setBusinesses(fallbackBusinesses);
    }
  };

  const refreshFavorites = async () => {
    if (!user || user.role !== 'customer') {
      setFavorites([]);
      return;
    }
    try {
      const res = await API.get('/favorites', { params: { user_id: user.id } });
      if (Array.isArray(res.data)) {
        setFavorites(res.data.map(b => b.id));
      }
    } catch (e) {
      setFavorites([]);
    }
  };

  useEffect(() => {
    refreshBusinesses();
  }, []);

  useEffect(() => {
    if (user?.id) refreshFavorites();
  }, [user?.id]);

  const toggleFavorite = async (businessId) => {
    if (!user) {
      notify('Please sign in as a customer to save favourites.');
      return;
    }
    try {
      const res = await API.post('/favorites', { user_id: user.id, business_id: businessId });
      const isSaved = res.data.saved;
      setFavorites(prev => isSaved ? [...prev, businessId] : prev.filter(id => id !== businessId));
      notify(isSaved ? 'Saved to favourites.' : 'Removed from favourites.');
    } catch (err) {
      notify('Could not update favourite status.');
    }
  };

  const logout = () => {
    localStorage.removeItem('ll_user');
    localStorage.removeItem('ll_token');
    setUser(null);
    notify('You have been signed out.');
  };

  const login = async (email, password) => {
    const res = await API.post('/login', { email, password });
    const { token, user: loggedUser } = res.data;
    localStorage.setItem('ll_token', token);
    localStorage.setItem('ll_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
    return loggedUser;
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing user={user} login={login} notify={notify} />} />
        <Route path="/login" element={<Login user={user} login={login} notify={notify} />} />
        <Route path="/register" element={<Register notify={notify} />} />

        {['customer', 'business', 'admin'].map((role) => (
          <Route
            key={role}
            path={`/${role}/*`}
            element={
              user?.role === role ? (
                <Dashboard
                  role={role}
                  user={user}
                  setUser={setUser}
                  businesses={businesses.length ? businesses : fallbackBusinesses}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  refreshBusinesses={refreshBusinesses}
                  refreshFavorites={refreshFavorites}
                  logout={logout}
                  notify={notify}
                  mobileOpen={mobileOpen}
                  setMobileOpen={setMobileOpen}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </>
  );
}


// ==========================================
// SHARED SHELL & LANDING COMPONENTS
// ==========================================

function Brand({ small = false }) {
  return (
    <div className={`brand ${small ? 'brand-small' : ''}`}>
      <span className="brand-mark">
        <MapPin size={small ? 18 : 23} />
      </span>
      <span>LocalLink <b>AI</b></span>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, text }) {
  return (
    <div className="feature-item">
      <span><Icon size={21} /></span>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
    </div>
  );
}

function CategoryIcon({ i }) {
  const icons = [Store, BriefcaseBusiness, Wallet, Heart, ShieldCheck, Globe2];
  const Icon = icons[i % icons.length];
  return <Icon size={21} />;
}

function Landing({ user, login, notify }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (user?.role === 'customer') {
      navigate(`/customer/search?q=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/login`);
    }
  };

  return (
    <div className="landing">
      <header className="topbar">
        <Brand />
        <nav>
          <a href="#discover">Discover</a>
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
        </nav>
        <div className="top-actions">
          {user ? (
            <button className="btn primary" onClick={() => navigate(`/${user.role}/home`)}>
              Go to Dashboard <ArrowUpRight size={16} />
            </button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => navigate('/login')}>Sign in</button>
              <button className="btn primary" onClick={() => navigate('/register')}>
                Get started <ArrowUpRight size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} /> YOUR NEIGHBOURHOOD, ONE SMART SEARCH AWAY
          </div>
          <h1>Find the right local service. <span>Without the guesswork.</span></h1>
          <p>
            Discover trusted businesses around you, compare transparent prices, check real-time availability, and connect directly with the experts who keep your community moving.
          </p>

          <form className="hero-search" onSubmit={handleHeroSearch}>
            <Search size={19} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Try ‘laptop repair near me’ or ‘bakery’"
            />
            <button type="submit" className="btn primary">
              Explore <ArrowUpRight size={16} />
            </button>
          </form>

          <div className="hero-trust">
            <span><ShieldCheck size={16} /> Verified local businesses</span>
            <span><Zap size={16} /> Smart matching</span>
            <span><MapPin size={16} /> Hyperlocal discovery</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-glow" />
          <div className="floating-card mini-top">
            <span className="mini-icon green"><ShieldCheck /></span>
            <div>
              <b>Trusted choices</b>
              <small>Verified businesses nearby</small>
            </div>
          </div>

          <div className="phone-card">
            <div className="phone-head">
              <Brand small />
              <span className="online-dot" />
            </div>
            <div className="phone-title">Find a service near you</div>
            <div className="phone-input">
              <Search size={14} /> Laptop repair <SlidersHorizontal size={13} />
            </div>
            <div className="map-art">
              <div className="road road-one" />
              <div className="road road-two" />
              <span className="pin p1"><MapPin /></span>
              <span className="pin p2"><MapPin /></span>
              <span className="pin p3"><MapPin /></span>
            </div>
            <div className="phone-result">
              <div className="business-thumb"><Store /></div>
              <div>
                <b>TechFix Solutions</b>
                <small>★ 4.8 · 1.2 km · Verified</small>
              </div>
              <strong>₹299+</strong>
            </div>
            <div className="phone-result">
              <div className="business-thumb pink"><Building2 /></div>
              <div>
                <b>SmartCare Electronics</b>
                <small>★ 4.6 · 2.4 km</small>
              </div>
              <strong>₹349+</strong>
            </div>
          </div>

          <div className="floating-card mini-bottom">
            <span className="mini-icon purple"><Sparkles /></span>
            <div>
              <b>Best match found</b>
              <small>Based on your budget & distance</small>
            </div>
            <span className="match-score">96%</span>
          </div>
        </div>
      </section>

      <section className="feature-strip" id="features">
        <FeatureItem icon={Sparkles} title="AI-powered discovery" text="Natural search with transparent relevance ranking." />
        <FeatureItem icon={BadgeCheck} title="Trust you can see" text="Admin-verified profiles and authentic reviews." />
        <FeatureItem icon={MapPin} title="Around your corner" text="Hyperlocal maps and precise distance filters." />
        <FeatureItem icon={Wallet} title="Compare with clarity" text="Know prices and services before you reach out." />
      </section>

      <section className="section" id="discover">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MADE FOR YOUR EVERYDAY</div>
            <h2>Everything local, <span>made simpler.</span></h2>
          </div>
          <p>From tech fixes to everyday essentials, discover reliable experts in your neighbourhood.</p>
        </div>
        <div className="category-grid">
          {['Electronics', 'Home Services', 'Food & Dining', 'Personal Care', 'Healthcare', 'Education'].map((x, i) => (
            <div
              className="category-card"
              key={x}
              onClick={() => {
                if (user?.role === 'customer') {
                  navigate(`/customer/search?category=${encodeURIComponent(x)}`);
                } else {
                  navigate('/login');
                }
              }}
            >
              <span className={`cat-icon c${i}`}><CategoryIcon i={i} /></span>
              <b>{x}</b>
              <small>Explore local experts</small>
              <ChevronRight size={17} />
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band" id="how">
        <div>
          <div className="eyebrow light">GROW WITH YOUR COMMUNITY</div>
          <h2>Are you a local business owner?</h2>
          <p>Put your business on the map. Connect with nearby customers and expand your reach.</p>
        </div>
        <button className="btn white" onClick={() => navigate('/register')}>
          List your business <ArrowUpRight size={16} />
        </button>
      </section>

      <footer>
        <Brand />
        <span>Smart solution. Stronger community. Support local, grow together.</span>
        <small>© 2026 LocalLink AI</small>
      </footer>
    </div>
  );
}

function AuthShell({ title, subtitle, children }) {
  const navigate = useNavigate();
  return (
    <div className="auth-page">
      <div className="auth-side">
        <Brand />
        <div>
          <div className="eyebrow light">DISCOVER · CONNECT · GROW</div>
          <h1>Your neighbourhood has more to offer.</h1>
          <p>Find trusted local businesses, compare services and support the people around you.</p>
        </div>
        <small>LocalLink AI · Smart local discovery</small>
      </div>
      <div className="auth-main">
        <div className="auth-card">
          <button className="back-link" onClick={() => navigate('/')}>
            ← Back to home
          </button>
          <h2>{title}</h2>
          <p>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function Login({ user, login, notify }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState(demoAccounts.customer[0]);
  const [password, setPassword] = useState(demoAccounts.customer[1]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.role) {
      navigate(`/${user.role}/home`, { replace: true });
    }
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      notify(`Welcome back, ${u.name}!`);
      navigate(`/${u.role}/home`);
    } catch (err) {
      notify(err.response?.data?.error || 'Invalid email or password. Please verify credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to discover, manage and connect with your local community."
    >
      <form onSubmit={submit} className="form">
        <label>
          Email address
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in to LocalLink'} <ArrowUpRight size={16} />
        </button>
      </form>

      <div className="demo-box">
        <b>Quick fill demo accounts:</b>
        {Object.entries(demoAccounts).map(([r, v]) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setEmail(v[0]);
              setPassword(v[1]);
            }}
          >
            <span>{r === 'business' ? 'Business Owner' : r[0].toUpperCase() + r.slice(1)}</span>
            <small>{v[0]}</small>
          </button>
        ))}
      </div>

      <p className="auth-foot">
        New to LocalLink? <a onClick={() => navigate('/register')}>Create an account</a>
      </p>
    </AuthShell>
  );
}

function Register({ notify }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'customer',
    phone: ''
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await API.post('/register', form);
      notify('Account created successfully! Please sign in.');
      navigate('/login');
    } catch (err) {
      notify(err.response?.data?.error || 'Registration failed. Please check inputs.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Join LocalLink AI"
      subtitle="Create your account to discover or grow local services."
    >
      <form className="form" onSubmit={submit}>
        <label>
          Full name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Your full name"
          />
        </label>
        <label>
          Email address
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
          />
        </label>
        <label>
          Phone number
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+91 98765 43210"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            minLength="6"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="At least 6 characters"
          />
        </label>
        <label>
          Account type
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="customer">Customer (Discover & request services)</option>
            <option value="business">Business Owner (List and manage businesses)</option>
          </select>
        </label>
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'} <ArrowUpRight size={16} />
        </button>
      </form>
      <p className="auth-foot">
        Already registered? <a onClick={() => navigate('/login')}>Sign in</a>
      </p>
    </AuthShell>
  );
}


// ==========================================
// MAIN DASHBOARD SHELL
// ==========================================

function Dashboard({
  role,
  user,
  setUser,
  businesses,
  favorites,
  toggleFavorite,
  refreshBusinesses,
  refreshFavorites,
  logout,
  notify,
  mobileOpen,
  setMobileOpen
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentNav = navItems[role]?.find(x => location.pathname.startsWith(x.path)) || navItems[role][0];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="side-brand">
          <Brand />
          <button className="mobile-close" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className="side-role">
          {role === 'customer'
            ? 'CUSTOMER SPACE'
            : role === 'business'
            ? 'BUSINESS WORKSPACE'
            : 'PLATFORM CONTROL'}
        </div>

        <div className="side-user">
          <div className="avatar">
            {(user?.name || 'User')
              .split(' ')
              .map((x) => x[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div>
            <b>{user?.name}</b>
            <small>
              {role === 'business'
                ? 'Business Owner'
                : role === 'admin'
                ? 'Administrator'
                : 'Customer'}
            </small>
          </div>
          <span className="online-dot" />
        </div>

        <nav className="side-nav">
          {navItems[role].map((item, i) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                className={isActive ? 'active' : ''}
                to={item.path}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
                {i === 0 && <span className="nav-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="side-bottom">
          <div className="help-card">
            <span><CircleHelp size={18} /></span>
            <b>Need assistance?</b>
            <small>Support available 24/7.</small>
            <button onClick={() => notify('LocalLink Support: support@locallink.ai')}>
              Visit help centre <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="logout" onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
          <small className="version">LocalLink AI · v1.2 Release</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="app-header">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="crumb">
            {role[0].toUpperCase() + role.slice(1)} <ChevronRight size={14} /> <b>{currentNav.name}</b>
          </div>
          <div className="header-actions">
            <span className="location-chip">
              <MapPin size={14} /> Mangaluru, IN
            </span>
            <button
              className="icon-btn"
              onClick={() => notify('Notifications are all caught up!')}
              title="Notifications"
            >
              <Bell size={18} />
              <i />
            </button>
            <div className="header-avatar">
              {(user?.name || 'U')[0]}
            </div>
          </div>
        </header>

        <div className="page-wrap">
          <Routes>
            {/* Customer Routes (7 pages) */}
            <Route
              path="home"
              element={
                <HomePage
                  role={role}
                  user={user}
                  businesses={businesses}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  notify={notify}
                />
              }
            />
            <Route
              path="search"
              element={
                <SearchPage
                  businesses={businesses}
                  user={user}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  notify={notify}
                />
              }
            />
            <Route
              path="details"
              element={
                <DetailsPage
                  businesses={businesses}
                  user={user}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  notify={notify}
                />
              }
            />
            <Route
              path="map"
              element={
                <MapPage
                  businesses={businesses}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  notify={notify}
                />
              }
            />
            <Route
              path="compare"
              element={
                <ComparePage
                  businesses={businesses}
                  notify={notify}
                />
              }
            />
            <Route
              path="requests"
              element={
                <RequestsPage
                  role={role}
                  user={user}
                  notify={notify}
                />
              }
            />
            <Route
              path="profile"
              element={
                <ProfilePage
                  user={user}
                  setUser={setUser}
                  businesses={businesses}
                  favorites={favorites}
                  notify={notify}
                />
              }
            />

            {/* Business Owner Routes (7 pages) */}
            <Route
              path="manage"
              element={
                <ManagePage
                  user={user}
                  refreshBusinesses={refreshBusinesses}
                  notify={notify}
                />
              }
            />
            <Route
              path="analytics"
              element={
                <AnalyticsPage
                  role={role}
                  user={user}
                />
              }
            />
            <Route
              path="reviews"
              element={
                <ReviewsPage
                  role={role}
                  user={user}
                  notify={notify}
                />
              }
            />
            <Route
              path="availability"
              element={
                <AvailabilityPage
                  user={user}
                  refreshBusinesses={refreshBusinesses}
                  notify={notify}
                />
              }
            />
            <Route
              path="settings"
              element={
                role === 'admin' ? (
                  <AdminSettings user={user} notify={notify} />
                ) : (
                  <SettingsPage user={user} notify={notify} />
                )
              }
            />

            {/* Admin Routes (7 pages) */}
            <Route
              path="users"
              element={<UsersPage notify={notify} />}
            />
            <Route
              path="verification"
              element={
                role === 'business' ? (
                  <BusinessVerificationPage
                    user={user}
                    businesses={businesses}
                    refreshBusinesses={refreshBusinesses}
                    notify={notify}
                  />
                ) : (
                  <AdminSecurityCenter
                    refreshBusinesses={refreshBusinesses}
                    notify={notify}
                  />
                )
              }
            />
            <Route
              path="security"
              element={
                <AdminSecurityCenter
                  refreshBusinesses={refreshBusinesses}
                  notify={notify}
                />
              }
            />
            <Route
              path="reports"
              element={<AdminReportsPage notify={notify} />}
            />
            <Route
              path="categories"
              element={<CategoriesPage notify={notify} />}
            />
            <Route
              path="content"
              element={
                <ContentPage
                  refreshBusinesses={refreshBusinesses}
                  notify={notify}
                />
              }
            />

            <Route path="*" element={<Navigate to="home" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta, color = 'violet' }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${color}`}>
        <Icon size={19} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        {delta && <em>{delta}</em>}
      </div>
    </div>
  );
}

function SectionHead({ title, subtitle, action, onActionClick }) {
  return (
    <div className="section-head">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (onActionClick) onActionClick();
          }}
        >
          {action} <ChevronRight size={14} />
        </a>
      )}
    </div>
  );
}

function BusinessGrid({ businesses, userId, favorites = [], toggleFavorite, notify }) {
  return (
    <div className="business-grid">
      {businesses.map((b) => (
        <BusinessCard
          key={b.id}
          b={b}
          userId={userId}
          isFavorite={favorites.includes(b.id)}
          toggleFavorite={toggleFavorite}
          notify={notify}
        />
      ))}
    </div>
  );
}


// ==========================================
// INNOVATIVE FEATURES 1-5 COMPONENTS
// ==========================================

function TrustScoreBadge({ trust, onClick }) {
  if (!trust) return null;
  const score = trust.score ?? 50;
  const colorClass = score >= 80 ? 'trust-high' : score >= 60 ? 'trust-med' : 'trust-low';
  return (
    <button
      type="button"
      className={`trust-badge-btn ${colorClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      title="Click to view Local Trust Score factor breakdown"
    >
      <ShieldCheck size={12} />
      <span>Trust {score}/100</span>
    </button>
  );
}

function TrustScoreModal({ business, onClose }) {
  if (!business) return null;
  const trust = business.trust || {
    score: 80,
    level: 'Verified Local Business',
    breakdown: {
      verification: { points: 20, max: 20, desc: 'Registered and verified listing' },
      reviews: { points: 20, max: 25, desc: 'Positive customer ratings' },
      completed_jobs: { points: 15, max: 20, desc: 'Completed service requests' },
      sla_response: { points: 15, max: 20, desc: 'Fast response and acceptance rate' },
      disputes: { points: 15, max: 15, desc: 'Zero customer complaints or disputes' }
    },
    suggestions: []
  };

  const factorTitles = {
    verification: 'Business Verification (20%)',
    reviews: 'Customer Ratings & Reviews (25%)',
    completed_jobs: 'Completed Jobs History (20%)',
    sla_response: 'Response & Completion SLA (20%)',
    disputes: 'Dispute & Complaint History (15%)'
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card trust-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Local Trust Score™</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="trust-modal-hero">
          <div className="trust-gauge">
            <strong>{trust.score}</strong>
            <small>Score</small>
          </div>
          <div className="trust-hero-info">
            <h4>{business.name}</h4>
            <p>{trust.level} — Transparent 0-100 rating derived strictly from database verification, customer ratings, job volume, response SLA, and clean dispute history.</p>
          </div>
        </div>

        <div className="trust-factor-list">
          {Object.entries(trust.breakdown || {}).map(([key, factor]) => {
            const pct = Math.round((factor.points / factor.max) * 100);
            return (
              <div className="trust-factor-item" key={key}>
                <div className="trust-factor-head">
                  <b><ShieldCheck size={14} color="#7c3aed" /> {factorTitles[key] || key}</b>
                  <span className="points">{factor.points} / {factor.max} pts</span>
                </div>
                <div className="trust-progress-bg">
                  <div className="trust-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <small>{factor.desc}</small>
              </div>
            );
          })}
        </div>

        {trust.suggestions && trust.suggestions.length > 0 && (
          <div className="trust-suggestions">
            <h5><Lightbulb size={14} /> Suggestions to Improve Score:</h5>
            <ul>
              {trust.suggestions.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn primary small" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function VoiceSearchButton({ onResult, onVoiceParse, notify }) {
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('en-IN'); // en-IN, kn-IN, hi-IN

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (notify) notify('Voice recognition is not supported in this browser. Please type your query or use Chrome/Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        setListening(false);
        if (onResult) onResult(transcript);

        try {
          const res = await API.post('/voice-search/parse', { text: transcript, language: lang });
          if (onVoiceParse) onVoiceParse(res.data, transcript);
          if (notify) notify(`Voice input received: "${transcript}"`);
        } catch {
          // ignore fallback
        }
      };

      recognition.onerror = (e) => {
        setListening(false);
        if (notify) notify(`Voice input: ${e.error === 'not-allowed' ? 'Microphone permission denied' : 'Voice capture ended'}`);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognition.start();
    } catch {
      setListening(false);
      if (notify) notify('Could not start voice recognition.');
    }
  };

  return (
    <div className="voice-search-group">
      <select
        className="voice-lang-select"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        title="Select Voice Language (English, Kannada, Hindi)"
      >
        <option value="en-IN">Eng (IN)</option>
        <option value="kn-IN">ಕನ್ನಡ (KN)</option>
        <option value="hi-IN">हिन्दी (HI)</option>
      </select>
      <button
        type="button"
        className={`voice-mic-btn ${listening ? 'listening' : ''}`}
        onClick={startListening}
        title={listening ? 'Listening... Speak now' : 'Voice Search (Kannada, Hindi, English)'}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      {listening && (
        <span className="voice-listening-toast">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
          Listening...
        </span>
      )}
    </div>
  );
}

function SmartMatchSection({ user, notify, onSelectBusiness, onBookService }) {
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState('');
  const [budget, setBudget] = useState('');
  const [urgency, setUrgency] = useState('Normal');
  const [date, setDate] = useState('Today');
  const [latitude, setLatitude] = useState(12.9716);
  const [longitude, setLongitude] = useState(77.5946);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedTrustBusiness, setSelectedTrustBusiness] = useState(null);

  const samplePrompts = [
    'I need an electrician near me to repair a ceiling fan today. My budget is around 500.',
    'Emergency plumber for leaking sink pipe urgent today under 400.',
    'Laptop screen replacement and repair service within 2000.',
    'Professional deep house cleaning service for 2BHK tomorrow under 1500.'
  ];

  const handleSmartMatch = async (customReq) => {
    const textToMatch = customReq || requirement;
    if (!textToMatch.trim()) {
      notify('Please describe what service you need in natural language.');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/smartmatch', {
        requirement: textToMatch,
        budget: budget ? Number(budget) : undefined,
        urgency,
        date,
        latitude,
        longitude,
        user_id: user?.id
      });
      setResults(res.data);
      if (!res.data?.results || res.data.results.length === 0) {
        notify('No direct matches found. Try broadening your requirement.');
      }
    } catch {
      notify('SmartMatch recommendation service failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          notify('Updated location with GPS coordinates!');
        },
        () => notify('Could not retrieve current location. Using Bangalore default.')
      );
    }
  };

  return (
    <div className="smartmatch-box">
      <div className="smartmatch-header">
        <div className="smartmatch-header-left">
          <h3>
            <Sparkles size={20} color="#7c3aed" />
            AI SmartMatch™
            <span className="smartmatch-badge">Multi-Factor Engine</span>
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: '#6d28d9' }}>
            Describe what you need in everyday language — our AI evaluates services, distance, budget fit, SLA, and trust score.
          </p>
        </div>
        <VoiceSearchButton
          onResult={(text) => {
            setRequirement(text);
            handleSmartMatch(text);
          }}
          notify={notify}
        />
      </div>

      <div className="smartmatch-input-wrap">
        <textarea
          className="smartmatch-textarea"
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder="e.g. 'I need an electrician near me to repair a ceiling fan today. My budget is around ₹500.'"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSmartMatch();
            }
          }}
        />
      </div>

      <div className="smartmatch-quick-pills">
        <span>Try prompts:</span>
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            type="button"
            className="quick-pill-btn"
            onClick={() => {
              setRequirement(p);
              handleSmartMatch(p);
            }}
          >
            {p.split(' ')[2]} {p.split(' ')[3]}…
          </button>
        ))}
      </div>

      <div className="smartmatch-filters">
        <div className="smartmatch-field">
          <label>Budget (₹ max)</label>
          <input
            type="number"
            placeholder="e.g. 500"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="smartmatch-field">
          <label>Preferred Date</label>
          <select value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="Today">Today</option>
            <option value="Tomorrow">Tomorrow</option>
            <option value="This Weekend">This Weekend</option>
          </select>
        </div>
        <div className="smartmatch-field">
          <label>Urgency</label>
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent (Immediate)</option>
          </select>
        </div>
        <div className="smartmatch-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="btn ghost small full"
            onClick={useCurrentLocation}
            title="Detect GPS coordinates"
          >
            <MapPin size={13} /> GPS Location
          </button>
        </div>
        <div className="smartmatch-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            className="btn primary full"
            onClick={() => handleSmartMatch()}
            disabled={loading}
          >
            {loading ? 'Analyzing...' : <><Sparkles size={14} /> Find Best Match</>}
          </button>
        </div>
      </div>

      {results && (
        <div className="smartmatch-results-wrap">
          <div className="smartmatch-results-head">
            <b style={{ color: '#3b0764', fontSize: 14 }}>
              Top Recommendations ({results.results?.length || 0}) for &ldquo;{results.query}&rdquo;
            </b>
            <span style={{ fontSize: 11, color: '#6d28d9' }}>
              Extracted: {results.extracted_requirement?.service_type || 'General'} · Budget: ₹{results.extracted_requirement?.budget || 'Any'}
            </span>
          </div>

          {results.results?.map((item) => {
            const b = item.business;
            return (
              <div className="smartmatch-card" key={b.id}>
                <div className="smartmatch-card-top">
                  <div className="smartmatch-card-main">
                    <h4>{b.name}</h4>
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      {b.category} · {b.area || b.address}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="match-score-badge">
                      <Sparkles size={12} /> {item.match_score}% Match
                    </span>
                    <TrustScoreBadge
                      trust={b.trust}
                      onClick={() => setSelectedTrustBusiness(b)}
                    />
                  </div>
                </div>

                <div className="ai-rationale">
                  <strong>Recommendation Rationale: </strong>
                  {item.explanation}
                </div>

                <div className="smartmatch-card-meta">
                  <span>★ {b.rating} ({b.reviews_count || 0} reviews)</span>
                  <span><MapPin size={13} /> {item.distance_km} km away</span>
                  <span>From {money(b.price_from)}</span>
                  <span className={b.available ? 'badge-success' : 'badge-danger'}>
                    {b.available ? 'Open Now' : 'Closed'}
                  </span>
                </div>

                <div className="smartmatch-card-actions">
                  <button
                    type="button"
                    className="btn outline small"
                    onClick={() => navigate(`/customer/details?id=${b.id}`)}
                  >
                    View Details
                  </button>
                  <button
                    type="button"
                    className="btn primary small"
                    onClick={() => {
                      if (onBookService) {
                        onBookService(b);
                      } else {
                        navigate(`/customer/details?id=${b.id}`);
                      }
                    }}
                  >
                    Book Service
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTrustBusiness && (
        <TrustScoreModal
          business={selectedTrustBusiness}
          onClose={() => setSelectedTrustBusiness(null)}
        />
      )}
    </div>
  );
}

function QuoteChallengeModal({ user, onClose, onSuccess, notify }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Home Services');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [urgency, setUrgency] = useState('Normal');
  const [preferredDate, setPreferredDate] = useState('Today');
  const [preferredTime, setPreferredTime] = useState('Afternoon (2-5 PM)');
  const [location, setLocation] = useState('Indiranagar, Bangalore');
  const [submitting, setSubmitting] = useState(false);

  const categories = [
    'Home Services', 'Electronics', 'Personal Care', 'Healthcare',
    'Food & Dining', 'Education', 'Automotive', 'Professional Services'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      notify('Please enter a challenge title and detailed description.');
      return;
    }
    setSubmitting(true);
    try {
      await API.post('/quotes/requests', {
        customer_id: user.id,
        title,
        category,
        description,
        budget: budget ? Number(budget) : null,
        urgency,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        location
      });
      notify('Quote Challenge posted! Local businesses have been notified to bid.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not post quote challenge.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Request Multiple Quotes</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <p style={{ margin: '0 0 16px 0', fontSize: 12, color: '#6d28d9' }}>
          Post your requirement once. Verified neighbourhood businesses will submit competitive quotations for you to compare and choose.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Service Needed / Title *</label>
            <input
              style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
              placeholder="e.g. Deep cleaning of 2BHK apartment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Category</label>
              <select
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Max Budget (₹)</label>
              <input
                type="number"
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                placeholder="e.g. 1500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Requirement Details / Scope *</label>
            <textarea
              style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', minHeight: 70, boxSizing: 'border-box' }}
              placeholder="Specify room size, type of appliances, issues observed..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Preferred Date</label>
              <input
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Urgency</label>
              <select
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Location / Neighbourhood</label>
            <input
              style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn outline small" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary small" disabled={submitting}>
              {submitting ? 'Posting...' : 'Post Quote Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubmitQuoteModal({ challenge, business, onClose, onSuccess, notify }) {
  const [price, setPrice] = useState('');
  const [proposedDate, setProposedDate] = useState(challenge?.preferred_date || 'Today');
  const [proposedTime, setProposedTime] = useState(challenge?.preferred_time || '2:00 PM');
  const [duration, setDuration] = useState('1.5 hours');
  const [includedServices, setIncludedServices] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!price || Number(price) <= 0) {
      notify('Please enter a valid quoted price.');
      return;
    }
    setSubmitting(true);
    try {
      await API.post('/quotes/submissions', {
        quote_request_id: challenge.id,
        business_id: business.id,
        price: Number(price),
        proposed_date: proposedDate,
        proposed_time: proposedTime,
        estimated_duration: duration,
        included_services: includedServices,
        message
      });
      notify('Quotation submitted successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not submit quote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Submit Business Quotation</h3>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ background: '#f5f3ff', padding: '10px 14px', borderRadius: 10, marginBottom: 14 }}>
          <b style={{ color: '#3b0764', fontSize: 13 }}>{challenge.title}</b>
          <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#6d28d9' }}>
            Customer Budget: ₹{challenge.budget || 'Open'} · {challenge.location} · Urgency: {challenge.urgency}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Quoted Price (₹) *</label>
              <input
                type="number"
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                placeholder="e.g. 450"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Estimated Duration</label>
              <input
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                placeholder="e.g. 1-2 hours"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Proposed Date</label>
              <input
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Proposed Time</label>
              <input
                style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
                value={proposedTime}
                onChange={(e) => setProposedTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Included Services Breakdown</label>
            <input
              style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', boxSizing: 'border-box' }}
              placeholder="e.g. Parts inspection, lubrication, warranty included"
              value={includedServices}
              onChange={(e) => setIncludedServices(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#4c1d95' }}>Message to Customer</label>
            <textarea
              style={{ width: '100%', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 10px', minHeight: 60, boxSizing: 'border-box' }}
              placeholder="Introduce your team, nearby location, or special guarantee..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn outline small" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary small" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Send Quotation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuoteChallengesSection({ role, user, notify }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChallengeForQuote, setSelectedChallengeForQuote] = useState(null);
  const [ownerBusiness, setOwnerBusiness] = useState(null);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const params = {};
      if (role === 'customer') {
        params.customer_id = user?.id;
      }
      const res = await API.get('/quotes/requests', { params });
      setChallenges(res.data);
    } catch {
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChallenges();
    if (role === 'business') {
      API.get('/businesses').then((res) => {
        const myBiz = res.data.find((b) => b.owner_id === user?.id);
        if (myBiz) setOwnerBusiness(myBiz);
      }).catch(() => {});
    }
  }, [role, user?.id]);

  const handleAcceptQuote = async (challengeId, submissionId, bizName) => {
    try {
      await API.post(`/quotes/requests/${challengeId}/accept`, {
        submission_id: submissionId
      });
      notify(`Accepted quote from ${bizName}! Service booking created.`);
      fetchChallenges();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not accept quote.');
    }
  };

  const handleCancelChallenge = async (challengeId) => {
    try {
      await API.patch(`/quotes/requests/${challengeId}/cancel`);
      notify('Quote Challenge cancelled.');
      fetchChallenges();
    } catch {
      notify('Could not cancel challenge.');
    }
  };

  return (
    <div className="panel" style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800, color: '#2e1065' }}>
            {role === 'customer' ? 'Your Multi-Business Quote Challenges' : 'Open Quote Opportunities for You'}
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: '#6d28d9' }}>
            {role === 'customer'
              ? 'Receive competitive quotes from verified providers, compare terms, and accept the best offer.'
              : 'Submit competitive quotes to nearby customer requirements to win new business.'}
          </p>
        </div>

        {role === 'customer' && (
          <button type="button" className="btn primary small" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> Request Multiple Quotes
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>Loading quote challenges...</div>
      ) : challenges.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', background: '#faf5ff', borderRadius: '12px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No quote challenges found.</p>
          {role === 'customer' && (
            <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>
              Click &quot;Request Multiple Quotes&quot; above to invite competitive bids from local providers!
            </p>
          )}
        </div>
      ) : (
        challenges.map((c) => {
          const submissions = c.submissions || [];
          const mySubmission = role === 'business' && ownerBusiness
            ? submissions.find((s) => s.business_id === ownerBusiness.id)
            : null;

          return (
            <div className="quote-challenge-card" key={c.id}>
              <div className="quote-challenge-head">
                <div>
                  <h4>{c.title}</h4>
                  <span style={{ fontSize: '11px', color: '#6b7280' }}>
                    Category: <strong>{c.category}</strong> · Posted {c.created_at}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`status-pill ${c.status.toLowerCase()}`}>
                    {c.status}
                  </span>
                  {role === 'customer' && c.status === 'Open' && (
                    <button
                      type="button"
                      className="btn danger small"
                      style={{ padding: '4px 8px', fontSize: '10px' }}
                      onClick={() => handleCancelChallenge(c.id)}
                    >
                      Cancel Challenge
                    </button>
                  )}
                </div>
              </div>

              <p style={{ margin: '6px 0 10px 0', fontSize: '13px', color: '#374151' }}>
                {c.description}
              </p>

              <div className="quote-challenge-meta">
                <span>💰 Budget: <strong>{c.budget ? money(c.budget) : 'Flexible'}</strong></span>
                <span>📅 Date: <strong>{c.preferred_date} ({c.preferred_time || 'Anytime'})</strong></span>
                <span>⚡ Urgency: <strong>{c.urgency}</strong></span>
                <span>📍 Location: <strong>{c.location}</strong></span>
                <span>💬 Quotes: <strong>{submissions.length} received</strong></span>
              </div>

              {submissions.length > 0 && (
                <div>
                  <b style={{ fontSize: '12px', color: '#4c1d95', display: 'block', marginBottom: '8px' }}>
                    Submitted Quotations ({submissions.length}):
                  </b>
                  <div className="quote-submissions-grid">
                    {submissions.map((sub) => (
                      <div
                        className={`quote-sub-card ${sub.status === 'Accepted' ? 'accepted-sub' : ''}`}
                        key={sub.id}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px', color: '#1f2937' }}>{sub.business_name}</strong>
                          <span className={`status-pill ${sub.status.toLowerCase()}`}>
                            {sub.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="quote-sub-price">{money(sub.price)}</span>
                          {sub.estimated_duration && (
                            <small style={{ color: '#6b7280' }}>· ~{sub.estimated_duration}</small>
                          )}
                        </div>

                        {sub.included_services && (
                          <div style={{ fontSize: '11px', color: '#4b5563' }}>
                            <strong>Included: </strong>{sub.included_services}
                          </div>
                        )}
                        {sub.message && (
                          <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                            &ldquo;{sub.message}&rdquo;
                          </div>
                        )}

                        <div style={{ fontSize: '10px', color: '#8b5cf6', marginTop: 'auto' }}>
                          Proposed: {sub.proposed_date} at {sub.proposed_time}
                        </div>

                        {role === 'customer' && c.status === 'Open' && sub.status === 'Submitted' && (
                          <button
                            type="button"
                            className="btn primary small full"
                            style={{ marginTop: '8px' }}
                            onClick={() => handleAcceptQuote(c.id, sub.id, sub.business_name)}
                          >
                            <Check size={14} /> Accept This Quote
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {role === 'business' && c.status === 'Open' && (
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  {mySubmission ? (
                    <span className="badge-secondary">
                      You quoted {money(mySubmission.price)} ({mySubmission.status})
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn primary small"
                      onClick={() => setSelectedChallengeForQuote(c)}
                    >
                      <Plus size={14} /> Submit Business Quotation
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {showCreateModal && (
        <QuoteChallengeModal
          user={user}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchChallenges}
          notify={notify}
        />
      )}

      {selectedChallengeForQuote && ownerBusiness && (
        <SubmitQuoteModal
          challenge={selectedChallengeForQuote}
          business={ownerBusiness}
          onClose={() => setSelectedChallengeForQuote(null)}
          onSuccess={fetchChallenges}
          notify={notify}
        />
      )}
    </div>
  );
}

function BusinessGrowthAssistant({ user, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      API.get('/owner/growth-assistant', { params: { owner_id: user.id } })
        .then((res) => setData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  if (loading || !data) return null;

  const kpis = data.kpis || {};
  const recs = data.recommendations || [];

  return (
    <div className="growth-assistant-panel">
      <div className="growth-header">
        <div className="growth-title">
          <Sparkles size={20} color="#7c3aed" />
          <h3>AI Business Growth Assistant</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>
            {data.business?.name}
          </span>
          <span className="badge-secondary">
            Health: {data.growth_score || 85}/100
          </span>
        </div>
      </div>

      <div className="growth-kpi-bar">
        <div className="growth-kpi-item">
          <span>Views</span>
          <b>{kpis.views || 0}</b>
        </div>
        <div className="growth-kpi-item">
          <span>Inquiries</span>
          <b>{kpis.total_requests || 0}</b>
        </div>
        <div className="growth-kpi-item">
          <span>Conversion</span>
          <b>{kpis.conversion_rate || 0}%</b>
        </div>
        <div className="growth-kpi-item">
          <span>Unanswered</span>
          <b style={{ color: (kpis.unanswered_requests || 0) > 0 ? '#dc2626' : '#059669' }}>
            {kpis.unanswered_requests || 0}
          </b>
        </div>
        <div className="growth-kpi-item">
          <span>Rating</span>
          <b>★ {kpis.avg_rating || 5.0}</b>
        </div>
      </div>

      <div className="growth-recs-list">
        {recs.map((rec) => (
          <div className={`growth-rec-card priority-${rec.priority.toLowerCase()}`} key={rec.id}>
            <div className="growth-rec-top">
              <b>{rec.title}</b>
              <span className={`growth-priority-pill ${rec.priority.toLowerCase()}`}>
                {rec.priority} Priority
              </span>
            </div>
            <div className="growth-rec-evidence">
              📊 <strong>Data Evidence: </strong>{rec.evidence}
            </div>
            <div className="growth-rec-action">
              💡 <strong>Action: </strong>{rec.action}
            </div>
            <div className="growth-rec-foot">
              <span>🚀 Impact: {rec.impact}</span>
              {rec.action_url && (
                <button
                  type="button"
                  className="btn ghost small"
                  style={{ padding: '4px 8px', fontSize: 10 }}
                  onClick={() => navigate(rec.action_url)}
                >
                  Take Action <ArrowUpRight size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusinessCard({ b, isFavorite, toggleFavorite, notify }) {
  const navigate = useNavigate();
  const [showTrust, setShowTrust] = useState(false);

  return (
    <div className="business-card">
      <div className="business-image" style={{ backgroundImage: `url(${b.image})` }}>
        <span className="category-pill">{b.category}</span>
        <button
          className={`save-heart ${isFavorite ? 'favorited' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (toggleFavorite) toggleFavorite(b.id);
          }}
          title={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
        >
          <Heart size={17} />
        </button>
      </div>
      <div className="business-card-body">
        <div className="business-name-row">
          <h4>{b.name}</h4>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            {b.verified && (
              <span className="verified">
                <BadgeCheck size={13} /> Verified
              </span>
            )}
            {b.trust && (
              <TrustScoreBadge trust={b.trust} onClick={() => setShowTrust(true)} />
            )}
          </div>
        </div>
        <p>{b.description}</p>
        <div className="business-meta">
          <span>★ {b.rating} <small>({b.reviews_count || 0})</small></span>
          <span><MapPin size={13} />{b.distance_km} km</span>
          <span className={b.available ? 'available' : 'closed'}>
            <i />
            {b.available ? 'Open' : 'Closed'}
          </span>
        </div>
        <div className="business-card-foot">
          <b>From {money(b.price_from)}</b>
          <button
            onClick={() => navigate(`/customer/details?id=${b.id}`)}
          >
            View details <ChevronRight size={14} />
          </button>
        </div>
        {showTrust && <TrustScoreModal business={b} onClose={() => setShowTrust(false)} />}
      </div>
    </div>
  );
}


// ==========================================
// 1. HOME PAGES (Customer, Business, Admin)
// ==========================================

function HomePage({ role, user, businesses, favorites, toggleFavorite, notify }) {
  const navigate = useNavigate();
  const [adminStats, setAdminStats] = useState(null);
  const [ownerStats, setOwnerStats] = useState(null);

  useEffect(() => {
    if (role === 'admin') {
      API.get('/admin/overview').then(r => setAdminStats(r.data)).catch(() => {});
    } else if (role === 'business') {
      API.get('/owner/analytics', { params: { owner_id: user.id } })
        .then(r => setOwnerStats(r.data))
        .catch(() => {});
    }
  }, [role, user.id]);

  if (role === 'customer') {
    return (
      <>
        <PageTitle
          eyebrow="YOUR LOCAL DISCOVERY"
          title={<>Find the right service, <span>near you.</span></>}
          subtitle="Discover verified businesses, compare prices and book trusted neighbourhood experts."
        />

        <div className="customer-hero">
          <div className="customer-hero-copy">
            <div className="hero-tag"><Sparkles size={14} /> SMARTER LOCAL SEARCH</div>
            <h2>What can we help you find today?</h2>
            <p>Tell us what you need. We'll match you with the right verified professional.</p>
            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Search for laptop repair, cleaning, bakery, salon…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/customer/search?q=${encodeURIComponent(e.target.value)}`);
                  }
                }}
              />
              <VoiceSearchButton
                onResult={(text) => navigate(`/customer/search?q=${encodeURIComponent(text)}`)}
                notify={notify}
              />
              <button onClick={(e) => {
                const input = e.currentTarget.parentElement.querySelector('input');
                navigate(`/customer/search?q=${encodeURIComponent(input.value)}`);
              }}>
                Search <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="quick-tags">
              <span>Popular:</span>
              {['Laptop repair', 'Home cleaning', 'Bakery', 'Electrician', 'Hair salon'].map((tag) => (
                <button
                  key={tag}
                  onClick={() => navigate(`/customer/search?q=${encodeURIComponent(tag)}`)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="customer-hero-art">
            <div className="art-orbit orbit-a" />
            <div className="art-orbit orbit-b" />
            <div className="art-pin"><MapPin size={56} /></div>
            <div className="art-float f-one"><ShieldCheck size={15} /> Verified picks</div>
            <div className="art-float f-two"><Sparkles size={15} /> Smart matches</div>
          </div>
        </div>

        <SmartMatchSection user={user} notify={notify} />

        <div className="stats-grid">
          <Stat
            icon={ShieldCheck}
            label="Verified businesses"
            value={businesses.filter(b => b.verified).length || '120+'}
            delta="Trusted neighbourhood choice"
            color="green"
          />
          <Stat
            icon={MapPin}
            label="Services nearby"
            value={`${businesses.length} available`}
            delta="Across local categories"
            color="blue"
          />
          <Stat
            icon={Heart}
            label="Your saved places"
            value={String(favorites.length).padStart(2, '0')}
            delta="Quick access anytime"
            color="pink"
          />
          <Stat
            icon={Zap}
            label="Smart matching"
            value="Active"
            delta="Relevance & distance based"
            color="violet"
          />
        </div>

        <SectionHead
          title="Explore categories"
          subtitle="Browse local professionals by category"
          action="View all in search"
          onActionClick={() => navigate('/customer/search')}
        />
        <div className="category-grid dashboard-cats">
          {['Electronics', 'Home Services', 'Food & Dining', 'Personal Care', 'Healthcare', 'Education'].map((x, i) => (
            <div
              className="category-card"
              key={x}
              onClick={() => navigate(`/customer/search?category=${encodeURIComponent(x)}`)}
            >
              <span className={`cat-icon c${i}`}><CategoryIcon i={i} /></span>
              <b>{x}</b>
              <small>Explore top services</small>
              <ChevronRight size={17} />
            </div>
          ))}
        </div>

        <SectionHead
          title="Recommended near you"
          subtitle="Top rated businesses in your neighbourhood"
          action="See all results"
          onActionClick={() => navigate('/customer/search')}
        />
        <BusinessGrid
          businesses={businesses.slice(0, 3)}
          userId={user.id}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          notify={notify}
        />
      </>
    );
  }

  if (role === 'business') {
    return (
      <>
        <PageTitle
          eyebrow="BUSINESS OVERVIEW"
          title={<>Welcome back, <span>{user.name.split(' ')[0]}.</span></>}
          subtitle="Here's how your business profile and service requests are performing."
          action={
            <button className="btn primary" onClick={() => navigate('/business/manage')}>
              <Plus size={16} /> Manage business
            </button>
          }
        />

        <div className="stats-grid">
          <Stat
            icon={Eye}
            label="Profile views"
            value={ownerStats ? ownerStats.views.toLocaleString() : '1,240'}
            delta="↑ 12.8% this month"
          />
          <Stat
            icon={ClipboardList}
            label="Service requests"
            value={ownerStats ? ownerStats.requests : '0'}
            delta={ownerStats?.completed ? `${ownerStats.completed} completed` : 'Real-time enquiries'}
            color="blue"
          />
          <Stat
            icon={Star}
            label="Average rating"
            value={ownerStats?.rating ? `★ ${ownerStats.rating}` : '★ 4.8'}
            delta="From authentic customer reviews"
            color="amber"
          />
          <Stat
            icon={TrendingUp}
            label="Customer reach"
            value="+18.4%"
            delta="Increased neighbourhood visibility"
            color="green"
          />
        </div>

        <div className="content-grid">
          <div className="panel chart-panel">
            <SectionHead title="Weekly activity trend" subtitle="Enquiries and profile interactions" />
            <PerformanceChart />
          </div>

          <div className="panel">
            <SectionHead title="Quick business actions" />
            <div className="quick-action-list">
              <Link className="quick-action" to="/business/manage">
                <span><Store size={17} /></span>
                <div>
                  <b>Update business details</b>
                  <small>Edit pricing, address & services</small>
                </div>
                <ChevronRight size={16} />
              </Link>
              <Link className="quick-action" to="/business/requests">
                <span><ClipboardList size={17} /></span>
                <div>
                  <b>Respond to requests</b>
                  <small>Accept or update customer requests</small>
                </div>
                <ChevronRight size={16} />
              </Link>
              <Link className="quick-action" to="/business/availability">
                <span><Clock3 size={17} /></span>
                <div>
                  <b>Set working hours & status</b>
                  <small>Toggle Open/Closed status</small>
                </div>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <BusinessGrowthAssistant user={user} notify={notify} />

        <SectionHead
          title="Recent service requests"
          subtitle="Enquiries awaiting your action"
          action="View all requests"
          onActionClick={() => navigate('/business/requests')}
        />
        <RequestsList role="business" user={user} notify={notify} limit={3} />
      </>
    );
  }

  // Admin Home
  return (
    <>
      <PageTitle
        eyebrow="PLATFORM OVERVIEW"
        title={<>Good day, <span>Administrator.</span></>}
        subtitle="Marketplace health, trust verification and system metrics."
      />

      <div className="stats-grid">
        <Stat
          icon={Users}
          label="Total registered users"
          value={adminStats ? adminStats.users : '...'}
          delta="Platform community"
          color="blue"
        />
        <Stat
          icon={Store}
          label="Total businesses"
          value={adminStats ? adminStats.businesses : '...'}
          delta={`${adminStats?.verified || 0} verified`}
          color="violet"
        />
        <Stat
          icon={Clock3}
          label="Pending verification"
          value={adminStats ? adminStats.pending : '0'}
          delta="Awaiting your approval"
          color="amber"
        />
        <Stat
          icon={ClipboardList}
          label="Total service requests"
          value={adminStats ? adminStats.requests : '...'}
          delta="Platform transactions"
          color="green"
        />
      </div>

      <div className="content-grid">
        <div className="panel chart-panel">
          <SectionHead title="Platform growth" subtitle="User signups and requests this month" />
          <PerformanceChart />
        </div>

        <div className="panel">
          <SectionHead title="Needs administrator attention" />
          <div className="attention-list">
            <div>
              <span className="attention-icon amber"><FileCheck2 size={17} /></span>
              <div>
                <b>{adminStats?.pending || 0} businesses</b>
                <small>Awaiting trust verification</small>
              </div>
              <Link to="/admin/verification">Review</Link>
            </div>
            <div>
              <span className="attention-icon pink"><Flag size={17} /></span>
              <div>
                <b>{adminStats?.reports || 0} open reports</b>
                <small>Community complaints to review</small>
              </div>
              <Link to="/admin/content">Review</Link>
            </div>
            <div>
              <span className="attention-icon blue"><Users size={17} /></span>
              <div>
                <b>User accounts</b>
                <small>Manage roles and accounts</small>
              </div>
              <Link to="/admin/users">Manage</Link>
            </div>
          </div>
        </div>
      </div>

      <SectionHead
        title="Recently added businesses"
        subtitle="Review latest marketplace additions"
        action="Manage verifications"
        onActionClick={() => navigate('/admin/verification')}
      />
      <BusinessGrid
        businesses={businesses.slice(0, 3)}
        userId={user.id}
        favorites={[]}
        notify={notify}
      />
    </>
  );
}


// ==========================================
// 2. SEARCH RESULTS PAGE (Customer)
// ==========================================

function SearchPage({ businesses, user, favorites, toggleFavorite, notify }) {
  const [showSmartMatch, setShowSmartMatch] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [q, setQ] = useState(searchParams.get('q') || '');
  const [cat, setCat] = useState(searchParams.get('category') || 'All');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState('all'); // all, 200, 400, 600
  const [ratingFilter, setRatingFilter] = useState('all'); // all, 4.5, 4.0
  const [distanceFilter, setDistanceFilter] = useState('all'); // all, 2, 5
  const [sort, setSort] = useState('match'); // match, price, rating, distance

  useEffect(() => {
    if (searchParams.get('q')) setQ(searchParams.get('q'));
    if (searchParams.get('category')) setCat(searchParams.get('category'));
  }, [searchParams]);

  const categories = [
    'All', 'Electronics', 'Home Services', 'Food & Dining',
    'Personal Care', 'Healthcare', 'Education', 'Automotive', 'Professional Services'
  ];

  const filtered = useMemo(() => {
    const rawTerms = q.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !['near', 'best', 'cheap', 'around', 'service', 'me'].includes(w));

    const matches = businesses.filter((b) => {
      const hay = `${b.name} ${b.category} ${b.description} ${b.area} ${b.address}`.toLowerCase();

      // Keyword query matching
      if (rawTerms.length && !rawTerms.some(term => hay.includes(term)) && !hay.includes(q.toLowerCase())) {
        return false;
      }
      // Category filter
      if (cat !== 'All' && b.category.toLowerCase() !== cat.toLowerCase()) {
        return false;
      }
      // Verification filter
      if (verifiedOnly && !b.verified) {
        return false;
      }
      // Price filter
      if (priceRange === '200' && b.price_from > 200) return false;
      if (priceRange === '400' && b.price_from > 400) return false;
      if (priceRange === '600' && b.price_from > 600) return false;

      // Rating filter
      if (ratingFilter === '4.5' && (b.rating || 0) < 4.5) return false;
      if (ratingFilter === '4.0' && (b.rating || 0) < 4.0) return false;

      // Distance filter
      if (distanceFilter === '2' && (b.distance_km || 0) > 2) return false;
      if (distanceFilter === '5' && (b.distance_km || 0) > 5) return false;

      return true;
    });

    // Sorting
    return matches.sort((a, b) => {
      if (sort === 'price') return a.price_from - b.price_from;
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      if (sort === 'distance') return (a.distance_km || 0) - (b.distance_km || 0);
      // 'match' default transparent composite score
      const scoreA = (Number(a.verified) * 1.5) + (Number(a.available) * 1.2) + ((a.rating || 4) / 5) - ((a.distance_km || 1) / 10);
      const scoreB = (Number(b.verified) * 1.5) + (Number(b.available) * 1.2) + ((b.rating || 4) / 5) - ((b.distance_km || 1) / 10);
      return scoreB - scoreA;
    });
  }, [businesses, q, cat, verifiedOnly, priceRange, ratingFilter, distanceFilter, sort]);

  return (
    <>
      <PageTitle
        eyebrow="DISCOVER LOCAL"
        title={<>Search local <span>businesses.</span></>}
        subtitle="Search naturally by name, category, or service and filter by budget, distance and trust."
      />

      <div className="panel search-controls">
        <div className="search-box">
          <Search size={18} />
          <VoiceSearchButton onResult={(text) => { setQ(text); setSearchParams({ q: text }); }} notify={notify} />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Search for 'laptop repair', 'fresh bakery', 'Kadri'…"
          />
          {q && (
            <button
              onClick={() => {
                setQ('');
                setSearchParams({});
              }}
            >
              Clear
            </button>
          )}
        </div>

        <div className="filter-row">
          <div className="filter-chips">
            {categories.map((c) => (
              <button
                key={c}
                className={cat === c ? 'selected' : ''}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row" style={{ marginTop: '12px', borderTop: '1px solid #f2edf7', paddingTop: '12px' }}>
          <label className="check-filter">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
            />
            <BadgeCheck size={14} style={{ color: '#239c72' }} /> Verified only
          </label>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#8c849e', fontWeight: 700 }}>Price:</span>
            <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)}>
              <option value="all">Any budget</option>
              <option value="200">Under ₹200</option>
              <option value="400">Under ₹400</option>
              <option value="600">Under ₹600</option>
            </select>

            <span style={{ fontSize: '10px', color: '#8c849e', fontWeight: 700, marginLeft: '6px' }}>Rating:</span>
            <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)}>
              <option value="all">All ratings</option>
              <option value="4.5">★ 4.5 & up</option>
              <option value="4.0">★ 4.0 & up</option>
            </select>

            <span style={{ fontSize: '10px', color: '#8c849e', fontWeight: 700, marginLeft: '6px' }}>Distance:</span>
            <select value={distanceFilter} onChange={(e) => setDistanceFilter(e.target.value)}>
              <option value="all">Any distance</option>
              <option value="2">Within 2 km</option>
              <option value="5">Within 5 km</option>
            </select>

            <span style={{ fontSize: '10px', color: '#8c849e', fontWeight: 700, marginLeft: '6px' }}>Sort:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="match">Best match (Smart score)</option>
              <option value="price">Lowest price</option>
              <option value="rating">Highest rated</option>
              <option value="distance">Nearest first</option>
            </select>
          </div>
        </div>
      </div>

      
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn ghost small"
          onClick={() => setShowSmartMatch(!showSmartMatch)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sparkles size={14} color="#7c3aed" />
          {showSmartMatch ? 'Hide AI SmartMatch' : 'Open AI SmartMatch Engine'}
        </button>
      </div>
      {showSmartMatch && <SmartMatchSection user={user} notify={notify} />}

<div className="results-heading">
        <b>{filtered.length} local matches found</b>
        <span><Sparkles size={14} /> Ranked by verified status, availability, ratings & proximity</span>
      </div>

      {filtered.length > 0 ? (
        <BusinessGrid
          businesses={filtered}
          userId={user?.id}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          notify={notify}
        />
      ) : (
        <Empty text="No businesses matched your search filters. Try adjusting your query or budget." />
      )}
    </>
  );
}


// ==========================================
// 3. BUSINESS DETAILS PAGE (Customer)
// ==========================================

function DetailsPage({ businesses, user, favorites, toggleFavorite, notify }) {
  const [showTrustModal, setShowTrustModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryId = searchParams.get('id');

  const [id, setId] = useState(() => {
    return queryId ? Number(queryId) : (businesses[0]?.id || 1);
  });

  const [detail, setDetail] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, reviews, hours
  const [service, setService] = useState('General service');
  const [note, setNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  // Review states (FIXES runtime ReferenceError!)
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Report modal state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Inaccurate pricing or service description');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (queryId) {
      setId(Number(queryId));
    }
  }, [queryId]);

  const fetchDetail = async (targetId) => {
    try {
      const res = await API.get(`/businesses/${targetId}`);
      setDetail(res.data);
      if (res.data?.services?.length > 0) {
        setService(res.data.services[0].name);
      }
    } catch {
      const fb = businesses.find((b) => b.id === targetId) || businesses[0];
      setDetail(fb);
    }
  };

  useEffect(() => {
    fetchDetail(id);
  }, [id]);

  const b = detail || businesses.find((x) => x.id === id) || businesses[0];

  const submitReview = async () => {
    if (!user) {
      notify('Please sign in to submit a review.');
      return;
    }
    if (!reviewText.trim()) {
      notify('Please write a short comment about your experience.');
      return;
    }
    setSubmittingReview(true);
    try {
      await API.post('/reviews', {
        customer_id: user.id,
        business_id: id,
        rating: reviewRating,
        comment: reviewText.trim()
      });
      notify('Thank you! Your review has been published.');
      setReviewText('');
      setReviewRating(5);
      fetchDetail(id);
    } catch (err) {
      notify(err.response?.data?.error || 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const submitRequest = async () => {
    if (!user) {
      notify('Please sign in to send a service request.');
      return;
    }
    setSendingRequest(true);
    try {
      await API.post('/requests', {
        customer_id: user.id,
        business_id: id,
        service_name: service,
        note: note.trim()
      });
      notify(`Service request for "${service}" sent to ${b.name}!`);
      setNote('');
    } catch (err) {
      notify(err.response?.data?.error || 'Could not send service request.');
    } finally {
      setSendingRequest(false);
    }
  };

  const submitReport = async () => {
    try {
      await API.post('/reports', {
        business_id: id,
        reporter_id: user?.id,
        reason: reportReason,
        details: reportDetails
      });
      notify('Report submitted. Our moderation team will investigate.');
      setShowReportModal(false);
      setReportDetails('');
    } catch {
      notify('Could not submit report.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="BUSINESS PROFILE"
        title={<>Business <span>details.</span></>}
        subtitle="Explore certified services, transparent pricing, verified trust badges and customer reviews."
      />

      <div className="detail-select">
        <label>
          Switch business listing:
          <select
            value={id}
            onChange={(e) => {
              const newId = Number(e.target.value);
              setId(newId);
              setSearchParams({ id: newId });
            }}
          >
            {businesses.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name} ({x.category})
              </option>
            ))}
          </select>
        </label>
      </div>

      {b && (
        <div className="detail-layout">
          <div>
            <div
              className="detail-cover"
              style={{ backgroundImage: `url(${b.image})` }}
            />

            <div className="panel detail-info">
              <div className="business-name-row">
                <h2>{b.name}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {b.verified ? (
                    <span className="verified">
                      <BadgeCheck size={14} /> Verified Business
                    </span>
                  ) : (
                    <span className="pending-pill">Verification Pending</span>
                  )}
                  {b.trust && (
                    <TrustScoreBadge trust={b.trust} onClick={() => setShowTrustModal(true)} />
                  )}
                  <button
                    className={`save-heart ${favorites.includes(b.id) ? 'favorited' : ''}`}
                    style={{ position: 'static' }}
                    onClick={() => toggleFavorite(b.id)}
                    title="Bookmark favourite"
                  >
                    <Heart size={17} />
                  </button>
                </div>
              </div>

              <p>{b.description}</p>

              <div className="detail-meta">
                <span>★ {b.rating} ({b.reviews_count || 0} reviews)</span>
                <span><MapPin size={14} /> {b.address}</span>
                <span><Phone size={14} /> {b.phone || '+91 98765 43210'}</span>
                <span className={b.available ? 'available' : 'closed'}>
                  <i />
                  {b.available ? 'Currently Open' : 'Currently Closed'}
                </span>
              </div>

              {/* Working tabs */}
              <div className="detail-tabs">
                <button
                  className={`detail-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview & Services
                </button>
                <button
                  className={`detail-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reviews')}
                >
                  Customer Reviews ({b.reviews?.length || 0})
                </button>
                <button
                  className={`detail-tab-btn ${activeTab === 'hours' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hours')}
                >
                  Operating Hours
                </button>
              </div>

              {activeTab === 'overview' && (
                <>
                  <h3>About {b.name}</h3>
                  <p>
                    {b.description} We focus on friendly, professional service, upfront price clarity, and high customer satisfaction in the {b.area} locality.
                  </p>

                  <div className="detail-benefits">
                    <span><ShieldCheck size={15} /> Verified credentials</span>
                    <span><Wallet size={15} /> Upfront estimates</span>
                    <span><Clock3 size={15} /> Real-time availability</span>
                    <span><Zap size={15} /> Rapid service turnaround</span>
                  </div>

                  <h3 style={{ marginTop: '22px' }}>Available Services & Rates</h3>
                  {b.services && b.services.length > 0 ? (
                    <div>
                      {b.services.map((srv) => (
                        <div key={srv.id} className="service-item-card">
                          <div>
                            <b>{srv.name}</b>
                            <small>{srv.description || 'Standard service with upfront guarantee'}</small>
                          </div>
                          <strong>{money(srv.price)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#9086a2' }}>
                      Standard service packages start from {money(b.price_from)}. Contact the business for custom requirements.
                    </p>
                  )}
                </>
              )}

              {activeTab === 'reviews' && (
                <>
                  <h3>Verified Customer Feedback</h3>
                  {b.reviews && b.reviews.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                      {b.reviews.map((r, i) => (
                        <div key={i} style={{ borderBottom: '1px solid #f2edf8', paddingBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <b style={{ fontSize: '11px', color: '#33294c' }}>{r.customer}</b>
                            <span style={{ fontSize: '10px', color: '#958da3' }}>{r.date}</span>
                          </div>
                          <div className="stars" style={{ margin: '3px 0 6px' }}>
                            {'★'.repeat(r.rating)}
                            <span style={{ color: '#d9d2e5' }}>{'★'.repeat(5 - r.rating)}</span>
                          </div>
                          <p style={{ margin: '0', fontSize: '11px', color: '#685e7d' }}>{r.comment}</p>
                          {r.owner_reply && (
                            <div className="reply-box">
                              <b><CornerDownRight size={13} /> Response from business owner:</b>
                              <p>{r.owner_reply}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty text="No reviews yet for this listing. Be the first to share your experience!" />
                  )}
                </>
              )}

              {activeTab === 'hours' && (
                <>
                  <h3>Working Hours & Schedule</h3>
                  <div className="hours-box">
                    <Clock3 size={20} />
                    <div>
                      <b>Operating Schedule</b>
                      <small>{b.working_hours || 'Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed'}</small>
                    </div>
                    <span className={b.available ? 'badge-success' : 'badge-danger'}>
                      {b.available ? 'Open Now' : 'Currently Closed'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Leave a review box */}
            <div className="panel review-compose">
              <h3>Share your experience</h3>
              <p>Help neighbours make a confident choice by sharing your feedback.</p>
              <div className="review-compose-row">
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                >
                  <option value="5">★★★★★ (5 stars)</option>
                  <option value="4">★★★★☆ (4 stars)</option>
                  <option value="3">★★★☆☆ (3 stars)</option>
                  <option value="2">★★☆☆☆ (2 stars)</option>
                  <option value="1">★☆☆☆☆ (1 star)</option>
                </select>
                <input
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Write a brief comment about service quality, timing and pricing…"
                />
                <button
                  className="btn primary small"
                  onClick={submitReview}
                  disabled={submittingReview}
                >
                  {submittingReview ? 'Posting…' : 'Post review'}
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Request Panel */}
          <aside className="panel request-panel">
            <div className="eyebrow">CONNECT WITH BUSINESS</div>
            <h3>Request a service</h3>
            <p>Send an enquiry directly to {b.name}. They will review and confirm availability.</p>

            <label>
              Select Service
              <select value={service} onChange={(e) => setService(e.target.value)}>
                {(b.services?.length
                  ? b.services.map((s) => s.name)
                  : ['General service', 'Consultation', 'Standard Repair']
                ).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label>
              Describe your requirement
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Share a few details (e.g. laptop model, problem symptoms, preferred time)…"
              />
            </label>

            <div className="price-hint">
              <span>Estimated base rate</span>
              <b>{money(b.price_from)}</b>
            </div>

            <button
              className="btn primary full"
              onClick={submitRequest}
              disabled={sendingRequest}
            >
              {sendingRequest ? 'Submitting request…' : 'Send service request'} <ArrowUpRight size={16} />
            </button>

            <button
              className="btn outline full"
              onClick={() => notify(`Contact ${b.name}: ${b.phone || '+91 98765 43210'}`)}
            >
              <Phone size={16} /> Contact business
            </button>

            <div style={{ marginTop: '14px', textAlign: 'center' }}>
              <button
                className="btn ghost small"
                style={{ color: '#a0788d' }}
                onClick={() => setShowReportModal(true)}
              >
                <Flag size={13} /> Report listing
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Report Listing Modal */}
      {showTrustModal && <TrustScoreModal business={b} onClose={() => setShowTrustModal(false)} />}
      {showReportModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Report Business Listing</h3>
              <button onClick={() => setShowReportModal(false)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: '11px', color: '#887d9b', marginTop: 0 }}>
              Help keep LocalLink trustworthy. Tell us why you are reporting <b>{b.name}</b>.
            </p>
            <div className="form">
              <label>
                Reason for report
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                  <option>Inaccurate pricing or service description</option>
                  <option>Business permanently closed or moved</option>
                  <option>Fraudulent or misleading information</option>
                  <option>Unprofessional or abusive conduct</option>
                </select>
              </label>
              <label>
                Additional details
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide context or explanation for platform moderators…"
                />
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn outline" onClick={() => setShowReportModal(false)}>
                  Cancel
                </button>
                <button className="btn primary" onClick={submitReport}>
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ==========================================
// 4. MAP VIEW PAGE (Customer)
// ==========================================

function MapPage({ businesses, favorites, toggleFavorite, notify }) {
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState('All');
  const [activePin, setActivePin] = useState(businesses[0] || null);

  const displayed = useMemo(() => {
    if (selectedCat === 'All') return businesses;
    return businesses.filter(b => b.category === selectedCat);
  }, [businesses, selectedCat]);

  return (
    <>
      <PageTitle
        eyebrow="LOCAL MAP"
        title={<>Explore around <span>your corner.</span></>}
        subtitle="Visualise nearby service providers on our interactive local area map."
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {['All', 'Electronics', 'Home Services', 'Food & Dining', 'Personal Care'].map(c => (
          <button
            key={c}
            className={`search-chip-btn ${selectedCat === c ? 'active' : ''}`}
            onClick={() => setSelectedCat(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="map-layout">
        <div className="map-canvas">
          <div className="map-grid-bg" />
          <div className="map-river" />
          <div className="map-road r1" />
          <div className="map-road r2" />
          <div className="map-road r3" />

          {displayed.slice(0, 6).map((b, i) => (
            <div
              className={`map-marker marker-${i}`}
              key={b.id}
              onClick={() => setActivePin(b)}
              style={{ cursor: 'pointer', transform: activePin?.id === b.id ? 'scale(1.2)' : 'scale(1)' }}
            >
              <MapPin size={30} />
              <span>{b.name}</span>
            </div>
          ))}

          <div className="map-label label-a">MANGALURU CENTRAL</div>
          <div className="map-label label-b">HAMPANKATTA</div>
          <div className="map-label label-c">KADRI HILLS</div>
          <div className="map-attribution">LocalLink Illustrative Geolocation · OpenStreetMap Compatible</div>

          {activePin && (
            <div
              style={{
                position: 'absolute',
                bottom: '18px',
                left: '18px',
                right: '18px',
                maxWidth: '420px',
                background: '#fff',
                borderRadius: '16px',
                padding: '14px',
                boxShadow: '0 12px 35px rgba(45, 30, 80, 0.22)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 10
              }}
            >
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  backgroundImage: `url(${activePin.image})`,
                  backgroundSize: 'cover',
                  flex: 'none'
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: '12px', color: '#2f244a' }}>{activePin.name}</b>
                <small style={{ display: 'block', fontSize: '10px', color: '#887d9a', margin: '2px 0' }}>
                  ★ {activePin.rating} · {activePin.distance_km} km · {activePin.category}
                </small>
                <strong style={{ fontSize: '11px', color: '#6840ca' }}>From {money(activePin.price_from)}</strong>
              </div>
              <button
                className="btn primary small"
                onClick={() => navigate(`/customer/details?id=${activePin.id}`)}
              >
                View
              </button>
            </div>
          )}
        </div>

        <div className="map-list panel">
          <SectionHead
            title="Nearby Businesses"
            subtitle={`${displayed.length} places in this region`}
          />
          {displayed.map((b) => (
            <div
              className="map-list-item"
              key={b.id}
              onClick={() => setActivePin(b)}
              style={{
                cursor: 'pointer',
                background: activePin?.id === b.id ? '#f7f4fd' : 'transparent',
                borderRadius: '10px',
                padding: '8px'
              }}
            >
              <div className="mini-business-icon">
                <Store size={17} />
              </div>
              <div>
                <b>{b.name}</b>
                <small>{b.distance_km} km · {b.area} · ★ {b.rating}</small>
              </div>
              <strong>{money(b.price_from)}+</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


// ==========================================
// 5. COMPARE & CHOOSE PAGE (Customer)
// ==========================================

function ComparePage({ businesses, notify }) {
  const [compareTrustBiz, setCompareTrustBiz] = useState(null);
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState(() => {
    return businesses.slice(0, 3).map((b) => b.id);
  });

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const items = useMemo(() => {
    return businesses.filter((b) => selectedIds.includes(b.id));
  }, [businesses, selectedIds]);

  // Smart composite ranking calculation for recommendation
  const recommendedBusiness = useMemo(() => {
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => {
      const scoreA = (a.rating * 2) + (a.verified ? 1.5 : 0) + (a.available ? 1 : 0) - (a.price_from / 600) - (a.distance_km / 10);
      const scoreB = (b.rating * 2) + (b.verified ? 1.5 : 0) + (b.available ? 1 : 0) - (b.price_from / 600) - (b.distance_km / 10);
      return scoreB - scoreA;
    });
    return sorted[0];
  }, [items]);

  return (
    <>
      <PageTitle
        eyebrow="MAKE A CONFIDENT CHOICE"
        title={<>Compare & <span>choose.</span></>}
        subtitle="Compare pricing, ratings, distance, hours and trust signals side by side."
      />

      <div className="compare-select panel">
        <b>Select businesses to compare (check at least 2):</b>
        <div>
          {businesses.map((b) => (
            <label key={b.id}>
              <input
                type="checkbox"
                checked={selectedIds.includes(b.id)}
                onChange={() => toggleSelect(b.id)}
              />
              {b.name} ({b.category})
            </label>
          ))}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="compare-table-wrap panel">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Attribute</th>
                {items.map((b) => (
                  <th key={b.id}>
                    <div>{b.name}</div>
                    <button
                      className="btn outline small"
                      style={{ marginTop: '8px' }}
                      onClick={() => navigate(`/customer/details?id=${b.id}`)}
                    >
                      View Details
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Starting Price</td>
                {items.map((b) => (
                  <td key={b.id}><strong>{money(b.price_from)}</strong></td>
                ))}
              </tr>
              <tr>
                <td>Customer Rating</td>
                {items.map((b) => (
                  <td key={b.id}>★ {b.rating} <small>({b.reviews_count} reviews)</small></td>
                ))}
              </tr>
              <tr>
                <td>Distance</td>
                {items.map((b) => (
                  <td key={b.id}>{b.distance_km} km from you</td>
                ))}
              </tr>
              <tr>
                <td>Availability</td>
                {items.map((b) => (
                  <td key={b.id}>
                    <span className={b.available ? 'available' : 'closed'}>
                      <i /> {b.available ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Trust Badge</td>
                {items.map((b) => (
                  <td key={b.id}>
                    {b.verified ? (
                      <span className="verified"><BadgeCheck size={14} /> Verified</span>
                    ) : (
                      <span className="pending-pill">Unverified</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Local Trust Score</td>
                {items.map((b) => (
                  <td key={b.id}>
                    {b.trust ? (
                      <TrustScoreBadge trust={b.trust} onClick={() => setCompareTrustBiz(b)} />
                    ) : (
                      <span>--</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Local Trust Score</td>
                {items.map((b) => (
                  <td key={b.id}>
                    {b.trust ? (
                      <TrustScoreBadge trust={b.trust} onClick={() => setCompareTrustBiz(b)} />
                    ) : (
                      <span>--</span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Operating Hours</td>
                {items.map((b) => (
                  <td key={b.id} style={{ fontSize: '9px' }}>{b.working_hours || 'Mon - Sat: 9AM - 7PM'}</td>
                ))}
              </tr>
              <tr>
                <td>Location Area</td>
                {items.map((b) => (
                  <td key={b.id}>{b.area}</td>
                ))}
              </tr>
              <tr>
                <td>Phone Contact</td>
                {items.map((b) => (
                  <td key={b.id}>{b.phone || '+91 98765 43210'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text="Please select at least one business above to view the comparison table." />
      )}

      {recommendedBusiness && (
        <div className="recommendation">
          <Sparkles size={24} />
          <div>
            <b>LocalLink AI Recommendation:</b>
            <p>
              <b>{recommendedBusiness.name}</b> is the highest-value option based on customer rating (★ {recommendedBusiness.rating}), verified trust credentials, proximity ({recommendedBusiness.distance_km} km) and upfront pricing ({money(recommendedBusiness.price_from)}).
            </p>
          </div>
        </div>
      )}
      {compareTrustBiz && (
        <TrustScoreModal business={compareTrustBiz} onClose={() => setCompareTrustBiz(null)} />
      )}
    </>
  );
}


// ==========================================
// 6. MY REQUESTS PAGE (Customer & Business)
// ==========================================

function RequestsPage({ role, user, notify }) {
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' or 'quotes'

  return (
    <>
      <PageTitle
        eyebrow="SERVICE ACTIVITY"
        title={<>Service <span>requests.</span></>}
        subtitle={
          role === 'customer'
            ? 'Track your active enquiries, scheduled services, and multi-business quote challenges.'
            : 'Review incoming customer enquiries, submit quotations, and track progress.'
        }
      />

      <div className="quote-tabs-wrap">
        <button
          type="button"
          className={`quote-tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
          onClick={() => setActiveTab('direct')}
        >
          {role === 'customer' ? 'Direct Bookings & Requests' : 'Direct Customer Enquiries'}
        </button>
        <button
          type="button"
          className={`quote-tab-btn ${activeTab === 'quotes' ? 'active' : ''}`}
          onClick={() => setActiveTab('quotes')}
        >
          {role === 'customer' ? 'Multi-Business Quote Challenges' : 'Quote Opportunities / Challenges'}
        </button>
      </div>

      {activeTab === 'direct' ? (
        <RequestsList role={role} user={user} notify={notify} />
      ) : (
        <QuoteChallengesSection role={role} user={user} notify={notify} />
      )}
    </>
  );
}

function RequestsList({ role, user, notify, limit }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await API.get('/requests', {
        params: { user_id: user?.id, role }
      });
      setRows(res.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) loadRequests();
  }, [role, user?.id]);

  const updateStatus = async (id, status) => {
    try {
      await API.patch(`/requests/${id}`, { status });
      notify(`Service request marked as ${status}.`);
      loadRequests();
    } catch {
      notify('Could not update request status.');
    }
  };

  const visible = rows
    .filter((r) => filter === 'All' || r.status === filter)
    .slice(0, limit || 99);

  return (
    <div className="panel request-list-panel">
      <div className="tabs-row">
        {['All', 'Pending', 'Accepted', 'In Progress', 'Completed', 'Rejected'].map((x) => (
          <button
            key={x}
            className={filter === x ? 'active' : ''}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>

      {visible.map((r) => (
        <div className="request-row" key={r.id}>
          <div className="request-symbol">
            <ClipboardList size={18} />
          </div>
          <div className="request-main">
            <b>{r.service_name}</b>
            <small>
              {role === 'business'
                ? `Customer: ${r.customer} ${r.customer_phone ? `(${r.customer_phone})` : ''}`
                : `Business: ${r.business}`}{' '}
              · {r.created_at}
            </small>
            {r.note && <p>Requirement: {r.note}</p>}
          </div>

          <span className={`status-pill ${r.status.toLowerCase().replace(' ', '-')}`}>
            {r.status}
          </span>

          {role === 'business' && r.status === 'Pending' && (
            <div className="row-actions">
              <button className="accept-btn" onClick={() => updateStatus(r.id, 'Accepted')}>
                <Check size={14} /> Accept
              </button>
              <button className="reject-btn" onClick={() => updateStatus(r.id, 'Rejected')}>
                <X size={14} /> Reject
              </button>
            </div>
          )}

          {role === 'business' && r.status === 'Accepted' && (
            <button className="btn small primary" onClick={() => updateStatus(r.id, 'In Progress')}>
              Start work
            </button>
          )}

          {role === 'business' && r.status === 'In Progress' && (
            <button className="btn small primary" onClick={() => updateStatus(r.id, 'Completed')}>
              Complete work
            </button>
          )}

          {role === 'customer' && r.status === 'Pending' && (
            <button
              className="btn small danger"
              onClick={() => updateStatus(r.id, 'Rejected')}
              title="Cancel your request"
            >
              Cancel
            </button>
          )}
        </div>
      ))}

      {!loading && !visible.length && (
        <Empty text="No service requests found in this category." />
      )}
    </div>
  );
}


// ==========================================
// 7. PROFILE & PREFERENCES PAGE (Customer)
// ==========================================

function ProfilePage({ user, setUser, businesses, favorites, notify }) {
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [lang, setLang] = useState('English');
  const [saving, setSaving] = useState(false);

  // Change password fields
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.patch('/profile', { name, phone, bio });
      setUser(res.data.user);
      localStorage.setItem('ll_user', JSON.stringify(res.data.user));
      notify('Profile details updated successfully!');
    } catch (err) {
      notify(err.response?.data?.error || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (e) => {
    e.preventDefault();
    setPassSaving(true);
    try {
      await API.post('/change-password', { old_password: oldPass, new_password: newPass });
      notify('Password changed successfully.');
      setOldPass('');
      setNewPass('');
    } catch (err) {
      notify(err.response?.data?.error || 'Could not update password.');
    } finally {
      setPassSaving(false);
    }
  };

  const favBusinesses = businesses.filter(b => favorites.includes(b.id));

  return (
    <>
      <PageTitle
        eyebrow="YOUR ACCOUNT"
        title={<>Profile & <span>preferences.</span></>}
        subtitle="Manage your personal details, saved places, notifications and account security."
      />

      <div className="profile-layout">
        <div className="panel profile-card">
          <div className="profile-avatar">
            {(user?.name || 'U').split(' ').map((x) => x[0]).slice(0, 2).join('')}
          </div>
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <span className="verified">
            <ShieldCheck size={14} /> Verified {user?.role} account
          </span>

          <div style={{ marginTop: '24px', width: '100%', textAlign: 'left' }}>
            <h4 style={{ fontSize: '11px', color: '#685d7f', marginBottom: '8px' }}>Saved Favourites ({favBusinesses.length})</h4>
            {favBusinesses.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {favBusinesses.slice(0, 3).map((fb) => (
                  <div
                    key={fb.id}
                    onClick={() => navigate(`/customer/details?id=${fb.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '8px',
                      border: '1px solid #f0ecf6',
                      cursor: 'pointer'
                    }}
                  >
                    <Store size={15} color="#7751d3" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#31274d' }}>{fb.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <small style={{ fontSize: '10px', color: '#978fa4' }}>No saved places yet.</small>
            )}
          </div>
        </div>

        <div className="panel settings-form">
          <form onSubmit={saveProfile}>
            <h3>Personal Information</h3>
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Email address (Registered)
              <input value={user?.email || ''} disabled style={{ background: '#f8f6fc' }} />
            </label>
            <label>
              Phone number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98450 12345" />
            </label>
            <label>
              Preferred interface language
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="English">English</option>
                <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
                <option value="Hindi">हिंदी (Hindi)</option>
              </select>
            </label>
            <button className="btn primary" disabled={saving} style={{ marginTop: '10px' }}>
              {saving ? 'Saving changes…' : 'Save profile changes'}
            </button>
          </form>

          <form onSubmit={updatePassword} style={{ marginTop: '24px', borderTop: '1px solid #eeeaf5', paddingTop: '16px' }}>
            <h3>Change Password</h3>
            <label>
              Current password
              <input
                type="password"
                required
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
                placeholder="Enter current password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                required
                minLength="6"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>
            <button className="btn outline" disabled={passSaving} style={{ marginTop: '8px' }}>
              {passSaving ? 'Updating…' : 'Update password'}
            </button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid #eeeaf5', paddingTop: '16px' }}>
            <h3>Notifications & Communication</h3>
            <Toggle label="Service request updates & confirmations" defaultChecked />
            <Toggle label="Hyperlocal recommendations near me" defaultChecked />
            <Toggle label="Weekly local deals and newly verified businesses" />
          </div>
        </div>
      </div>

      <SecurityProfileCard user={user} notify={notify} />
    </>
  );
}


// ==========================================
// 8. MANAGE BUSINESS PAGE (Business Owner)
// ==========================================

function ManagePage({ user, refreshBusinesses, notify }) {
  const [owned, setOwned] = useState([]);
  const [services, setServices] = useState([]);
  const [editingBiz, setEditingBiz] = useState(null);

  // New business form state
  const [form, setForm] = useState({
    name: '',
    category: 'Electronics',
    description: '',
    address: 'Mangaluru, Karnataka',
    area: 'Mangaluru',
    price_from: 199,
    phone: '+91 98765 43210'
  });

  // New service form state
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: 199
  });

  const loadOwnerData = async () => {
    try {
      const [bizRes, srvRes] = await Promise.all([
        API.get('/owner/businesses', { params: { owner_id: user.id } }),
        API.get('/owner/services', { params: { owner_id: user.id } })
      ]);
      setOwned(bizRes.data);
      setServices(srvRes.data);
    } catch {
      setOwned([]);
      setServices([]);
    }
  };

  useEffect(() => {
    if (user?.id) loadOwnerData();
  }, [user?.id]);

  const createBusiness = async (e) => {
    e.preventDefault();
    try {
      await API.post('/businesses', { ...form, owner_id: user.id });
      notify('New business profile created! Submitted for verification.');
      setForm({
        name: '',
        category: 'Electronics',
        description: '',
        address: 'Mangaluru, Karnataka',
        area: 'Mangaluru',
        price_from: 199,
        phone: '+91 98765 43210'
      });
      loadOwnerData();
      refreshBusinesses();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not create business.');
    }
  };

  const updateBusiness = async (e) => {
    e.preventDefault();
    if (!editingBiz) return;
    try {
      await API.patch(`/businesses/${editingBiz.id}`, editingBiz);
      notify('Business details updated successfully!');
      setEditingBiz(null);
      loadOwnerData();
      refreshBusinesses();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not update business details.');
    }
  };

  const addService = async (e) => {
    e.preventDefault();
    if (!owned.length) {
      notify('Please create a business profile first before adding services.');
      return;
    }
    try {
      await API.post('/owner/services', {
        business_id: owned[0].id,
        name: serviceForm.name,
        description: serviceForm.description,
        price: serviceForm.price
      });
      notify(`Service "${serviceForm.name}" added successfully.`);
      setServiceForm({ name: '', description: '', price: 199 });
      loadOwnerData();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not add service.');
    }
  };

  const toggleService = async (sid, currentStatus) => {
    try {
      await API.patch(`/owner/services/${sid}`, { available: !currentStatus });
      loadOwnerData();
      notify('Service status updated.');
    } catch {
      notify('Could not update service status.');
    }
  };

  const deleteService = async (sid) => {
    if (!window.confirm('Are you sure you want to remove this service?')) return;
    try {
      await API.delete(`/owner/services/${sid}`);
      notify('Service deleted.');
      loadOwnerData();
    } catch {
      notify('Could not delete service.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="YOUR BUSINESS PRESENCE"
        title={<>Manage your <span>business.</span></>}
        subtitle="Add, edit and update your business profile, operating information and offered services."
      />

      <div className="content-grid">
        {/* Left Column: Business Profiles */}
        <div className="panel">
          <SectionHead
            title="Your Business Listings"
            subtitle="Manage your public business presence"
          />

          {owned.map((b) => (
            <div className="owned-business" key={b.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div className="business-thumb"><Store size={18} /></div>
                <div>
                  <b>{b.name}</b>
                  <small>{b.category} · {b.address}</small>
                  <span className={b.verified ? 'verified' : 'pending-pill'}>
                    {b.verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
              <button
                className="btn outline small"
                onClick={() => setEditingBiz(b)}
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>
          ))}

          {!owned.length && (
            <Empty text="No business profile linked to your account yet. Fill the form below to create one." />
          )}

          {/* Add Business Form */}
          <form className="form compact-form" onSubmit={createBusiness}>
            <h3>Add a New Business Profile</h3>
            <label>
              Business name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mangaluru Tech Care"
              />
            </label>
            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {['Electronics', 'Home Services', 'Food & Dining', 'Personal Care', 'Healthcare', 'Education', 'Automotive', 'Professional Services'].map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Explain what services you provide and what makes you reliable…"
              />
            </label>
            <label>
              Address
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Shop 4, Hampankatta, Mangaluru"
              />
            </label>
            <div className="form-two">
              <label>
                Starting price (₹)
                <input
                  type="number"
                  min="0"
                  value={form.price_from}
                  onChange={(e) => setForm({ ...form, price_from: e.target.value })}
                />
              </label>
              <label>
                Phone number
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </label>
            </div>
            <button className="btn primary">
              Save business profile <Plus size={15} />
            </button>
          </form>
        </div>

        {/* Right Column: Services Management */}
        <div className="panel">
          <SectionHead
            title="Offered Services"
            subtitle="Services that customers can book"
          />

          <form className="form compact-form" onSubmit={addService}>
            <h3>Add a Service Package</h3>
            <label>
              Service name
              <input
                required
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="e.g. Motherboard Diagnostic & Repair"
              />
            </label>
            <label>
              Description (optional)
              <input
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                placeholder="Scope of work included…"
              />
            </label>
            <label>
              Base price (₹)
              <input
                type="number"
                min="0"
                required
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
              />
            </label>
            <button className="btn primary">
              Add service <Plus size={15} />
            </button>
          </form>

          <div className="service-manage-list" style={{ marginTop: '16px' }}>
            {services.map((s) => (
              <div key={s.id}>
                <span>
                  <b>{s.name}</b>
                  <small>{money(s.price)} · {s.description || 'Standard service'}</small>
                </span>
                <span className={s.available ? 'available' : 'closed'}>
                  {s.available ? 'Active' : 'Paused'}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="icon-btn"
                    title={s.available ? 'Pause service' : 'Activate service'}
                    onClick={() => toggleService(s.id, s.available)}
                  >
                    <Zap size={14} color={s.available ? '#25a87b' : '#9086a2'} />
                  </button>
                  <button
                    className="icon-btn danger"
                    title="Delete service"
                    onClick={() => deleteService(s.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {!services.length && (
              <Empty text="No individual services added yet. Add one above!" />
            )}
          </div>
        </div>
      </div>

      {/* Edit Business Modal */}
      {editingBiz && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Edit Business Details</h3>
              <button onClick={() => setEditingBiz(null)}><X size={18} /></button>
            </div>
            <form className="form" onSubmit={updateBusiness}>
              <label>
                Business name
                <input
                  required
                  value={editingBiz.name}
                  onChange={(e) => setEditingBiz({ ...editingBiz, name: e.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  value={editingBiz.category}
                  onChange={(e) => setEditingBiz({ ...editingBiz, category: e.target.value })}
                >
                  {['Electronics', 'Home Services', 'Food & Dining', 'Personal Care', 'Healthcare', 'Education', 'Automotive', 'Professional Services'].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  value={editingBiz.description}
                  onChange={(e) => setEditingBiz({ ...editingBiz, description: e.target.value })}
                />
              </label>
              <label>
                Address
                <input
                  value={editingBiz.address}
                  onChange={(e) => setEditingBiz({ ...editingBiz, address: e.target.value })}
                />
              </label>
              <div className="form-two">
                <label>
                  Starting price (₹)
                  <input
                    type="number"
                    value={editingBiz.price_from}
                    onChange={(e) => setEditingBiz({ ...editingBiz, price_from: e.target.value })}
                  />
                </label>
                <label>
                  Phone number
                  <input
                    value={editingBiz.phone}
                    onChange={(e) => setEditingBiz({ ...editingBiz, phone: e.target.value })}
                  />
                </label>
              </div>
              <label>
                Working hours description
                <input
                  value={editingBiz.working_hours || ''}
                  onChange={(e) => setEditingBiz({ ...editingBiz, working_hours: e.target.value })}
                  placeholder="Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed"
                />
              </label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button type="button" className="btn outline" onClick={() => setEditingBiz(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


// ==========================================
// 9. ANALYTICS PAGE (Business Owner & Admin)
// ==========================================

function AnalyticsPage({ role, user }) {
  const [stats, setStats] = useState({
    businesses: 1,
    requests: 0,
    completed: 0,
    views: 1240,
    rating: 4.8
  });

  const chartData = [
    { day: 'Mon', value: 28 },
    { day: 'Tue', value: 42 },
    { day: 'Wed', value: 35 },
    { day: 'Thu', value: 58 },
    { day: 'Fri', value: 49 },
    { day: 'Sat', value: 72 },
    { day: 'Sun', value: 84 }
  ];

  useEffect(() => {
    if (role === 'business') {
      API.get('/owner/analytics', { params: { owner_id: user.id } })
        .then((r) => setStats(r.data))
        .catch(() => {});
    }
  }, [role, user.id]);

  return (
    <>
      <PageTitle
        eyebrow="PERFORMANCE INSIGHTS"
        title={<>Business <span>analytics.</span></>}
        subtitle="Track customer conversion, enquiry trends and rating reputation."
        action={
          <button className="btn outline" onClick={() => window.print()}>
            Export report <ArrowUpRight size={15} />
          </button>
        }
      />

      {role === 'business' && (
        <BusinessGrowthAssistant user={user} notify={() => {}} />
      )}

      <div className="stats-grid">
        <Stat
          icon={Eye}
          label="Profile views"
          value={(stats.views || 1240).toLocaleString()}
          delta="↑ 12.8% this month"
        />
        <Stat
          icon={ClipboardList}
          label="Total enquiries"
          value={stats.requests}
          delta="Customer service requests"
          color="blue"
        />
        <Stat
          icon={CheckCircle2}
          label="Completed jobs"
          value={stats.completed}
          delta={stats.requests > 0 ? `${Math.round((stats.completed / stats.requests) * 100)}% completion rate` : 'All jobs current'}
          color="green"
        />
        <Stat
          icon={Star}
          label="Customer rating"
          value={`★ ${stats.rating || 4.8}`}
          delta="Reputation score"
          color="amber"
        />
      </div>

      <div className="content-grid">
        <div className="panel chart-panel">
          <SectionHead
            title="Weekly Engagement Velocity"
            subtitle="Customer clicks, inquiries and profile reads"
          />
          <PerformanceChart data={chartData} />
        </div>

        <div className="panel">
          <SectionHead title="Conversion & Response Summary" />
          <div className="summary-list">
            <div>
              <span>Customer Reach Increase</span>
              <b>+18.4%</b>
            </div>
            <div>
              <span>Search Impressions</span>
              <b>2,480</b>
            </div>
            <div>
              <span>Enquiry Conversion Rate</span>
              <b>{stats.requests > 0 ? `${Math.round((stats.requests / 120) * 100)}%` : '8.6%'}</b>
            </div>
            <div>
              <span>Average Response Time</span>
              <b>~ 1.8 hours</b>
            </div>
            <div>
              <span>Accepted Jobs</span>
              <b>{stats.accepted || 0}</b>
            </div>
            <div>
              <span>Jobs In Progress</span>
              <b>{stats.in_progress || 0}</b>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ==========================================
// 10. REVIEWS PAGE (Business Owner)
// ==========================================

function ReviewsPage({ role, user, notify }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({ avg: 4.8, total: 0, distribution: [80, 15, 5, 0, 0] });
  const [replyText, setReplyText] = useState({});
  const [replyingId, setReplyingId] = useState(null);

  const loadReviews = async () => {
    try {
      const res = await API.get('/owner/reviews', { params: { owner_id: user.id } });
      setReviews(res.data.reviews || []);
      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch {
      setReviews([]);
    }
  };

  useEffect(() => {
    if (user?.id) loadReviews();
  }, [user?.id]);

  const submitReply = async (rid) => {
    const text = replyText[rid];
    if (!text || !text.trim()) {
      notify('Please write a reply before submitting.');
      return;
    }
    try {
      await API.patch(`/reviews/${rid}/reply`, { reply: text.trim() });
      notify('Reply saved and visible to customers!');
      setReplyingId(null);
      loadReviews();
    } catch {
      notify('Could not save reply.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER VOICE"
        title={<>Reviews & <span>reputation.</span></>}
        subtitle="Monitor customer feedback, view rating distributions and respond to reviews."
      />

      <div className="review-summary panel">
        <div>
          <strong>{stats.avg || 4.8}</strong>
          <span>★★★★★</span>
          <small>Average based on {stats.total} reviews</small>
        </div>
        <div className="rating-bars">
          {[5, 4, 3, 2, 1].map((stars, i) => {
            const pct = stats.distribution ? stats.distribution[i] : 0;
            return (
              <div key={stars}>
                <span>{stars} ★</span>
                <i>
                  <b style={{ width: `${pct}%` }} />
                </i>
                <small>{pct}%</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel review-list">
        <SectionHead title="Customer Reviews" subtitle="Recent feedback across your business listings" />
        {reviews.map((r) => (
          <div className="review-row" key={r.id}>
            <div className="avatar">{(r.customer || 'C')[0]}</div>
            <div>
              <b>
                {r.customer} <span>· {r.business} ({r.date})</span>
              </b>
              <div className="stars">{'★'.repeat(r.rating)}</div>
              <p>{r.comment}</p>

              {r.owner_reply ? (
                <div className="reply-box">
                  <b><CornerDownRight size={13} /> Your reply:</b>
                  <p>{r.owner_reply}</p>
                </div>
              ) : replyingId === r.id ? (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                  <input
                    value={replyText[r.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [r.id]: e.target.value })}
                    placeholder="Write a professional response…"
                    style={{ flex: 1, border: '1px solid #e2dcf0', borderRadius: '8px', padding: '6px 10px', fontSize: '11px' }}
                  />
                  <button className="btn primary small" onClick={() => submitReply(r.id)}>
                    Send reply
                  </button>
                  <button className="btn outline small" onClick={() => setReplyingId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className="btn ghost small"
                  style={{ marginTop: '8px' }}
                  onClick={() => setReplyingId(r.id)}
                >
                  <MessageSquare size={13} /> Reply to review
                </button>
              )}
            </div>
          </div>
        ))}
        {!reviews.length && (
          <Empty text="No reviews received yet. Excellent service builds great reviews!" />
        )}
      </div>
    </>
  );
}


// ==========================================
// 11. AVAILABILITY PAGE (Business Owner)
// ==========================================

function AvailabilityPage({ user, refreshBusinesses, notify }) {
  const [owned, setOwned] = useState([]);
  const [editingHoursBiz, setEditingHoursBiz] = useState(null);
  const [customHours, setCustomHours] = useState('');

  const loadBusinesses = async () => {
    try {
      const res = await API.get('/owner/businesses', { params: { owner_id: user.id } });
      setOwned(res.data);
    } catch {
      setOwned([]);
    }
  };

  useEffect(() => {
    if (user?.id) loadBusinesses();
  }, [user?.id]);

  const toggleAvailability = async (b) => {
    try {
      const newStatus = !b.available;
      await API.patch(`/businesses/${b.id}`, { available: newStatus });
      notify(`${b.name} marked as ${newStatus ? 'open' : 'closed'}.`);
      setOwned(prev => prev.map(x => x.id === b.id ? { ...x, available: newStatus } : x));
      refreshBusinesses();
    } catch {
      notify('Could not update status.');
    }
  };

  const saveHours = async (e) => {
    e.preventDefault();
    if (!editingHoursBiz) return;
    try {
      await API.patch(`/businesses/${editingHoursBiz.id}`, { working_hours: customHours });
      notify('Working hours updated and published to customers!');
      setEditingHoursBiz(null);
      loadBusinesses();
      refreshBusinesses();
    } catch {
      notify('Could not save working hours.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="CUSTOMER EXPECTATIONS"
        title={<>Availability <span>management.</span></>}
        subtitle="Keep your open/closed status and weekly working schedule accurate."
      />

      <div className="panel availability-panel">
        <SectionHead
          title="Live Service & Store Status"
          subtitle="Changes are reflected instantly in customer search results."
        />

        {owned.map((b) => (
          <div className="availability-row" key={b.id}>
            <div className="mini-business-icon">
              <Store size={18} />
            </div>
            <div>
              <b>{b.name}</b>
              <small>{b.address} · Schedule: {b.working_hours || 'Mon - Sat: 9:00 AM - 7:00 PM'}</small>
            </div>
            <span className={b.available ? 'available' : 'closed'}>
              <i /> {b.available ? 'Currently Open' : 'Currently Closed'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn small outline"
                onClick={() => toggleAvailability(b)}
              >
                Set {b.available ? 'Closed' : 'Open'}
              </button>
              <button
                className="btn small primary"
                onClick={() => {
                  setEditingHoursBiz(b);
                  setCustomHours(b.working_hours || 'Mon - Sat: 9:00 AM - 7:00 PM, Sun: Closed');
                }}
              >
                Edit Hours
              </button>
            </div>
          </div>
        ))}

        {!owned.length && (
          <Empty text="Create or link a business profile to manage working hours." />
        )}

        <div className="hours-box">
          <Clock3 size={20} />
          <div>
            <b>Standard Working Schedule Suggestion</b>
            <small>Monday – Saturday · 9:00 AM – 7:30 PM (Sunday Closed or Emergency Only)</small>
          </div>
        </div>
      </div>

      {/* Edit Hours Modal */}
      {editingHoursBiz && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Edit Operating Hours for {editingHoursBiz.name}</h3>
              <button onClick={() => setEditingHoursBiz(null)}><X size={18} /></button>
            </div>
            <form className="form" onSubmit={saveHours}>
              <label>
                Operating Hours Description
                <input
                  required
                  value={customHours}
                  onChange={(e) => setCustomHours(e.target.value)}
                  placeholder="e.g. Mon - Fri: 9:00 AM - 7:00 PM, Sat: 10:00 AM - 4:00 PM, Sun: Closed"
                />
              </label>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: '#887c9c' }}>Presets:</span>
                <button
                  type="button"
                  className="search-chip-btn"
                  onClick={() => setCustomHours('Daily: 8:00 AM - 9:00 PM')}
                >
                  Daily 8AM-9PM
                </button>
                <button
                  type="button"
                  className="search-chip-btn"
                  onClick={() => setCustomHours('Mon - Sat: 9:00 AM - 7:30 PM, Sun: Closed')}
                >
                  Mon-Sat 9AM-7:30PM
                </button>
                <button
                  type="button"
                  className="search-chip-btn"
                  onClick={() => setCustomHours('Mon - Fri: 10:00 AM - 6:00 PM')}
                >
                  Mon-Fri 10AM-6PM
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button type="button" className="btn outline" onClick={() => setEditingHoursBiz(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Save Working Hours
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


// ==========================================
// 12. BUSINESS SETTINGS PAGE (Business Owner)
// ==========================================

function SettingsPage({ user, notify }) {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [owned, setOwned] = useState([]);

  useEffect(() => {
    API.get('/owner/businesses', { params: { owner_id: user.id } })
      .then((r) => setOwned(r.data))
      .catch(() => {});
  }, [user.id]);

  const requestVerification = async () => {
    if (!owned.length) {
      notify('Please create a business profile before requesting verification.');
      return;
    }
    setVerifying(true);
    try {
      const res = await API.post('/owner/verification', { business_id: owned[0].id });
      notify(res.data.message || 'Verification request sent to administrators!');
    } catch {
      notify('Could not submit verification request.');
    } finally {
      setVerifying(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassBusy(true);
    try {
      await API.post('/change-password', { old_password: oldPass, new_password: newPass });
      notify('Password changed successfully.');
      setOldPass('');
      setNewPass('');
    } catch (err) {
      notify(err.response?.data?.error || 'Could not change password.');
    } finally {
      setPassBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT PREFERENCES"
        title={<>Business <span>settings.</span></>}
        subtitle="Control communication preferences, verification badge status and account security."
      />

      <div className="panel settings-form">
        <h3>Communication & Alerts</h3>
        <Toggle label="Email notifications for new customer service requests" defaultChecked />
        <Toggle label="Weekly business performance & reach report" defaultChecked />
        <Toggle label="Instant customer review alerts" defaultChecked />
        <Toggle label="Platform product updates & features" />

        <div style={{ marginTop: '24px', borderTop: '1px solid #f2edf8', paddingTop: '16px' }}>
          <h3>Trust & Verification</h3>
          <div className="security-row">
            <ShieldCheck size={24} />
            <div>
              <b>LocalLink Verified Trust Badge</b>
              <small>Verified businesses receive a visible trust checkmark and appear higher in local searches.</small>
            </div>
            <button
              className="btn primary small"
              onClick={requestVerification}
              disabled={verifying}
            >
              {verifying ? 'Submitting…' : 'Submit verification request'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: '24px', borderTop: '1px solid #f2edf8', paddingTop: '16px' }}>
          <h3>Security & Sign-in</h3>
          <form onSubmit={handlePasswordChange}>
            <label>
              Current Password
              <input
                type="password"
                required
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                required
                minLength="6"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </label>
            <button className="btn outline small" disabled={passBusy} style={{ marginTop: '10px' }}>
              {passBusy ? 'Updating…' : 'Change password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}


// ==========================================
// 13. USER MANAGEMENT PAGE (Admin)
// ==========================================

function UsersPage({ notify }) {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    try {
      const res = await API.get('/admin/users');
      setUsers(res.data);
    } catch {
      setUsers([]);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const changeRole = async (uid, newRole) => {
    try {
      await API.patch(`/admin/users/${uid}`, { role: newRole });
      notify(`User role updated to ${newRole}.`);
      loadUsers();
    } catch {
      notify('Could not change role.');
    }
  };

  const deleteUser = async (uid) => {
    if (!window.confirm('Are you sure you want to remove this user account?')) return;
    try {
      await API.delete(`/admin/users/${uid}`);
      notify('User deleted successfully.');
      loadUsers();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not delete user.');
    }
  };

  const filtered = users.filter((u) => {
    if (roleFilter !== 'All' && u.role !== roleFilter) return false;
    if (search && !u.name.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <>
      <PageTitle
        eyebrow="COMMUNITY MANAGEMENT"
        title={<>Manage <span>users.</span></>}
        subtitle="View registered customers, business owners and platform administrators."
      />

      <div className="panel table-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <SectionHead
            title="All Platform Users"
            subtitle={`${filtered.length} matching user accounts`}
          />

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              placeholder="Search user by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: '1px solid #e5dfef', borderRadius: '8px', padding: '6px 10px', fontSize: '11px' }}
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ border: '1px solid #e5dfef', borderRadius: '8px', padding: '6px 10px', fontSize: '11px' }}
            >
              <option value="All">All Roles</option>
              <option value="customer">Customers</option>
              <option value="business">Business Owners</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Phone</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #ddd' }}
                  >
                    <option value="customer">customer</option>
                    <option value="business">business</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{u.phone || '—'}</td>
                <td>{u.created_at?.split(' ')[0] || '—'}</td>
                <td>
                  <button
                    className="icon-btn danger"
                    onClick={() => deleteUser(u.id)}
                    title="Delete User"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!filtered.length && (
          <Empty text="No users found matching your search." />
        )}
      </div>
    </>
  );
}


// ==========================================
// 14. BUSINESS VERIFICATION PAGE (Admin)
// ==========================================

function VerificationPage({ refreshBusinesses, notify }) {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending'); // pending, all

  const loadList = async () => {
    try {
      if (filter === 'pending') {
        const res = await API.get('/admin/businesses/pending');
        setRows(res.data);
      } else {
        const res = await API.get('/businesses');
        setRows(res.data);
      }
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    loadList();
  }, [filter]);

  const setVerify = async (bid, verified) => {
    try {
      await API.patch(`/admin/businesses/${bid}/verify`, { verified });
      notify(verified ? 'Business verified and trust badge awarded!' : 'Business marked unverified.');
      loadList();
      refreshBusinesses();
    } catch {
      notify('Could not update verification status.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="TRUST & SAFETY"
        title={<>Business <span>verification.</span></>}
        subtitle="Review new business submissions and assign verified badges to legitimate local listings."
      />

      <div className="panel table-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <SectionHead
            title={filter === 'pending' ? 'Pending Review Queue' : 'All Marketplace Listings'}
            subtitle={`${rows.length} listings in this view`}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`search-chip-btn ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending Approval
            </button>
            <button
              className={`search-chip-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Listings
            </button>
          </div>
        </div>

        {rows.map((b) => (
          <div className="verify-row" key={b.id}>
            <div className="business-thumb"><Store size={18} /></div>
            <div className="verify-main">
              <b>{b.name}</b>
              <small>Category: {b.category} · Area: {b.area} · Phone: {b.phone || 'None'}</small>
              <p>{b.description}</p>
            </div>
            <span className={b.verified ? 'status-pill accepted' : 'pending-pill'}>
              {b.verified ? 'Verified' : 'Pending Review'}
            </span>
            <div className="row-actions">
              {!b.verified ? (
                <>
                  <button className="accept-btn" onClick={() => setVerify(b.id, true)}>
                    <Check size={14} /> Approve & Verify
                  </button>
                  <button className="reject-btn" onClick={() => setVerify(b.id, false)}>
                    <X size={14} /> Reject
                  </button>
                </>
              ) : (
                <button className="reject-btn" onClick={() => setVerify(b.id, false)}>
                  Revoke Verification
                </button>
              )}
            </div>
          </div>
        ))}

        {!rows.length && (
          <Empty text={filter === 'pending' ? 'All caught up! No businesses are awaiting verification.' : 'No businesses found.'} />
        )}
      </div>
    </>
  );
}


// ==========================================
// 15. REPORTS & INSIGHTS PAGE (Admin)
// ==========================================

function AdminReportsPage({ notify }) {
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    API.get('/admin/insights')
      .then((r) => setInsights(r.data))
      .catch(() => {});
  }, []);

  return (
    <>
      <PageTitle
        eyebrow="PLATFORM INTELLIGENCE"
        title={<>Reports & <span>insights.</span></>}
        subtitle="Platform-wide growth metrics, category distributions and completion rates."
      />

      <div className="stats-grid">
        <Stat
          icon={Users}
          label="Total Users"
          value={insights ? insights.users.total : '...'}
          delta={`${insights?.users.customers || 0} customers, ${insights?.users.business_owners || 0} owners`}
          color="blue"
        />
        <Stat
          icon={Store}
          label="Total Businesses"
          value={insights ? insights.businesses.total : '...'}
          delta={`${insights?.businesses.verified || 0} verified trust badges`}
          color="violet"
        />
        <Stat
          icon={ClipboardList}
          label="Service Requests"
          value={insights ? insights.requests.total : '...'}
          delta={`${insights?.requests.completed || 0} successfully completed`}
          color="green"
        />
        <Stat
          icon={CheckCircle2}
          label="Completion Rate"
          value={
            insights?.requests.total > 0
              ? `${Math.round((insights.requests.completed / insights.requests.total) * 100)}%`
              : '100%'
          }
          delta="Enquiry conversion"
          color="amber"
        />
      </div>

      <div className="content-grid">
        <div className="panel chart-panel">
          <SectionHead
            title="Business Distribution by Category"
            subtitle="Marketplace supply across major service categories"
          />
          {insights?.categories && (
            <div style={{ height: '200px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.categories}>
                  <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#8f87a2' }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7551d2" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <SectionHead title="Platform Health Status" />
          <div className="summary-list">
            <div>
              <span>Customer Inquiries Pending</span>
              <b>{insights?.requests.pending || 0}</b>
            </div>
            <div>
              <span>Jobs in Progress</span>
              <b>{insights?.requests.in_progress || 0}</b>
            </div>
            <div>
              <span>Businesses Pending Verification</span>
              <b>{insights?.businesses.pending || 0}</b>
            </div>
            <div>
              <span>Administrator Accounts</span>
              <b>{insights?.users.admins || 1}</b>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// ==========================================
// 16. MANAGE CATEGORIES PAGE (Admin)
// ==========================================

function CategoriesPage({ notify }) {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');

  const loadCategories = async () => {
    try {
      const res = await API.get('/categories');
      setCats(res.data);
    } catch {
      setCats([]);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const addCategory = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await API.post('/categories', { name: name.trim() });
      notify(`Category "${name}" added.`);
      setName('');
      loadCategories();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not add category.');
    }
  };

  const deleteCategory = async (catName) => {
    if (!window.confirm(`Are you sure you want to remove category "${catName}"?`)) return;
    try {
      await API.delete(`/categories/${encodeURIComponent(catName)}`);
      notify(`Category "${catName}" removed.`);
      loadCategories();
    } catch (err) {
      notify(err.response?.data?.error || 'Could not delete category.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="DISCOVERY STRUCTURE"
        title={<>Manage <span>categories.</span></>}
        subtitle="Organise local marketplace categories so customers can discover what they need."
      />

      <div className="panel">
        <SectionHead
          title="Marketplace Categories"
          subtitle="Add or delete categories across the platform"
        />

        <form className="inline-add" onSubmit={addCategory}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter new category name (e.g. Pet Care, Gardening)…"
            required
          />
          <button className="btn primary">
            <Plus size={15} /> Add category
          </button>
        </form>

        <div className="category-admin-grid">
          {cats.map((c, i) => (
            <div key={c.name} className="category-admin-card">
              <span className={`cat-icon c${i % 6}`}><CategoryIcon i={i} /></span>
              <div style={{ flex: 1 }}>
                <b>{c.name}</b>
                <small style={{ display: 'block', fontSize: '10px', color: '#9188a1' }}>
                  {c.count} {c.count === 1 ? 'business' : 'businesses'} listed
                </small>
              </div>
              <button
                className="icon-btn danger"
                onClick={() => deleteCategory(c.name)}
                title="Delete Category"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}


// ==========================================
// 17. REPORTED CONTENT PAGE (Admin)
// ==========================================

function ContentPage({ refreshBusinesses, notify }) {
  const [reports, setReports] = useState([]);

  const loadReports = async () => {
    try {
      const res = await API.get('/admin/reports');
      setReports(res.data);
    } catch {
      setReports([]);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const resolveReport = async (rid, status) => {
    try {
      await API.patch(`/admin/reports/${rid}`, { status });
      notify(`Report marked as ${status}.`);
      loadReports();
    } catch {
      notify('Could not update report status.');
    }
  };

  const unverifyReportedBiz = async (bid, rid) => {
    try {
      await API.patch(`/admin/businesses/${bid}/verify`, { verified: false });
      await API.patch(`/admin/reports/${rid}`, { status: 'Resolved' });
      notify('Business unverified and report marked resolved.');
      loadReports();
      refreshBusinesses();
    } catch {
      notify('Action failed.');
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="COMMUNITY TRUST"
        title={<>Reported <span>content.</span></>}
        subtitle="Review community flags, misleading listings and suspicious business information."
      />

      <div className="panel table-panel">
        <SectionHead
          title="Reported Business Listings"
          subtitle="Reports submitted by community members"
        />

        {reports.map((r) => (
          <div className="verify-row" key={r.id}>
            <span className="attention-icon pink"><Flag size={18} /></span>
            <div className="verify-main">
              <b>{r.business}</b>
              <small>Reason: {r.reason} · Reporter: {r.reporter} ({r.created_at})</small>
              {r.details && <p>Details: {r.details}</p>}
            </div>
            <span className={`status-pill ${r.status === 'Open' ? 'rejected' : 'accepted'}`}>
              {r.status}
            </span>
            <div className="row-actions">
              {r.status === 'Open' ? (
                <>
                  <button className="btn small outline" onClick={() => resolveReport(r.id, 'Reviewed')}>
                    Mark Reviewed
                  </button>
                  <button className="btn small danger" onClick={() => unverifyReportedBiz(r.business_id, r.id)}>
                    Revoke Verification
                  </button>
                </>
              ) : (
                <small style={{ color: '#27a97b', fontWeight: 700 }}>Resolved</small>
              )}
            </div>
          </div>
        ))}

        {!reports.length && (
          <Empty text="No active reports. Community is clean and well-moderated!" />
        )}
      </div>
    </>
  );
}


// ==========================================
// 18. ADMIN SETTINGS PAGE (Admin)
// ==========================================

function AdminSettings({ user, notify }) {
  const [settings, setSettings] = useState({
    ai_matching: true,
    customer_notifications: true,
    require_verification: true,
    allow_registrations: true,
    maintenance_mode: false,
    flag_duplicates: true
  });

  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  useEffect(() => {
    API.get('/admin/settings')
      .then((r) => setSettings(r.data))
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    try {
      await API.post('/admin/settings', settings);
      notify('Platform settings saved successfully.');
    } catch {
      notify('Could not save platform settings.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPassBusy(true);
    try {
      await API.post('/change-password', { old_password: oldPass, new_password: newPass });
      notify('Administrator password updated.');
      setOldPass('');
      setNewPass('');
    } catch (err) {
      notify(err.response?.data?.error || 'Password update failed.');
    } finally {
      setPassBusy(false);
    }
  };

  return (
    <>
      <PageTitle
        eyebrow="PLATFORM CONFIGURATION"
        title={<>System <span>settings.</span></>}
        subtitle="Manage platform capabilities, moderation rules and administrator account security."
      />

      <div className="panel settings-form">
        <h3>Platform Capabilities</h3>
        <Toggle
          label="Enable AI-assisted smart business discovery & ranking"
          defaultChecked={settings.ai_matching}
          onChange={(val) => setSettings({ ...settings, ai_matching: val })}
        />
        <Toggle
          label="Enable customer notifications for status updates"
          defaultChecked={settings.customer_notifications}
          onChange={(val) => setSettings({ ...settings, customer_notifications: val })}
        />
        <Toggle
          label="Require admin verification before displaying verified trust badge"
          defaultChecked={settings.require_verification}
          onChange={(val) => setSettings({ ...settings, require_verification: val })}
        />
        <Toggle
          label="Allow new customer & business registrations"
          defaultChecked={settings.allow_registrations}
          onChange={(val) => setSettings({ ...settings, allow_registrations: val })}
        />
        <Toggle
          label="Maintenance mode (prevent non-admin requests)"
          defaultChecked={settings.maintenance_mode}
          onChange={(val) => setSettings({ ...settings, maintenance_mode: val })}
        />

        <button className="btn primary" onClick={saveSettings} style={{ marginTop: '14px' }}>
          Save Platform Settings
        </button>

        <div style={{ marginTop: '28px', borderTop: '1px solid #f2edf8', paddingTop: '16px' }}>
          <h3>Administrator Password</h3>
          <form onSubmit={handlePasswordChange}>
            <label>
              Current Password
              <input
                type="password"
                required
                value={oldPass}
                onChange={(e) => setOldPass(e.target.value)}
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                required
                minLength="6"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </label>
            <button className="btn outline small" disabled={passBusy} style={{ marginTop: '10px' }}>
              {passBusy ? 'Updating…' : 'Change admin password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}


// ==========================================
// UTILITY COMPONENTS
// ==========================================

function Toggle({ label, defaultChecked = false, onChange }) {
  const [on, setOn] = useState(defaultChecked);

  useEffect(() => {
    setOn(defaultChecked);
  }, [defaultChecked]);

  const toggle = () => {
    const next = !on;
    setOn(next);
    if (onChange) onChange(next);
  };

  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button
        type="button"
        className={`toggle ${on ? 'on' : ''}`}
        onClick={toggle}
        aria-label={`Toggle ${label}`}
      >
        <i />
      </button>
    </div>
  );
}

function PerformanceChart({ data }) {
  const rows = data || [
    { day: 'Mon', value: 24 },
    { day: 'Tue', value: 38 },
    { day: 'Wed', value: 32 },
    { day: 'Thu', value: 55 },
    { day: 'Fri', value: 48 },
    { day: 'Sat', value: 76 },
    { day: 'Sun', value: 68 }
  ];

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8662e8" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#8662e8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9a94b1', fontSize: 11 }} />
          <YAxis hide />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#7750d8" strokeWidth={3} fill="url(#chartFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty-state">
      <span><Search size={22} /></span>
      <p>{text}</p>
    </div>
  );
}
      
