import commonFeatures from './common'
import rxFeatures from './rx'
import asyncFeatures from './async'

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
