import commonSkippedTests from './common.js'
import browserSkippedTests from './browser.js'
import rxSessionSkippedTests from './rx.js'
import denoSkippedTests from './deno.js'

const skippedTestsByContext = new Map([
  ['browser', browserSkippedTests],
  ['rx', rxSessionSkippedTests],
  ['deno', denoSkippedTests]
])

export function getShouldRunTest (contexts) {
  const skippedTests = contexts
    .filter(context => skippedTestsByContext.has(context))
    .map(context => skippedTestsByContext.get(context))
    .reduce((previous, current) => [...previous, ...current], commonSkippedTests)

  return (testName, { onRun, onSkip }) => {
    const { reason } =
      skippedTests.find(({ predicate }) => predicate(testName)) || {}
    !reason ? onRun() : onSkip(reason)
  }
}
