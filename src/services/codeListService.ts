import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy
} from 'firebase/firestore';

export interface CodeListItem {
  id: string;
  code: string;
  verboseName: string;
  type: string;
  object: string;
  sortOrder?: number;
}

const COLL = 'codeLists';

/**
 * Fetch all items of a given type+object, ordered by sortOrder
 */
export const listCodeList = async (
  type: string,
  object: string
): Promise<CodeListItem[]> => {
  const q = query(
    collection(db, COLL),
    where('type', '==', type),
    where('object', '==', object),
    orderBy('sortOrder', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
};

/**
 * Add a new code list item
 */
export const addCodeListItem = async (
  payload: Omit<CodeListItem, 'id'>
): Promise<void> => {
  await addDoc(collection(db, COLL), payload);
};

/**
 * Delete a code list item by ID
 */
export const deleteCodeListItem = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, COLL, id));
};

/**
 * Get a single code list item by object, type, and code
 * Returns the item with sortOrder and verboseName, or null if not found
 */
export const getCodeListByCode = async (
  object: string,
  type: string,
  code: string
): Promise<CodeListItem | null> => {
  const q = query(
    collection(db, COLL),
    where('object', '==', object),
    where('type', '==', type),
    where('code', '==', code)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
};

/**
 * Get a single code list item by object, type, and sortOrder
 * Returns the item with code and verboseName, or null if not found
 */
export const getCodeListBySortOrder = async (
  object: string,
  type: string,
  sortOrder: number
): Promise<CodeListItem | null> => {
  const q = query(
    collection(db, COLL),
    where('object', '==', object),
    where('type', '==', type),
    where('sortOrder', '==', sortOrder)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
};

/**
 * Get verbose name for a code list item by object, type, and code
 * Returns the verboseName string, or a fallback if not found
 */
export const getVerboseName = async (
  object: string,
  type: string,
  code: string,
  fallback: string = code
): Promise<string> => {
  const item = await getCodeListByCode(object, type, code);
  return item?.verboseName || fallback;
};
