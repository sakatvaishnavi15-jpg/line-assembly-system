require('dotenv').config();
const express = require('express');
const cors = require('cors');

const mainPartsRouter = require('./routes/mainParts');
const childPartsRouter = require('./routes/childParts');
const bomLinksRouter = require('./routes/bomLinks');
const qrCodesRouter = require('./routes/qrCodes');
const roundsRouter = require('./routes/rounds');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/main-parts', mainPartsRouter);
app.use('/api/child-parts', childPartsRouter);
app.use('/api/bom-links', bomLinksRouter);
app.use('/api/qr-codes', qrCodesRouter);
app.use('/api/rounds', roundsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Line Assembly backend running on http://localhost:${PORT}`);
});
