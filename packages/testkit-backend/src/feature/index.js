import commonFeatures from './common.js'
import rxFeatures from './rx.js'
import asyncFeatures from './async.js'

const featuresByContext = new Map([
  ['async', asyncFeatures],
  ['rx', rxFeatures]
])

export function createGetFeatures (contexts) {
  const features = contexts
    .filter(context => featuresByContext.has(context))
    .map(context => featuresByContext.get(context))
    .reduce((previous, current) => [...previous, ...current], commonFeatures)

  return () => features
}
