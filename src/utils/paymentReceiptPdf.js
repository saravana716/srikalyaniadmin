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

function parseAmount(value) {
  if (value == null || value === '' || value === '—') return null;
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function money(value) {
  const n = parseAmount(value);
  if (n == null) return '—';
  return `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function text(value) {
  if (value == null || value === '') return '—';
  return String(value);
}

function drawFrame(doc, pageW, pageH) {
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(1.0);
  doc.rect(10, 10, pageW - 20, pageH - 20);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.rect(12, 12, pageW - 24, pageH - 24);
}

function row(doc, label, value, x, y, w) {
  const labelW = 48;
  const pad = 2.4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(text(value), w - labelW - pad * 2);
  const h = Math.max(10, pad * 2 + lines.length * 4.4);

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
  doc.text(String(label).toUpperCase(), x + 2.5, y + 6.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(lines, x + labelW + pad, y + 6.2);
  return y + h;
}

/**
 * Download a professional payment receipt PDF for one payment record.
 */
export async function downloadPaymentReceipt(payment) {
  if (!payment) throw new Error('Payment not found');

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const now = new Date();
  const receiptNo = `RCP-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(payment.id || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()}`;

  drawFrame(doc, pageW, pageH);

  // Letterhead logo (exact brand logo, scaled only)
  const logoAspect = 1024 / 576;
  const logoW = 48;
  const logoH = logoW / logoAspect;
  let y = 18;
  try {
    const logo = await getLogoDataUrl();
    doc.addImage(logo, 'PNG', (pageW - logoW) / 2, y, logoW, logoH);
  } catch {
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...MAROON);
    doc.text('SRI KALYANI JEWELLERY', pageW / 2, y + 12, { align: 'center' });
  }
  y += logoH + 6;

  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageW - margin, y);
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 1.5, pageW - margin, y + 1.5);
  y += 8;

  // Receipt title banner
  doc.setFillColor(...MAROON);
  doc.roundedRect(margin, y, contentW, 16, 1.5, 1.5, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin + 1.5, y + 1.5, contentW - 3, 13, 1, 1, 'S');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('PAYMENT RECEIPT', pageW / 2, y + 7, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 230, 238);
  doc.text('Official receipt for payment received', pageW / 2, y + 12.2, { align: 'center' });
  y += 22;

  // Meta strip
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, y, contentW, 16, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('RECEIPT NO.', margin + 4, y + 5.5);
  doc.text('DATE', margin + contentW / 2, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(receiptNo, margin + 4, y + 11.5);
  doc.text(
    now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    margin + contentW / 2,
    y + 11.5
  );
  y += 22;

  // Customer / payment details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...MAROON);
  doc.text('CUSTOMER & PAYMENT DETAILS', margin, y);
  y += 3;
  doc.setDrawColor(...MAROON);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + contentW, y);
  y += 4;

  y = row(doc, 'Customer', payment.customerName, margin, y, contentW);
  y = row(doc, 'Customer ID', payment.cusId, margin, y, contentW);
  y = row(doc, 'Plan', payment.chitPlan, margin, y, contentW);
  y = row(doc, 'Source', payment.sourceLabel || payment.source, margin, y, contentW);
  y = row(doc, 'Mode', payment.mode, margin, y, contentW);
  y = row(doc, 'Status', payment.status === 'Paid' ? 'Completed' : payment.status, margin, y, contentW);
  y = row(doc, 'Due Date', payment.dueDate, margin, y, contentW);
  y = row(doc, 'Paid Date', payment.paidDate || payment.dueDate, margin, y, contentW);
  if (payment.note) {
    y = row(doc, 'Note', payment.note, margin, y, contentW);
  }
  y += 8;

  // Amount highlight box
  doc.setFillColor(...MAROON);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'F');
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin + 1.5, y + 1.5, contentW - 3, 25, 1.5, 1.5, 'S');

  doc.setTextColor(255, 230, 238);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('AMOUNT PAID', pageW / 2, y + 9, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(money(payment.paidAmount), pageW / 2, y + 20, { align: 'center' });
  y += 36;

  if (payment.dueAmount != null && payment.dueAmount !== '' && payment.dueAmount !== payment.paidAmount) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Due Amount: ${money(payment.dueAmount)}`, pageW / 2, y, { align: 'center' });
    y += 8;
  }

  // Acknowledgement
  const footerTop = pageH - 22;
  doc.setFillColor(...CREAM);
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, y, contentW, 22, 1, 1, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MAROON);
  doc.text('ACKNOWLEDGEMENT', margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const ack =
    'We acknowledge receipt of the above amount towards the chit / savings plan stated on this receipt. ' +
    'This document is system-generated by Sri Kalyani Jewellery and is valid for customer reference.';
  doc.text(doc.splitTextToSize(ack, contentW - 8), margin + 4, y + 11);

  // Footer only (no signature section)
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(margin, footerTop, pageW - margin, footerTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Sri Kalyani Jewellery  ·  Payment Receipt  ·  Thank you', margin, footerTop + 5);
  doc.text(`Generated ${now.toLocaleString('en-IN')}`, pageW - margin, footerTop + 5, { align: 'right' });

  const safeName = text(payment.customerName || 'customer')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 30);
  doc.save(`Payment_Receipt_${safeName}_${receiptNo}.pdf`);
}
