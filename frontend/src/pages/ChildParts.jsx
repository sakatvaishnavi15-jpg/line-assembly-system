import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function ChildParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ part_code: '', part_name: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const showToast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      setParts(await api.getChildParts());
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
      await api.createChildPart(form);
      showToast(`Created "${form.part_name}"`);
      setForm({ part_code: '', part_name: '', category: '' });
      load();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (part) => {
    setEditingId(part.child_part_id);
    setDraft({
      part_code: part.part_code,
      part_name: part.part_name,
      category: part.category || ''
    });
  };

  const handleUpdate = async () => {
    if (!draft || !draft.part_code.trim() || !draft.part_name.trim()) {
      showToast('Part code and name are required', 'error');
      return;
    }

    try {
      await api.updateChildPart(editingId, draft);
      showToast(`Updated "${draft.part_name}"`);
      setEditingId(null);
      setDraft(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?\n\nIf this part is linked in a BOM, has QR codes, or appears in scan logs, the delete will be blocked.`)) return;
    try {
      await api.deleteChildPart(id);
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
          <h2>Child Part Master</h2>
          <p className="sub">Components that get scanned into assemblies — reusable across any main part.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Add a child part</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field">
              <label>Part Code</label>
              <input
                placeholder="e.g. WCARD"
                value={form.part_code}
                onChange={(e) => setForm({ ...form, part_code: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Part Name</label>
              <input
                placeholder="e.g. Warranty Card"
                value={form.part_name}
                onChange={(e) => setForm({ ...form, part_name: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 2 }}>
              <label>Category (optional)</label>
              <input
                placeholder="e.g. Documentation"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Adding…' : 'Add Child Part'}
          </button>
        </form>
      </div>

      <div className="panel">
        <h3>All child parts</h3>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : parts.length === 0 ? (
          <div className="empty-state">No child parts yet — add one above to get started.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Part Code</th>
                <th>Name</th>
                <th>Category</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => {
                const isEditing = editingId === p.child_part_id;
                return (
                  <tr key={p.child_part_id}>
                    <td className="mono">{p.child_part_id}</td>
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
                          value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                        />
                      ) : (
                        p.category || '—'
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
                          <button className="btn btn-danger btn-small" onClick={() => handleDelete(p.child_part_id, p.part_name)}>Delete</button>
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
