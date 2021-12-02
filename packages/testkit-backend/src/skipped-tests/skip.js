export function ifEndsWith (suffix) {
  return testName => testName.endsWith(suffix)
}

export function ifStartsWith (prefix) {
  return testName => testName.startsWith(prefix)
}

export function ifEquals (expectedName) {
  return testName => testName === expectedName
}

export function or () {
  return testName => [...arguments].find(predicate => predicate(testName))
}

export function skip (reason, ...predicate) {
  return { reason, predicate: or(...predicate) }
}

export default skip
