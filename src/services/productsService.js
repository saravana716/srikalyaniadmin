import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadProductImage } from '../utils/uploadImage';

const COLLECTION = 'products';

async function resolveProductImages(data, productId) {
  const uploadKey = productId || `new_${Date.now()}`;
  const imagePayload = {};

  if (data.image1File) {
    imagePayload.image1 = await uploadProductImage(data.image1File, uploadKey, 'image1');
  } else if (data.image1) {
    imagePayload.image1 = data.image1;
  }

  if (data.image2File) {
    imagePayload.image2 = await uploadProductImage(data.image2File, uploadKey, 'image2');
  } else if (data.clearImage2) {
    imagePayload.image2 = '';
  } else if (data.image2) {
    imagePayload.image2 = data.image2;
  }

  if (data.image3File) {
    imagePayload.image3 = await uploadProductImage(data.image3File, uploadKey, 'image3');
  } else if (data.clearImage3) {
    imagePayload.image3 = '';
  } else if (data.image3) {
    imagePayload.image3 = data.image3;
  }

  return imagePayload;
}

export function subscribeProducts(setData) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => {
    console.error('products subscribe error', err);
    setData([]);
  });
}

export async function addProduct(data) {
  const uploadKey = `new_${Date.now()}`;
  const imagePayload = await resolveProductImages(data, uploadKey);

  const ref = await addDoc(collection(db, COLLECTION), {
    name: data.name,
    category: data.category || 'Gold',
    price: data.price || '',
    weight: data.weight || '',
    purity: data.purity || '',
    status: data.status || 'Active',
    description: data.description || '',
    ...imagePayload,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateProduct(id, data) {
  const imagePayload = await resolveProductImages(data, id);
  await updateDoc(doc(db, COLLECTION, id), {
    name: data.name,
    category: data.category || 'Gold',
    price: data.price || '',
    weight: data.weight || '',
    purity: data.purity || '',
    status: data.status || 'Active',
    description: data.description || '',
    ...imagePayload,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

