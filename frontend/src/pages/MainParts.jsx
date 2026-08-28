import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function MainParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ part_code: '', part_name: '', brand: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const showToast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getMainParts();
      setParts(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.part_code.trim() || !form.part_name.trim()) {
      showToast('Part code and name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createMainPart(form);
      showToast(`Created "${form.part_name}"`);
      setForm({ part_code: '', part_name: '', brand: '', description: '' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (part) => {
    setEditingId(part.main_part_id);
    setDraft({
      part_code: part.part_code,
      part_name: part.part_name,
      brand: part.brand || '',
      description: part.description || '',
      revision: part.revision || 'A',
      status: part.status || 'Active'
    });
  };

  const handleUpdate = async () => {
    if (!draft || !draft.part_code.trim() || !draft.part_name.trim()) {
      showToast('Part code and name are required', 'error');
      return;
    }

    try {
      await api.updateMainPart(editingId, draft);
      showToast(`Updated "${draft.part_name}"`);
      setEditingId(null);
      setDraft(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?\n\nThis will also remove all its BOM links. If assembly rounds or scan logs reference this part, the delete will be blocked.`)) return;
    try {
      await api.deleteMainPart(id);
      showToast(`Deleted "${name}"`);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Main Part Master</h2>
          <p className="sub">Finished assemblies that a line builds — each one gets its own BOM.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Add a main part</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Part Code</label>
              <input
                placeholder="e.g. ACCBAG01"
                value={form.part_code}
                onChange={(e) => setForm({ ...form, part_code: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Part Name</label>
              <input
                placeholder="e.g. Accessories Bag"
                value={form.part_name}
                onChange={(e) => setForm({ ...form, part_name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Brand</label>
              <input
                placeholder="e.g. ABC"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Description (optional)</label>
              <input
                placeholder="Short description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add Main Part'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>All main parts</h3>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : parts.length === 0 ? (
          <div className="empty-state">No main parts yet — add one above to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Part Code</th>
                <th>Name</th>
                <th>Brand</th>
                <th>Description</th>
                <th>Revision</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const isEditing = editingId === p.main_part_id;
                return (
                  <tr key={p.main_part_id}>
                    <td className="mono">{p.main_part_id}</td>
                    <td className="mono">
                      {isEditing ? (
                        <input
                          value={draft.part_code}
                          onChange={(e) => setDraft({ ...draft, part_code: e.target.value })}
                        />
                      ) : (
                        p.part_code
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={draft.part_name}
                          onChange={(e) => setDraft({ ...draft, part_name: e.target.value })}
                        />
                      ) : (
                        p.part_name
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={draft.brand}
                          onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                        />
                      ) : (
                        p.brand || '—'
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      ) : (
                        p.description || '—'
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          value={draft.revision}
                          onChange={(e) => setDraft({ ...draft, revision: e.target.value })}
                        />
                      ) : (
                        p.revision
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          value={draft.status}
                          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      ) : (
                        <span className="badge badge-active">{p.status}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div className="inline-actions">
                          <button className="btn btn-primary btn-small" onClick={handleUpdate}>Save</button>
                          <button className="btn btn-secondary btn-small" onClick={() => setEditingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <button className="btn btn-secondary btn-small" onClick={() => beginEdit(p)}>Edit</button>
                          <button className="btn btn-danger btn-small" onClick={() => handleDelete(p.main_part_id, p.part_name)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
