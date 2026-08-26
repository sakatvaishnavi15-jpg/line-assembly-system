import { useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { ToastProvider, useToast } from './components/Toast';
import MainParts from './pages/MainParts';
import ChildParts from './pages/ChildParts';
import BomLinks from './pages/BomLinks';
import QrCodes from './pages/QrCodes';
import Assembly from './pages/Assembly';
import UsersPage from './pages/Users';
import './theme.css';

const STORAGE_KEY = 'line-assembly-user';
const USERS_KEY = 'line-assembly-users';

const defaultUsers = [
  { id: 1, username: 'admin', fullName: 'System Admin', role: 'admin', password: 'admin123' },
  { id: 2, username: 'supervisor', fullName: 'Line Supervisor', role: 'supervisor', password: 'sup123' },
  { id: 3, username: 'operator', fullName: 'Operator', role: 'operator', password: 'op123' }
];

function getStoredUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return defaultUsers;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultUsers;
  } catch {
    return defaultUsers;
  }
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const showToast = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    const users = getStoredUsers();
    const match = users.find(
      (user) => user.username.toLowerCase() === username.trim().toLowerCase() && user.password === password
    );

    if (!match) {
      setError('Invalid username or password');
      showToast('Invalid username or password', 'error');
      return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
    onLogin(match);
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="sidebar-brand login-brand">
          <div className="mark">LA</div>
          <h1>Line Assembly</h1>
          <p>Verification System</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <h2>Sign in</h2>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="btn btn-primary btn-block" type="submit">Login</button>
          <div className="demo-login">
            Demo accounts: admin/admin123, supervisor/sup123, operator/op123
          </div>
        </form>
      </div>
    </div>
  );
}

function AppShell({ user, onLogout }) {
  const navigate = useNavigate();
  const nav = [
    { section: 'Live Line' },
    { to: '/', label: 'Scan Station', end: true },
    { section: 'Setup' },
    { to: '/main-parts', label: 'Main Parts' },
    { to: '/child-parts', label: 'Child Parts' },
    { to: '/bom', label: 'Bill of Materials' },
    { to: '/qr-codes', label: 'QR Codes' }
  ];

  const handleExit = () => navigate('/');

  const visibleNav =
    user.role === 'admin'
      ? [...nav, { to: '/user-master', label: 'User Master' }]
      : user.role === 'supervisor'
        ? nav.filter((item) => !['/user-master'].includes(item.to))
        : [{ section: 'Live Line' }, { to: '/', label: 'Scan Station', end: true }];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="mark">LA</div>
          <h1>Line Assembly</h1>
          <p>{user.role}</p>
        </div>
        <nav>
          {visibleNav.map((item, i) =>
            item.section ? (
              <div className="nav-section-label" key={i}>
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
              >
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="sidebar-user-box">
          <div>
            <div className="user-name">{user.fullName}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <button className="btn btn-secondary btn-small" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-area">
        <div className="top-bar">
          <div />
          <button className="btn btn-secondary" onClick={handleExit}>Exit</button>
        </div>
        <Routes>
          <Route path="/" element={<Assembly onExit={handleExit} />} />
          <Route path="/main-parts" element={<MainParts />} />
          <Route path="/child-parts" element={<ChildParts />} />
          <Route path="/bom" element={<BomLinks />} />
          <Route path="/qr-codes" element={<QrCodes />} />
          <Route path="/user-master" element={user.role === 'admin' ? <UsersPage /> : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <ToastProvider>
      <HashRouter>
        {!user ? (
          <LoginPage onLogin={setUser} />
        ) : (
          <AppShell user={user} onLogout={handleLogout} />
        )}
      </HashRouter>
    </ToastProvider>
  );
}
