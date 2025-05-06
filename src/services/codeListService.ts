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
