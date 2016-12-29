declare class RoundRobinArray {
  constructor( items: any )

  next(): any;

  push( elem: any ): any;

  pushAll( elem: any ): any;

  empty(): number;

  clear(): void;

  size(): number;

  toArray(): any[];

  remove( item: any ): any;
}

export default RoundRobinArray;
