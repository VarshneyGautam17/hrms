// A minimal in-memory stand-in for the handful of modular `firebase/firestore`
// functions this app actually uses. It exists so the repository/service tests
// keep running fully offline, without a Java-based Firestore emulator.

type DocData = Record<string, unknown>;

interface Ref {
  __type: 'collection' | 'doc';
  path: string;
}

interface WhereConstraint {
  type: 'where';
  field: string;
  op: '==' | '>=' | '<=';
  value: unknown;
}
interface OrderByConstraint {
  type: 'orderBy';
  field: string;
  dir: 'asc' | 'desc';
}
type Constraint = WhereConstraint | OrderByConstraint;

interface QueryRef extends Ref {
  constraints?: Constraint[];
}

const store = new Map<string, DocData>();
const pathListeners = new Map<string, Set<() => void>>();

function notifyPath(path: string) {
  for (const [key, set] of pathListeners) {
    if (key === path || path.startsWith(`${key}/`) || key.startsWith(`${path}/`)) {
      set.forEach((fn) => fn());
    }
  }
}

function docsUnder(collectionPath: string): DocData[] {
  const prefix = `${collectionPath}/`;
  const result: DocData[] = [];
  for (const [key, value] of store) {
    if (key.startsWith(prefix) && !key.slice(prefix.length).includes('/')) {
      result.push(value);
    }
  }
  return result;
}

function applyConstraints(docsData: DocData[], constraints: Constraint[] = []): DocData[] {
  let result = docsData;
  for (const c of constraints) {
    if (c.type === 'where') {
      result = result.filter((d) => {
        const v = d[c.field] as never;
        if (c.op === '==') return v === c.value;
        if (c.op === '>=') return v >= (c.value as never);
        if (c.op === '<=') return v <= (c.value as never);
        return true;
      });
    }
  }
  const orderC = constraints.find((c): c is OrderByConstraint => c.type === 'orderBy');
  if (orderC) {
    result = [...result].sort((a, b) => {
      const av = a[orderC.field] as never;
      const bv = b[orderC.field] as never;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return orderC.dir === 'desc' ? -cmp : cmp;
    });
  }
  return result;
}

export function initializeFirestore(_app: unknown, _settings?: unknown) {
  return {};
}
export function getFirestore(_app?: unknown) {
  return {};
}
export function persistentLocalCache(_settings?: unknown) {
  return {};
}
export function persistentMultipleTabManager() {
  return {};
}

export function collection(_db: unknown, ...segments: string[]): Ref {
  return { __type: 'collection', path: segments.join('/') };
}

export function doc(parent: Ref, id: string): Ref {
  return { __type: 'doc', path: `${parent.path}/${id}` };
}

export function where(field: string, op: '==' | '>=' | '<=', value: unknown): WhereConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return { type: 'orderBy', field, dir };
}

export function query(ref: Ref, ...constraints: Constraint[]): QueryRef {
  return { ...ref, constraints: [...(('constraints' in ref ? (ref as QueryRef).constraints : undefined) ?? []), ...constraints] };
}

export async function getDoc(ref: Ref) {
  const data = store.get(ref.path);
  return {
    exists: () => data !== undefined,
    data: () => data,
    id: ref.path.split('/').pop()!,
  };
}

export async function getDocs(ref: QueryRef) {
  const matched = applyConstraints(docsUnder(ref.path), ref.constraints);
  return { docs: matched.map((data) => ({ data: () => data, id: (data.id as string) ?? '' })) };
}

export async function setDoc(ref: Ref, data: DocData) {
  store.set(ref.path, { ...data });
  notifyPath(ref.path);
}

export async function updateDoc(ref: Ref, changes: DocData) {
  const existing = store.get(ref.path) ?? {};
  store.set(ref.path, { ...existing, ...changes });
  notifyPath(ref.path);
}

export async function deleteDoc(ref: Ref) {
  store.delete(ref.path);
  notifyPath(ref.path);
}

export function onSnapshot(ref: QueryRef, callback: (snap: unknown) => void) {
  function fire() {
    if (ref.__type === 'doc') {
      const data = store.get(ref.path);
      callback({ exists: () => data !== undefined, data: () => data, id: ref.path.split('/').pop()! });
    } else {
      const matched = applyConstraints(docsUnder(ref.path), ref.constraints);
      callback({ docs: matched.map((data) => ({ data: () => data, id: (data.id as string) ?? '' })) });
    }
  }
  if (!pathListeners.has(ref.path)) pathListeners.set(ref.path, new Set());
  pathListeners.get(ref.path)!.add(fire);
  queueMicrotask(fire);
  return () => pathListeners.get(ref.path)?.delete(fire);
}

export function writeBatch(_db: unknown) {
  const ops: (() => void)[] = [];
  return {
    set(ref: Ref, data: DocData) {
      ops.push(() => store.set(ref.path, { ...data }));
    },
    delete(ref: Ref) {
      ops.push(() => store.delete(ref.path));
    },
    async commit() {
      for (const op of ops) op();
      for (const key of [...pathListeners.keys()]) notifyPath(key);
    },
  };
}

/** Test-only helpers. */
export function __resetFakeFirestore() {
  store.clear();
}
export function __dumpFakeFirestore() {
  return new Map(store);
}
