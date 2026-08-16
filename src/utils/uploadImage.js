import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

const MAX_IMAGE_SIZE_MB = 5;

export function validateImageFile(file) {
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    return 'Please select a valid image file (JPG, PNG, etc.)';
  }
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `Image must be smaller than ${MAX_IMAGE_SIZE_MB}MB`;
  }
  return null;
}

export async function uploadProductImage(file, productKey, slot) {
  if (!file) return null;
  const error = validateImageFile(file);
  if (error) throw new Error(error);

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const path = `products/${productKey}/${slot}_${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

const MAX_CANCEL_FORM_MB = 10;
const CANCEL_FORM_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export function validateCancelFormFile(file) {
  if (!file) return 'Please select a signed form file (PDF or image).';
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const okType =
    CANCEL_FORM_TYPES.has(type) ||
    name.endsWith('.pdf') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp');
  if (!okType) return 'Upload a PDF or image (JPG / PNG) of the signed form.';
  if (file.size > MAX_CANCEL_FORM_MB * 1024 * 1024) {
    return `File must be smaller than ${MAX_CANCEL_FORM_MB}MB`;
  }
  return null;
}

export async function uploadCancelChitForm(file, planPurchaseId) {
  if (!file) return null;
  const error = validateCancelFormFile(file);
  if (error) throw new Error(error);

  const ext = file.name.includes('.') ? file.name.split('.').pop() : (file.type === 'application/pdf' ? 'pdf' : 'jpg');
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '') || 'pdf';
  const path = `cancelChitForms/${planPurchaseId || 'unknown'}/${Date.now()}.${safeExt}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
