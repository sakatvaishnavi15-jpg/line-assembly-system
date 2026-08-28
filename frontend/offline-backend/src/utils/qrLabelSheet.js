const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Generates a printable label sheet PDF — one small page per QR code,
 * each containing just the child part's code, the QR image, and the
 * unique QR code text beneath it. Designed to print cleanly to a label
 * printer, one physical label per page, with no extra app UI involved
 * (avoids all the unreliability of printing live browser DOM content).
 *
 * @param {Array} items - [{ qr_code: string, part_code: string }, ...]
 * @returns {Promise<Buffer>} PDF file as a buffer
 */
async function generateQrLabelSheetPDF(items) {
  return new Promise(async (resolve, reject) => {
    try {
      // Small custom label page size (~56mm x 70mm, in PDF points: 1mm ≈ 2.835pt)
      // Generous margins here are deliberate: PDFKit silently inserts an
      // extra page if flowing text would overflow the bottom margin, which
      // doubled every label when the layout was too tight.
      const labelWidth = 160; // ~56mm
      const labelHeight = 200; // ~70mm

      const doc = new PDFDocument({ size: [labelWidth, labelHeight], margin: 10 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      for (let i = 0; i < items.length; i++) {
        const { qr_code, part_code } = items[i];
        if (i > 0) doc.addPage({ size: [labelWidth, labelHeight], margin: 10 });

        const qrBuffer = await QRCode.toBuffer(qr_code, { margin: 1, width: 300 });

        const contentWidth = labelWidth - 20; // minus margins
        const qrSize = Math.min(contentWidth, 110);
        const qrX = (labelWidth - qrSize) / 2;

        // Part code label at top
        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .text((part_code || '').toUpperCase(), 10, 12, {
            width: contentWidth,
            align: 'center',
            lineBreak: false
          });

        // QR image centered
        const qrY = 32;
        doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

        // Keep it clean: only the child part code and the QR image are printed.
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateQrLabelSheetPDF };