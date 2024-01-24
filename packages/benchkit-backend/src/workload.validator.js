import { BadRequestError } from './error'

export async function validate (workload) {
  workload.method = workload.method || 'executeQuery'
  if (workload.queries == null || workload.queries.length === 0) {
    throw new BadRequestError('workload.queries should be a list with at least 1 item.')
  }

  if (workload.method === 'sessionRun' && workload.mode === 'parallel') {
    throw new BadRequestError('workload.mode="parallel" can not be used with workload.method="sessionRun"')
  }
  return workload
}
