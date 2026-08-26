import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function BomLinks() {
  const [mainParts, setMainParts] = useState([]);
  const [childParts, setChildParts] = useState([]);
  const [selectedMainPart, setSelectedMainPart] = useState('');
  const [bom, setBom] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ child_part_id: '', qty_required: 1, sequence_no: '' });
  const [saving, setSaving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [mp, cp] = await Promise.all([api.getMainParts(), api.getChildParts()]);
        setMainParts(mp);
        setChildParts(cp);
        if (mp.length > 0) setSelectedMainPart(String(mp[0].main_part_id));
      } catch (err) {
        showToast(err.message, 'error');
      }
    })();
  }, []);

  const loadBom = async (mainPartId) => {
    if (!mainPartId) {
      setBom([]);
      return;
    }
    setLoading(true);
    try {
      setBom(await api.getBom(mainPartId));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBom(selectedMainPart);
  }, [selectedMainPart]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!selectedMainPart || !form.child_part_id) {
      showToast('Select a main part and a child part', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.createBomLink({
        main_part_id: Number(selectedMainPart),
        child_part_id: Number(form.child_part_id),
        qty_required: Number(form.qty_required) || 1,
        sequence_no: form.sequence_no ? Number(form.sequence_no) : null
      });
      showToast('Added to BOM');
      setForm({ child_part_id: '', qty_required: 1, sequence_no: '' });
      loadBom(selectedMainPart);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (bomId, name) => {
    if (!window.confirm(`Remove "${name}" from this BOM?`)) return;
    try {
      await api.deleteBomLink(bomId);
      showToast('Removed from BOM');
      loadBom(selectedMainPart);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const linkedIds = new Set(bom.map((b) => b.child_part_id));
  const availableChildParts = childParts.filter((c) => !linkedIds.has(c.child_part_id));

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Bill of Materials</h2>
          <p className="sub">Link child parts to a main part, with the quantity required per build.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Select main part</h3>
        <div className="form-row">
          <div className="field" style={{ maxWidth: 320 }}>
            <label>Main Part</label>
            <select value={selectedMainPart} onChange={(e) => setSelectedMainPart(e.target.value)}>
              {mainParts.length === 0 && <option value="">No main parts yet</option>}
              {mainParts.map((p) => (
                <option key={p.main_part_id} value={p.main_part_id}>
                  {p.part_name} ({p.part_code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedMainPart && (
        <>
          <div className="panel">
            <h3>Add child part to this BOM</h3>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Child Part</label>
                  <select
                    value={form.child_part_id}
                    onChange={(e) => setForm({ ...form, child_part_id: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {availableChildParts.map((c) => (
                      <option key={c.child_part_id} value={c.child_part_id}>
                        {c.part_name} ({c.part_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Qty Required</label>
                  <input
                    type="number"
                    min="1"
                    value={form.qty_required}
                    onChange={(e) => setForm({ ...form, qty_required: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Sequence (optional)</label>
                  <input
                    type="number"
                    placeholder="Station order"
                    value={form.sequence_no}
                    onChange={(e) => setForm({ ...form, sequence_no: e.target.value })}
                  />
                </div>
              </div>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Adding…' : 'Add to BOM'}
              </button>
            </form>
          </div>

          <div className="panel">
            <h3>Current BOM</h3>
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : bom.length === 0 ? (
              <div className="empty-state">No child parts linked yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Seq</th>
                    <th>Part Code</th>
                    <th>Name</th>
                    <th>Qty Required</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((b) => (
                    <tr key={b.bom_id}>
                      <td className="mono">{b.sequence_no ?? '—'}</td>
                      <td className="mono">{b.part_code}</td>
                      <td>{b.part_name}</td>
                      <td>{b.qty_required}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleRemove(b.bom_id, b.part_name)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </>
  );
}
