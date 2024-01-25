import { BadRequestError } from './error'

export async function validate (workload) {
  workload.method = workload.method || 'executeQuery'
  if (workload.queries == null || workload.queries.length === 0) {
    throw new BadRequestError('workload.queries should be a list with at least 1 item.')
  }

  workload.mode = workload.mode || 'sequentialSessions'

  if ((workload.mode === 'sequentialTransactions' && workload.method === 'executeQuery') ||
    (workload.mode === 'sequentialQueries' && (workload.method === 'executeQuery' || workload.method === 'sessionRun'))) {
    throw new BadRequestError(`workload.mode="${workload.mode}" can not be used with workload.method="${workload.method}"`)
  }

  return workload
}
