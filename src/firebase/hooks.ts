import { useEffect, useState } from 'react';
import { onSnapshot, type Query, type DocumentReference, type DocumentData } from 'firebase/firestore';

/**
 * Subscribes to a Firestore query in real time. Returns `undefined` while
 * loading (and whenever `queryOrNull` is null), matching the loading
 * convention the rest of the app already uses. Every document's stored
 * `id` field (not Firestore's own doc id) is what the rest of the app reads.
 */
export function useCollection<T>(queryOrNull: Query<DocumentData> | null, deps: unknown[]): T[] | undefined {
  const [data, setData] = useState<T[] | undefined>(undefined);

  useEffect(() => {
    if (!queryOrNull) {
      setData(undefined);
      return;
    }
    setData(undefined);
    const unsubscribe = onSnapshot(queryOrNull, (snapshot) => {
      setData(snapshot.docs.map((d) => d.data() as T));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

/** Subscribes to a single Firestore document in real time. */
export function useDocument<T>(docRefOrNull: DocumentReference<DocumentData> | null, deps: unknown[]): T | undefined {
  const [data, setData] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (!docRefOrNull) {
      setData(undefined);
      return;
    }
    setData(undefined);
    const unsubscribe = onSnapshot(docRefOrNull, (snapshot) => {
      setData(snapshot.exists() ? (snapshot.data() as T) : undefined);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
