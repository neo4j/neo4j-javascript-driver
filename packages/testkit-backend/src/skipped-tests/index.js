import commonSkippedTests from './common'
import browserSkippedTests from './browser'
import rxSessionSkippedTests from './rx'

const skippedTestsByContext = new Map([
  ['browser', browserSkippedTests],
  ['rx', rxSessionSkippedTests],
])

export function getShouldRunTest (contexts) {
  const skippedTests = contexts
    .filter(context => skippedTestsByContext.has(context))
    .map(context => skippedTestsByContext.get(context))
    .reduce((previous, current) => [ ...previous, ...current ], commonSkippedTests)

  return (testName, { onRun, onSkip }) => {
    const { reason } =
      skippedTests.find(({ predicate }) => predicate(testName)) || {}
    !reason ? onRun() : onSkip(reason)
  }
}
