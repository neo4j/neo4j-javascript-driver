declare function generateFieldLookup(keys: any): any;

declare type Visitor<T> = (field: string, value: T, context: Record<T>) => void;

declare class Record<T> {
  keys: string[];
  length: number;
  _fields: T[];

  constructor(keys: string[], fields: string[], fieldLookup: { [index: string]: string });

  forEach(visitor: Visitor<T>): void;
  toObject(): Partial<{ [ret: string]: T>;
  get<K extends T>(key: string | number): K;
  has(key: string | number): boolean;
}

export default Record;
