import { newError } from "./error";

declare function generateFieldLookup( keys: any ): any;

declare class Record {
  constructor(keys: Object, fields: Object, fieldLookup: Object)

  forEach( visitor ): void;

  toObject(): Object;

  get( key: string | number ): any;

  has( key: string | number ): boolean;
}

export default Record;
