const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const bwipjs = require('bwip-js');

/**
 * Generates a printable "Build Label" PDF for a completed assembly round,
 * matching the reference layout: big title + "*PARTS LIST" heading, a QR
 * code and barcode (with human-readable code beneath) on the left, and a
 * bordered NAME / QTY. grid of every part used, on the right.
 *
 * @param {Object} opts
 * @param {string} opts.mainPartName  - Name of the finished assembly
 * @param {string} opts.mainPartBrand - Brand name shown under the serial/barcode area
 * @param {string} opts.partCode      - Main part's short code (not shown directly, kept for callers)
 * @param {string} opts.buildSerialNo - Unique serial number for this build (encoded in the QR)
 * @param {string} opts.displayCode   - Human-readable code encoded in the barcode
 * @param {Array}  opts.checklist     - [{ part_name, qty_required }, ...]
 * @returns {Promise<Buffer>} PDF file as a buffer
 */
async function generateBuildLabelPDF({ mainPartName, mainPartBrand, partCode, buildSerialNo, displayCode, checklist }) {
  const codeToShow = displayCode || buildSerialNo;

  // QR encodes the build serial number (used for scanning/traceability lookups)
  const qrBuffer = await QRCode.toBuffer(buildSerialNo, { margin: 1, width: 300 });

  // Barcode encodes the same human-readable display code printed beneath it
  const barcodeBuffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text: codeToShow,
    scale: 7,
    height: 38,
    includetext: false,
    paddingwidth: 12,
    paddingheight: 12
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', layout: 'landscape', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width; // ~595.28
    const pageH = doc.page.height; // ~420.94

    // ---- Outer border ----
    const inset = 16;
    doc.lineWidth(1.3).rect(inset, inset, pageW - inset * 2, pageH - inset * 2).stroke();
    doc.lineWidth(1);

    const contentX = inset + 26;
    const contentRight = pageW - inset - 26;
    const contentTop = inset + 22;

    // ---- Title row: "MAIN PART NAME" + "*PARTS LIST" ----
    doc.font('Helvetica-Bold').fontSize(25);
    doc.text(mainPartName.toUpperCase(), contentX, contentTop, { lineBreak: false });
    const titleWidth = doc.widthOfString(mainPartName.toUpperCase());

    doc.fontSize(21);
    doc.text('*PARTS LIST', contentX + titleWidth + 34, contentTop + 2, { lineBreak: false });

    const rowTop = contentTop + 40;

    // ---- Left column: QR code + barcode + human-readable code ----
    const leftGroupX = contentX + 8;
    const leftGroupWidth = 220;
    const qrSize = 156;
    const qrX = leftGroupX + (leftGroupWidth - qrSize) / 2;

    doc.image(qrBuffer, qrX, rowTop, { width: qrSize, height: qrSize });

    if (mainPartBrand) {
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(String(mainPartBrand).toUpperCase(), leftGroupX, rowTop + qrSize + 10, {
          width: leftGroupWidth,
          align: 'center'
        });
    }

    const barcodeWidth = 214;
    const barcodeHeight = 72;
    const barcodeX = leftGroupX + (leftGroupWidth - barcodeWidth) / 2;
    const barcodeY = rowTop + qrSize + 42;
    doc.image(barcodeBuffer, barcodeX, barcodeY, { width: barcodeWidth, height: barcodeHeight });

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(codeToShow.toUpperCase(), barcodeX - 8, barcodeY + barcodeHeight + 10, {
        width: barcodeWidth + 16,
        align: 'center'
      });

    // ---- Right column: NAME / QTY. table ----
    const tableX = leftGroupX + leftGroupWidth + 26;
    const tableWidth = contentRight - tableX;
    const qtyColWidth = 52;
    const nameColWidth = tableWidth - qtyColWidth;

    doc.font('Helvetica-Bold').fontSize(15.5);
    doc.text('NAME', tableX, rowTop);
    doc.text('QTY.', tableX + nameColWidth, rowTop, { width: qtyColWidth, align: 'right' });

    const headerLineY = rowTop + 22;
    doc.moveTo(tableX, headerLineY).lineTo(tableX + tableWidth, headerLineY).stroke();

    // Fit all rows within the remaining vertical space, capped at a sensible max height
    const bottomLimit = pageH - inset - 20;
    const availableHeight = bottomLimit - (headerLineY + 4);
    const rowCount = Math.max(checklist.length, 1);
    const rowHeight = Math.min(26, Math.max(18, availableHeight / rowCount));

    doc.font('Helvetica').fontSize(11.5);
    let rowY = headerLineY + 4;

    checklist.forEach((item) => {
      doc.rect(tableX, rowY, tableWidth, rowHeight).stroke();
      doc.moveTo(tableX + nameColWidth, rowY).lineTo(tableX + nameColWidth, rowY + rowHeight).stroke();

      doc.text(String(item.part_name || ''), tableX + 8, rowY + rowHeight / 2 - 6, {
        width: nameColWidth - 14,
        align: 'left'
      });
      doc.text(String(item.qty_required ?? ''), tableX + nameColWidth, rowY + rowHeight / 2 - 6, {
        width: qtyColWidth,
        align: 'center'
      });

      rowY += rowHeight;
    });

    doc.end();
  });
}

module.exports = { generateBuildLabelPDF };