import { jsPDF } from 'jspdf';
import logoUrl from '../assets/sri-kalyani-logo.png';

const MAROON = [128, 26, 57];
const GOLD = [184, 148, 58];
const INK = [33, 33, 33];
const MUTED = [100, 100, 100];
const LINE = [210, 200, 205];
const CREAM = [252, 248, 249];

let cachedLogoDataUrl = null;

async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const res = await fetch(logoUrl);
  const blob = await res.blob();
  cachedLogoDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return cachedLogoDataUrl;
}

function money(n) {
  const v = Number(n);
  if (Number.isNaN(v)) return '—';
  return `Rs. ${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function val(v) {
  if (v == null || v === '') return '—';
  return String(v);
}

function drawPageFrame(doc, pageW, pageH) {
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(1.1);
  doc.rect(8, 8, pageW - 16, pageH - 16);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.rect(10, 10, pageW - 20, pageH - 20);
}

function sectionHeading(doc, title, x, y, w) {
  doc.setFillColor(...MAROON);
  doc.roundedRect(x, y, w, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), x + 3.5, y + 5.4);
  return y + 12;
}

/** Draw a formal label/value row; returns next y */
function fieldRow(doc, label, value, x, y, w, opts = {}) {
  const labelW = opts.labelW ?? 48;
  const minH = opts.minH ?? 9;
  const pad = 2.2;
  const valueText = val(value);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(valueText, w - labelW - pad * 2);
  const h = Math.max(minH, pad * 2 + lines.length * 4.2);

  doc.setDrawColor(...LINE);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, w, h, 'FD');
  doc.setFillColor(...CREAM);
  doc.rect(x, y, labelW, h, 'F');
  doc.setDrawColor(...LINE);
  doc.line(x + labelW, y, x + labelW, y + h);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x + 2.2, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(lines, x + labelW + pad, y + 5.5);
  return y + h;
}

function twoColRow(doc, left, right, x, y, w) {
  const gap = 3;
  const half = (w - gap) / 2;
  const y1 = fieldRow(doc, left.label, left.value, x, y, half);
  const y2 = fieldRow(doc, right.label, right.value, x + half + gap, y, half);
  return Math.max(y1, y2);
}

/**
 * Download a professional pre-filled Cancel Chit penalty form.
 */
export async function downloadCancelChitPdf({ planPurchase, form }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const formNo = `CC-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Date.now()).slice(-5)}`;

  drawPageFrame(doc, pageW, pageH);

  // —— Letterhead (exact brand logo, scaled only) ——
  const logoAspect = 1024 / 576;
  const logoW = 44;
  const logoH = logoW / logoAspect;
  let y = 14;
  try {
    const logo = await getLogoDataUrl();
    doc.addImage(logo, 'PNG', margin, y, logoW, logoH);
  } catch {
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...MAROON);
    doc.text('SRI KALYANI JEWELLERY', margin, y + 10);
  }

  // Right side doc meta (aligned with logo block)
  const metaY = y + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MAROON);
  doc.text('FORM NO.', pageW - margin, metaY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(formNo, pageW - margin, metaY + 5, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), pageW - margin, metaY + 10, { align: 'right' });
  doc.text('Official Admin Document', pageW - margin, metaY + 15, { align: 'right' });

  y = Math.max(y + logoH + 3, metaY + 18);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.35);
  doc.line(margin, y + 1.6, pageW - margin, y + 1.6);

  // —— Title banner ——
  y += 5;
  doc.setFillColor(...MAROON);
  doc.roundedRect(margin, y, contentW, 12, 1.5, 1.5, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin + 1.2, y + 1.2, contentW - 2.4, 9.6, 1, 1, 'S');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(12);
  doc.text('CANCEL CHIT  —  PENALTY FORM', pageW / 2, y + 5.8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(255, 230, 238);
  doc.text('Pre-filled for wet-ink signature  ·  Upload signed copy to complete cancellation', pageW / 2, y + 9.8, { align: 'center' });

  y += 16;
  const planName = planPurchase?.planName || planPurchase?.plan || '—';
  const cusId = planPurchase?.cusId || planPurchase?.customerId || '—';
  const customerName = form?.cancelName || planPurchase?.customerName || planPurchase?.name || '—';

  y = sectionHeading(doc, 'A. Plan & Enrolment Details', margin, y, contentW);
  y = twoColRow(
    doc,
    { label: 'Customer Name', value: customerName },
    { label: 'Customer ID', value: cusId },
    margin,
    y,
    contentW
  );
  y = twoColRow(
    doc,
    { label: 'Plan Name', value: planName },
    { label: 'Plan Status', value: planPurchase?.status || '—' },
    margin,
    y,
    contentW
  );
  y = twoColRow(
    doc,
    { label: 'Scheme Amount', value: money(planPurchase?.amount) },
    { label: 'Mobile', value: planPurchase?.mobile || '—' },
    margin,
    y,
    contentW
  );

  y += 4;
  y = sectionHeading(doc, 'B. Cancellation Particulars', margin, y, contentW);
  y = fieldRow(doc, 'Location', form?.cancelLocation, margin, y, contentW);
  y = fieldRow(doc, 'Address', form?.cancelAddress, margin, y, contentW, { minH: 10 });

  const reasonText = String(form?.cancelReason || '').trim();
  if (reasonText) {
    y = fieldRow(doc, 'Reason', reasonText, margin, y, contentW, { minH: 12 });
  } else {
    const reasonH = 18;
    doc.setDrawColor(...LINE);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentW, reasonH, 'FD');
    doc.setFillColor(...CREAM);
    doc.rect(margin, y, 48, reasonH, 'F');
    doc.setDrawColor(...LINE);
    doc.line(margin + 48, y, margin + 48, y + reasonH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('REASON', margin + 2.2, y + 5);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.25);
    doc.line(margin + 52, y + 8, margin + contentW - 4, y + 8);
    doc.line(margin + 52, y + 13.5, margin + contentW - 4, y + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MUTED);
    doc.text('(Write by hand if not filled above)', margin + 52, y + 17);
    y += reasonH;
  }

  y = twoColRow(
    doc,
    { label: 'Months Paid', value: form?.monthsPaid ?? '—' },
    { label: 'Penalty Amount', value: money(form?.penaltyAmount) },
    margin,
    y,
    contentW
  );

  // —— Declaration ——
  y += 4;
  y = sectionHeading(doc, 'C. Declaration', margin, y, contentW);
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...LINE);
  doc.rect(margin, y, contentW, 18, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  const declaration =
    'I / We hereby request cancellation of the above chit / savings plan and agree to the penalty amount stated herein. ' +
    'I confirm that the particulars filled above are true and correct. Upon signing, this form authorises Sri Kalyani Jewellery ' +
    'to close the plan as per company policy. The signed original / scanned copy shall be retained for records.';
  doc.text(doc.splitTextToSize(declaration, contentW - 6), margin + 3, y + 4.5);
  y += 22;

  // Fixed bottom band: signatures → next steps → footer (no overlap)
  const footerTop = pageH - 18;
  const stepsBoxH = 18;
  const stepsY = footerTop - stepsBoxH - 3;
  const boxH = 40;
  const sigTop = stepsY - 6 - boxH;
  const gap = 8;
  const boxW = (contentW - gap) / 2;

  // Section D heading sits just above the signature boxes
  sectionHeading(doc, 'D. Signatures (Wet Ink)', margin, Math.min(y, sigTop - 10), contentW);

  const drawSig = (title, role, x) => {
    doc.setDrawColor(...MAROON);
    doc.setLineWidth(0.45);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, sigTop, boxW, boxH, 1.5, 1.5, 'FD');

    doc.setFillColor(...MAROON);
    doc.rect(x, sigTop, boxW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(title, x + boxW / 2, sigTop + 5.4, { align: 'center' });

    // Clear empty signing area
    doc.setDrawColor(230, 220, 224);
    doc.setLineWidth(0.2);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(x + 3, sigTop + 11, boxW - 6, 16, 1, 1, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(175, 175, 175);
    doc.text('Sign here', x + boxW / 2, sigTop + 20.5, { align: 'center' });

    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.35);
    doc.line(x + 6, sigTop + boxH - 10, x + boxW - 6, sigTop + boxH - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(`Name / ${role}`, x + 6, sigTop + boxH - 5.5);
    doc.text('Date: ____/____/________', x + boxW - 6, sigTop + boxH - 5.5, { align: 'right' });
  };

  drawSig('AUTHORITY', 'Authorised Signatory', margin);
  drawSig('CUSTOMER', 'Account Holder', margin + boxW + gap);

  // NEXT STEPS — always below signature boxes
  doc.setFillColor(250, 245, 247);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, stepsY, contentW, stepsBoxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MAROON);
  doc.text('NEXT STEPS', margin + 4, stepsY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('1) Print this form', margin + 4, stepsY + 13);
  doc.text('2) Get wet-ink signatures', margin + 40, stepsY + 13);
  doc.text('3) Scan / photo signed form', margin + 88, stepsY + 13);
  doc.text('4) Upload in admin to complete', margin + 140, stepsY + 13);

  // Footer
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(margin, footerTop, pageW - margin, footerTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Sri Kalyani Jewellery  ·  Cancel Chit Penalty Form  ·  For office use only', margin, footerTop + 4.5);
  doc.text(`Generated ${now.toLocaleString('en-IN')}`, pageW - margin, footerTop + 4.5, { align: 'right' });

  const safeName = String(customerName)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 40);
  doc.save(`Cancel_Chit_${safeName}_${formNo}.pdf`);
}
