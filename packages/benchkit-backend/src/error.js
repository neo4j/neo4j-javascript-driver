import { StatusCodes } from 'http-status-codes'

export class BadRequestError extends Error {
  constructor (message) {
    super(message)
    this.statusCode = StatusCodes.BAD_REQUEST
  }
}
