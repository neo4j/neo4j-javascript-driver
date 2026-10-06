import * as responses from './responses.js'

export function NewKeyRepository (context, wire) {
  return context.addEncapsulatedKeyRepository((repositoryId) => {
    return {
      findById: (keyId) => new Promise((resolve, reject) => {
        const id = context.addEncapsulatedKeyRepositoryFindByIdRequest(resolve, reject)
        console.log('F REPID: ', repositoryId)
        wire.writeResponse(responses.EncapsulatedKeyRepositoryFindByIdRequest({ id, repositoryId, keyId }))
      }),
      findByAlias: (alias) => new Promise((resolve, reject) => {
        const id = context.addEncapsulatedKeyRepositoryFindByAliasRequest(resolve, reject)
        wire.writeResponse(responses.EncapsulatedKeyRepositoryFindByAliasRequest({ id, repositoryId, alias }))
      }),
      create: (alias, encapsulation, metadata) => new Promise((resolve, reject) => {
        const id = context.addEncapsulatedKeyRepositoryCreateRequest(resolve, reject)
        wire.writeResponse(responses.EncapsulatedKeyRepositoryCreateRequest({ id, repositoryId, alias, encapsulation, metadata, context }))
      }),
      import: (keyId, alias, encapsulation, metadata) => new Promise((resolve, reject) => {
        const id = context.addEncapsulatedKeyRepositoryImportRequest(resolve, reject)
        wire.writeResponse(responses.EncapsulatedKeyRepositoryImportRequest({ id, repositoryId, keyId, alias, encapsulation, metadata, context }))
      })
    }
  })
}
