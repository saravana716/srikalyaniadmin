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
