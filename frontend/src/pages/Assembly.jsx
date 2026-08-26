import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Assembly({ onExit }) {
  const [mainParts, setMainParts] = useState([]);
  const [selectedMainPart, setSelectedMainPart] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [round, setRound] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [starting, setStarting] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanBanner, setScanBanner] = useState(null);
  const [finishedLabel, setFinishedLabel] = useState(null);
  const [roundNumber, setRoundNumber] = useState(0);
  const [trackedMainPart, setTrackedMainPart] = useState(null);
  const [trackedDateKey, setTrackedDateKey] = useState('');
  const inputRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const mp = await api.getMainParts();
        setMainParts(mp);
        if (mp.length > 0) setSelectedMainPart(String(mp[0].main_part_id));
      } catch (err) {
        showToast(err.message, 'error');
      }
    })();
  }, []);

  useEffect(() => {
    if (round && !finishedLabel && inputRef.current) {
      inputRef.current.focus();
    }
  }, [round, finishedLabel, checklist]);

  useEffect(() => {
    if (!round || !finishedLabel) return;

    const printUrl = `http://localhost:4000${finishedLabel.label_endpoint}`;
    const labelWindow = window.open(printUrl, '_blank', 'noopener,noreferrer');

    if (labelWindow) {
      labelWindow.focus();
      const triggerPrint = () => {
        try {
          labelWindow.focus();
          labelWindow.print();
        } catch (error) {
          // Browser may block programmatic print; the PDF still opens for review.
        }
      };

      if (labelWindow.addEventListener) {
        labelWindow.addEventListener('load', () => {
          setTimeout(triggerPrint, 600);
        }, { once: true });
      } else {
        setTimeout(triggerPrint, 600);
      }
    }

    const timer = setTimeout(() => {
      handleNextRound();
    }, 1200);

    return () => clearTimeout(timer);
  }, [round, finishedLabel]);

  const handleStartRound = async () => {
    if (!selectedMainPart) {
      showToast('Select a main part first', 'error');
      return;
    }
    setStarting(true);
    setFinishedLabel(null);
    setScanBanner(null);
    try {
      const data = await api.startRound({
        main_part_id: Number(selectedMainPart),
        operator_name: operatorName || undefined
      });
      const todayKey = new Date().toDateString();
      setRound(data.round);
      setChecklist(data.checklist);
      setRoundNumber((prev) => {
        if (trackedMainPart !== selectedMainPart || trackedDateKey !== todayKey) {
          return 1;
        }
        return prev + 1;
      });
      setTrackedMainPart(selectedMainPart);
      setTrackedDateKey(todayKey);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const code = scanInput.trim();
    setScanInput('');
    if (!code || !round) return;

    try {
      const data = await api.scanQr(round.round_id, code, roundNumber || 1);
      setChecklist(data.checklist);
      setScanBanner({ type: 'pass', text: data.message || 'Scanned successfully' });

      if (data.round_complete) {
        setFinishedLabel(data.finished_assembly_qr);
      }
    } catch (err) {
      setScanBanner({ type: 'fail', text: err.message });
    }

    setTimeout(() => setScanBanner(null), 2000);
  };

  const resetRoundState = () => {
    setRound(null);
    setChecklist([]);
    setFinishedLabel(null);
    setScanBanner(null);
    setScanInput('');
    setTrackedDateKey('');
  };

  const handleNextRound = () => {
    resetRoundState();
    handleStartRound();
  };

  const remaining = checklist.reduce(
    (sum, c) => sum + Math.max(c.qty_required - c.scanned_qty, 0),
    0
  );
  const roundDisplay = round ? String(roundNumber || 0) : '—';

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Line Assembly — Scan Station</h2>
          <p className="sub">Scan every required child part to complete a build round.</p>
        </div>
      </div>

      {mainParts.length === 0 ? (
        <div className="panel">
          <div className="empty-state">
            No main parts yet — add one on the "Main Parts" page before starting a round.
          </div>
        </div>
      ) : (
        <div className="scan-three-col">
          <div className="panel section-panel section-main-part">
            <h3>Main Part</h3>

            {!round ? (
              <>
                <div className="field">
                  <label>Select Main Part</label>
                  <select
                    value={selectedMainPart}
                    onChange={(e) => setSelectedMainPart(e.target.value)}
                  >
                    {mainParts.map((p) => (
                      <option key={p.main_part_id} value={p.main_part_id}>
                        {p.part_name} ({p.part_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Operator (optional)</label>
                  <input
                    placeholder="Your name"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="active-main-part-name">
                  {mainParts.find((p) => p.main_part_id === round.main_part_id)?.part_name}
                </div>
                <div className="active-main-part-code mono">
                  {mainParts.find((p) => p.main_part_id === round.main_part_id)?.part_code}
                </div>
                {operatorName && <div className="operator-tag">Operator: {operatorName}</div>}

                {!finishedLabel && (
                  <form onSubmit={handleScanSubmit} style={{ marginTop: 18 }}>
                    <label
                      style={{
                        fontSize: 11.5,
                        color: 'var(--text-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                        display: 'block',
                        marginBottom: 5
                      }}
                    >
                      Scan Part QR
                    </label>
                    <input
                      ref={inputRef}
                      className="scan-input"
                      placeholder="Scan or type QR code…"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      autoFocus
                    />
                  </form>
                )}

                {scanBanner && (
                  <div className={`scan-banner scan-banner-${scanBanner.type}`}>
                    {scanBanner.type === 'pass' ? '✓ ' : '✕ '}
                    {scanBanner.text}
                  </div>
                )}

                {finishedLabel && (
                  <div className="finished-block">
                    <div className="finished-check">✓</div>
                    <div className="finished-serial mono">{finishedLabel.build_serial_no}</div>
                    <a className="btn btn-secondary" href={
                      `http://localhost:4000${finishedLabel.label_endpoint}`
                    } target="_blank" rel="noreferrer">Print / View label</a>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel section-panel section-round">
            <h3>Round</h3>

            <div className="stat-badges-vertical">
              <div className="stat-badge round-badge">
                <span className="stat-label">Round</span>
                <span className="stat-value">{roundDisplay}</span>
              </div>
              <div
                className={`stat-badge remaining-badge ${round && remaining === 0 ? 'remaining-zero' : ''}`}
              >
                <span className="stat-label">Unscanned</span>
                <span className="stat-value">{round ? remaining : '—'}</span>
              </div>
            </div>

            <div className="round-action">
              {!round && (
                <button className="btn btn-primary btn-block" onClick={handleStartRound} disabled={starting}>
                  {starting ? 'Starting…' : 'Start Packing'}
                </button>
              )}
              {round && !finishedLabel && (
                <div className="round-status-tag">Scanning in progress…</div>
              )}
              {round && finishedLabel && (
                <div className="round-status-tag auto-printing">Auto-printing and starting next round…</div>
              )}
            </div>

            {round && !finishedLabel && (
              <div className="scan-exit-wrap">
                <button className="btn btn-secondary" onClick={resetRoundState}>Exit</button>
              </div>
            )}
          </div>

          <div className="panel section-panel section-checklist">
            <h3>Checklist</h3>
            {!round ? (
              <div className="empty-state">Start a round to see the checklist.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Part</th>
                    <th>Required</th>
                    <th>Scanned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {checklist.map((c) => {
                    const done = c.scanned_qty >= c.qty_required;
                    return (
                      <tr key={c.child_part_id}>
                        <td>
                          {c.part_name}{' '}
                          <span className="mono" style={{ color: 'var(--text-faint)' }}>
                            ({c.part_code})
                          </span>
                        </td>
                        <td className="mono">{c.qty_required}</td>
                        <td className="mono">{c.scanned_qty}</td>
                        <td>
                          <span className={`badge ${done ? 'badge-active' : 'badge-used'}`}>
                            {done ? 'Complete' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <style>{`
        .scan-three-col {
          display: grid;
          grid-template-columns: 1fr 1fr 2fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 900px) {
          .scan-three-col { grid-template-columns: 1fr; }
        }
        .section-panel { min-height: 320px; }
        .active-main-part-name {
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
        }
        .active-main-part-code {
          font-size: 12px;
          color: var(--text-faint);
          margin-top: 2px;
        }
        .operator-tag {
          font-size: 12px;
          color: var(--text-dim);
          margin-top: 8px;
        }
        .scan-input {
          width: 100%;
          background: var(--bg);
          border: 2px solid var(--accent);
          border-radius: var(--radius);
          color: var(--text);
          font-family: var(--font-mono);
          font-size: 16px;
          padding: 13px 14px;
          outline: none;
        }
        .scan-banner {
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: var(--radius);
          font-size: 13.5px;
          font-weight: 600;
        }
        .scan-banner-pass { background: var(--pass-bg); color: var(--pass); }
        .scan-banner-fail { background: var(--fail-bg); color: var(--fail); }
        .finished-block {
          margin-top: 18px;
          text-align: center;
          padding: 18px 10px;
          border: 1px solid #1f4a30;
          background: var(--pass-bg);
          border-radius: var(--radius-lg);
        }
        .finished-check {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(61, 220, 132, 0.15);
          color: var(--pass);
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
        }
        .finished-serial {
          font-size: 11.5px;
          color: var(--text-dim);
          margin-bottom: 12px;
          word-break: break-all;
        }
        .section-round {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .stat-badges-vertical {
          display: flex;
          flex-direction: column;
          gap: 14px;
          align-items: center;
          margin: 8px 0 22px;
        }
        .stat-badge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 3px solid var(--border);
          background: var(--bg);
        }
        .stat-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-faint);
        }
        .stat-value {
          font-size: 34px;
          font-weight: 700;
          font-family: var(--font-mono);
          line-height: 1.1;
          margin-top: 2px;
        }
        .round-badge { border-color: var(--accent); }
        .round-badge .stat-value { color: var(--accent); }
        .remaining-badge { border-color: var(--fail); }
        .remaining-badge .stat-value { color: var(--fail); }
        .remaining-badge.remaining-zero { border-color: var(--pass); }
        .remaining-badge.remaining-zero .stat-value { color: var(--pass); }
        .round-action { width: 100%; }
        .btn-block { width: 100%; padding: 12px; font-size: 14px; }
        .round-status-tag {
          font-size: 12.5px;
          color: var(--text-dim);
          padding: 10px;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
        }
        .auto-printing {
          color: var(--accent);
          border-color: var(--accent);
        }
        .scan-exit-wrap {
          width: 100%;
          margin-top: 18px;
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </>
  );
}