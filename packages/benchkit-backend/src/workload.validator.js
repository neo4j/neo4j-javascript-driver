import { BadRequestError } from './error'

const EXPECTED_MODES = ['sequentialSessions', 'sequentialTransactions', 'sequentialQueries', 'parallelSessions']
const EXPECTED_METHODS = ['executeQuery', 'executeRead', 'executeWrite', 'sessionRun']

const EXPECTED_MODES_STR = JSON.stringify(EXPECTED_MODES)
const EXPECTED_METHODS_STR = JSON.stringify(EXPECTED_METHODS)

export async function validate (workload) {
  // Defaults
  workload.method = workload.method || 'executeQuery'
  workload.mode = workload.mode || 'sequentialSessions'
  workload.routing = workload.routing || 'write'

  // Validation
  if (workload.queries == null || workload.queries.length === 0) {
    throw new BadRequestError('workload.queries should be a list with at least 1 item.')
  }

  if (!EXPECTED_METHODS.includes(workload.method)) {
    throw new BadRequestError(`workload.method="${workload.method}" is not a valid value. Expected: ${EXPECTED_METHODS_STR}`)
  }

  if (!EXPECTED_MODES.includes(workload.mode)) {
    throw new BadRequestError(`workload.mode="${workload.mode}" is not a valid value. Expected: ${EXPECTED_MODES_STR}`)
  }

  if ((workload.mode === 'sequentialTransactions' && workload.method === 'executeQuery') ||
    (workload.mode === 'sequentialQueries' && (workload.method === 'executeQuery' || workload.method === 'sessionRun'))) {
    throw new BadRequestError(`workload.mode="${workload.mode}" cannot be used with workload.method="${workload.method}"`)
  }

  if (workload.routing !== 'read' && workload.routing !== 'write') {
    throw new BadRequestError(`workload.routing="${workload.routing}" but expected "read" or "write"`)
  }

  // Sanitization
  workload.routing = workload.routing.toUpperCase()

  return workload
}
