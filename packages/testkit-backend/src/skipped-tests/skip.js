
function asComposablePredicate (predicate) {
  return new Proxy(predicate, {
    get: (target, p) => {
      if (p === 'and') {
        return otherPredicate => asComposablePredicate(testName => target(testName) && otherPredicate(testName))
      } else if (p === 'or') {
        return otherPredicate => asComposablePredicate(testName => target(testName) || otherPredicate(testName))
      }
      return target[p]
    }
  })
}

export function ifEndsWith (suffix) {
  return asComposablePredicate(testName => testName.endsWith(suffix))
}

export function ifStartsWith (prefix) {
  return asComposablePredicate(testName => testName.startsWith(prefix))
}

export function ifEquals (expectedName) {
  return asComposablePredicate(testName => testName === expectedName)
}

export function or () {
  return asComposablePredicate(testName => [...arguments].find(predicate => predicate(testName)))
}

export function skip (reason, ...predicate) {
  return { reason, predicate: or(...predicate) }
}

export const endsWith = ifEndsWith
export const startsWith = ifStartsWith

export default skip
