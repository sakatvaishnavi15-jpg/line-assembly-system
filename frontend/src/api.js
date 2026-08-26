import axios from 'axios';

const API_BASE = 'http://localhost:4000/api';

export function getApiBase() {
  return API_BASE;
}

const client = axios.create({ baseURL: API_BASE });

// Unwrap axios responses/errors into plain data + readable messages
async function call(promise) {
  try {
    const res = await promise;
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    const message = data?.error || data?.message || err.message || 'Something went wrong';
    const wrapped = new Error(message);
    wrapped.data = data; // preserve full payload (e.g. { result: 'Fail-Duplicate', ... })
    throw wrapped;
  }
}

export const api = {
  // Main Parts
  getMainParts: () => call(client.get('/main-parts')),
  createMainPart: (data) => call(client.post('/main-parts', data)),
  updateMainPart: (id, data) => call(client.put(`/main-parts/${id}`, data)),
  deleteMainPart: (id) => call(client.delete(`/main-parts/${id}`)),

  // Child Parts
  getChildParts: () => call(client.get('/child-parts')),
  createChildPart: (data) => call(client.post('/child-parts', data)),
  updateChildPart: (id, data) => call(client.put(`/child-parts/${id}`, data)),
  deleteChildPart: (id) => call(client.delete(`/child-parts/${id}`)),

  // BOM Links
  getBom: (mainPartId) => call(client.get(`/bom-links/main-part/${mainPartId}`)),
  createBomLink: (data) => call(client.post('/bom-links', data)),
  deleteBomLink: (bomId) => call(client.delete(`/bom-links/${bomId}`)),

  // QR Codes
  getQrCodes: (childPartId) =>
    call(client.get('/qr-codes', { params: childPartId ? { child_part_id: childPartId } : {} })),
  generateQrCode: (data) => call(client.post('/qr-codes/generate', data)),
  generateQrCodesBulk: (data) => call(client.post('/qr-codes/generate-bulk', data)),

  // Assembly Rounds
  startRound: (data) => call(client.post('/rounds/start', data)),
  getRound: (roundId) => call(client.get(`/rounds/${roundId}`)),
  scanQr: (roundId, qr_code, round_number) =>
    call(client.post(`/rounds/${roundId}/scan`, { qr_code, round_number })),
  getLabelUrl: (roundId) => `${API_BASE}/rounds/${roundId}/label`
};
