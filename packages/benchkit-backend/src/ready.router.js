import { Router } from 'express'
import { StatusCodes } from 'http-status-codes'

export default function ReadyRouter (executeHealthCheck) {
  const router = Router()

  router.get('/', (_, res) => {
    executeHealthCheck()
      .then(() => res.status(StatusCodes.OK).end())
      .catch(error => {
        console.error(error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send(error.message)
          .end()
      })
  })

  return router
}
