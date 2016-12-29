declare class Pool {
  constructor( create: Function,
    destroy: Function,
    validate: Function,
    maxIdle: number)
  aquire( key: string | number ): any;
  purge( key: string | number ): any;
  purgeAll(): void;
  has( key: string | number ): any;
}

export default Pool;
