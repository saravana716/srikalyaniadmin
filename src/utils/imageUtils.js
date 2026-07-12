import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import app from '../firebase/config';

/**
 * Resolve image source from Firestore/mobile field value.
 * Supports http URLs, data URLs, and raw base64 strings.
 */
export function resolveImageSrc(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Raw base64 (common from mobile uploads)
  if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed) && trimmed.replace(/\s/g, '').length > 80) {
    const clean = trimmed.replace(/\s/g, '');
    return `data:image/jpeg;base64,${clean}`;
  }

  return trimmed;
}

const FRONT_IMAGE_KEYS = [
  'bankFrontUrl', 'bankFront', 'BankFront', 'BankFrontUrl',
  'proofFrontUrl', 'proofFront', 'ProofFront', 'ProofFrontUrl',
  'passbookFrontUrl', 'passbookFront', 'PassbookFront',
  'idFrontUrl', 'idFront', 'IdFront', 'frontImage', 'frontUrl',
];

const BACK_IMAGE_KEYS = [
  'bankBackUrl', 'bankBack', 'BankBack', 'BankBackUrl',
  'proofBackUrl', 'proofBack', 'ProofBack', 'ProofBackUrl',
  'passbookBackUrl', 'passbookBack', 'PassbookBack',
  'idBackUrl', 'idBack', 'IdBack', 'backImage', 'backUrl',
];

export function pickImageFromRow(row, keys) {
  if (!row) return null;
  for (const key of keys) {
    const src = resolveImageSrc(row[key]);
    if (src) return src;
  }
  return null;
}

export function getBankOrProofFrontUrl(row) {
  return pickImageFromRow(row, FRONT_IMAGE_KEYS);
}

export function getBankOrProofBackUrl(row) {
  return pickImageFromRow(row, BACK_IMAGE_KEYS);
}

/** Resolve storage path or URL to a displayable src (async). */
export async function resolveImageSrcAsync(value) {
  const direct = resolveImageSrc(value);
  if (!direct) return null;
  if (direct.startsWith('http://') || direct.startsWith('https://') || direct.startsWith('data:') || direct.startsWith('blob:')) {
    return direct;
  }
  try {
    const storage = getStorage(app);
    return await getDownloadURL(ref(storage, direct.replace(/^\//, '')));
  } catch {
    return direct;
  }
}
