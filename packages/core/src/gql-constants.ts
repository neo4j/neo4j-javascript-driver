import { NumberOrInteger } from './graph-types'

/**
 * Class for the DiagnosticRecord in a {@link Neo4jError}, including commonly used fields.
 */
export interface DiagnosticRecord {
  OPERATION: string
  OPERATION_CODE: string
  CURRENT_SCHEMA: string
  _severity?: string
  _classification?: string
  _position?: {
    offset: NumberOrInteger
    line: NumberOrInteger
    column: NumberOrInteger
  }
  _status_parameters?: Record<string, unknown>
  [key: string]: unknown
}

export const rawPolyfilledDiagnosticRecord = {
  OPERATION: '',
  OPERATION_CODE: '0',
  CURRENT_SCHEMA: '/'
}

Object.freeze(rawPolyfilledDiagnosticRecord)
