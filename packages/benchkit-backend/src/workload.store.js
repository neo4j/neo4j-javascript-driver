import { BadRequestError } from './error'

export default function WorkloadStore () {
  let index = 0
  const map = new Map()

  return {
    create (workload) {
      const key = index.toString()
      index++
      map.set(key, workload)
      return key
    },
    patchValidated (key, patch, validate) {
      if (!map.has(key)) {
        throw new BadRequestError(`workload ${key} doesn't exist.`)
      }

      const patched = {
        ...map.get(key),
        ...patch
      }

      return validate(patched).then(p => {
        map.set(key, patched)
      })
    },
    get (key) {
      if (!map.has(key)) {
        throw new BadRequestError(`workload ${key} doesn't exist.`)
      }

      return map.get(key)
    },
    delete (key) {
      map.delete(key)
    }
  }
}
