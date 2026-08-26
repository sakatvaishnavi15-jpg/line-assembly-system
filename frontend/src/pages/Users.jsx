import { useEffect, useState } from 'react';

const STORAGE_KEY = 'line-assembly-users';
const defaultUsers = [
  { id: 1, username: 'admin', fullName: 'System Admin', role: 'admin', password: 'admin123' },
  { id: 2, username: 'supervisor', fullName: 'Line Supervisor', role: 'supervisor', password: 'sup123' },
  { id: 3, username: 'operator', fullName: 'Operator', role: 'operator', password: 'op123' }
];

function loadUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUsers;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultUsers;
  } catch {
    return defaultUsers;
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState(loadUsers);
  const [form, setForm] = useState({ fullName: '', username: '', role: 'operator', password: '1234' });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }, [users]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.username.trim()) return;

    setUsers((current) => {
      const nextId = current.reduce((max, user) => Math.max(max, user.id), 0) + 1;
      return [
        ...current,
        {
          id: nextId,
          fullName: form.fullName.trim(),
          username: form.username.trim(),
          role: form.role,
          password: form.password.trim() || '1234'
        }
      ];
    });

    setForm({ fullName: '', username: '', role: 'operator', password: '1234' });
  };

  const handleDelete = (id) => {
    const target = users.find((user) => user.id === id);
    if (!target) return;
    if (!window.confirm(`Delete user "${target.fullName}"?`)) return;
    setUsers((current) => current.filter((user) => user.id !== id));
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>User Master</h2>
          <p className="sub">Manage who can access the system and which tabs they can see.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Add user</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Full Name</label>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="operator">Operator</option>
              </select>
            </div>
            <div className="field">
              <label>Password</label>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Add User</button>
        </form>
      </div>

      <div className="panel">
        <h3>All users</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Password</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.fullName}</td>
                <td className="mono">{user.username}</td>
                <td>
                  <span className="badge badge-active">{user.role}</span>
                </td>
                <td className="mono">{user.password}</td>
                <td>
                  <button className="btn btn-danger" onClick={() => handleDelete(user.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
