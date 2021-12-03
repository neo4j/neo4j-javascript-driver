import commonSkippedTests from './common'
import browserSkippedTests from './browser'

const skippedTestsByContext = new Map([
  ['browser', browserSkippedTests]
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
