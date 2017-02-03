declare function generateFieldLookup(keys: any): any;

declare type Visitor<T> = (field: string, value: T, context: Record<T>) => void;

declare class Record<T> {
  keys: string[];
  length: number;
  _fields: string[];

  constructor(keys: string[], fields: string[], fieldLookup: { [index: string]: string });

  forEach(visitor: Visitor<T>): void;
  toObject(): Partial<T>;
  get<K extends any>(key: number): K;
  get<K extends keyof T>(key: K): T[K];
  has(key: string | number): boolean;
}

export default Record;
