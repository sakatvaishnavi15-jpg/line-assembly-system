import { useEffect, useState } from 'react';
import { api, getApiBase } from '../api';
import { useToast } from '../components/Toast';

export default function QrCodes() {
  const [childParts, setChildParts] = useState([]);
  const [selectedChildPart, setSelectedChildPart] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [generated, setGenerated] = useState([]);
  const showToast = useToast();

  const selectedChildPartInfo = childParts.find(
    (c) => String(c.child_part_id) === String(selectedChildPart)
  );

  useEffect(() => {
    (async () => {
      try {
        const cp = await api.getChildParts();
        setChildParts(cp);
        if (cp.length > 0) setSelectedChildPart(String(cp[0].child_part_id));
      } catch (err) {
        showToast(err.message, 'error');
      }
    })();
  }, []);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedChildPart) {
      showToast('Select a child part first', 'error');
      return;
    }
    setGenerating(true);
    try {
      const n = Number(count) || 1;
      let results;
      if (n === 1) {
        results = [await api.generateQrCode({ child_part_id: Number(selectedChildPart), batch_no: batchNo || undefined })];
      } else {
        results = await api.generateQrCodesBulk({
          child_part_id: Number(selectedChildPart),
          batch_no: batchNo || undefined,
          count: n
        });
      }
      setGenerated(results);
      showToast(`Generated ${results.length} QR code${results.length > 1 ? 's' : ''}`);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Instead of printing the live app screen (unreliable across browsers —
  // stray UI leaking through, pagination bugs splitting images), this
  // generates a real, purpose-built PDF on the backend — the same approach
  // that already works reliably for build labels — and opens it for
  // printing. The browser's own PDF viewer print button is then used,
  // which handles pagination correctly since it's a real PDF, not a
  // paginated live webpage.
  const handlePrint = async () => {
    if (generated.length === 0) return;
    setPrinting(true);
    try {
      const items = generated.map((g) => ({
        qr_code: g.qr_code,
        part_code: selectedChildPartInfo?.part_code || ''
      }));

      const response = await fetch(`${getApiBase()}/qr-codes/label-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });

      if (!response.ok) {
        throw new Error('Failed to generate label sheet');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2>QR Code Generation</h2>
          <p className="sub">Create unique QR codes for physical child part units — print and attach them.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Generate QR codes</h3>
        <form onSubmit={handleGenerate}>
          <div className="form-row">
            <div className="field" style={{ flex: 2 }}>
              <label>Child Part</label>
              <select
                value={selectedChildPart}
                onChange={(e) => setSelectedChildPart(e.target.value)}
              >
                {childParts.length === 0 && <option value="">No child parts yet</option>}
                {childParts.map((c) => (
                  <option key={c.child_part_id} value={c.child_part_id}>
                    {c.part_name} ({c.part_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Batch No (optional)</label>
              <input
                placeholder="e.g. B2026-08"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
              />
            </div>
            <div className="field">
              <label>How Many</label>
              <input
                type="number"
                min="1"
                max="200"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={generating}>
            {generating ? 'Generating…' : 'Generate QR Code(s)'}
          </button>
        </form>
      </div>

      {generated.length > 0 && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Generated ({generated.length})</h3>
            <button className="btn btn-secondary" onClick={handlePrint} disabled={printing}>
              {printing ? 'Preparing PDF…' : 'Print Labels'}
            </button>
          </div>
          <div className="qr-grid">
            {generated.map((g) => (
              <div key={g.qr_id} className="qr-card">
                <div className="qr-part-code mono">{selectedChildPartInfo?.part_code || 'CHILD PART'}</div>
                <img src={g.qr_image} alt={g.qr_code} width="150" height="150" />
                <div className="qr-code-text mono">{g.qr_code}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .qr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
          margin-top: 16px;
        }
        .qr-card {
          background: #fff;
          border-radius: var(--radius);
          padding: 12px;
          text-align: center;
        }
        .qr-card img {
          width: 100%;
          height: auto;
          display: block;
        }
        .qr-part-code {
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #111827;
          letter-spacing: 0.04em;
        }
        .qr-code-text {
          margin-top: 6px;
          font-size: 10px;
          color: #333;
          word-break: break-all;
        }
      `}</style>
    </>
  );
}