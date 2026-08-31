export interface EncapsulatedKeyRepository {
  findById: (id: string) => Promise<EncapsulatedKey>

  findByAlias: (alias: string) => Promise<EncapsulatedKey>

  save: (alias: string, encapsulation: Int8Array, metadata: Record<string, string>) => Promise<EncapsulatedKey>

  addAliasById: (id: string, alias: string) => Promise<void>

  deleteAliasById: (id: string, alias: string) => Promise<void>

  deleteById: (id: string) => Promise<void>
}

export interface EncapsulatedKey {
  id: () => string

  alias: () => string | undefined

  encapsulation: () => Int8Array

  metadata: () => Record<string, string>
}
