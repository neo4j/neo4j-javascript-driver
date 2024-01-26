import { Router } from 'express'
import { validate } from './workload.validator'
import { StatusCodes } from 'http-status-codes'
import WorkloadStore from './workload.store'

export default function WorkloadRouter (executeWorkload, baseRoute) {
  const router = Router()
  const store = WorkloadStore()

  router.put('/', (req, res) => {
    validate(req.body)
      .then(executeWorkload)
      .then(() => res.status(StatusCodes.NO_CONTENT).end())
      .catch(ErrorHandler(res))
  })

  router.post('/', (req, res) => {
    validate(req.body)
      .then(store.create)
      .then(id => res
        .status(StatusCodes.CREATED)
        .location(`${baseRoute}/${id}`)
        .end())
      .catch(ErrorHandler(res))
  })

  router.get('/:id', (req, res) => {
    Promise.resolve(req.params.id)
      .then(store.get)
      .then(executeWorkload)
      .then(() => res.status(StatusCodes.NO_CONTENT).end())
      .catch(ErrorHandler(res))
  })

  router.patch('/:id', (req, res) => {
    Promise.resolve(req.params.id)
      .then(id => store.patchValidated(id, req.body, validate))
      .then(() => res.end())
      .catch(ErrorHandler(res))
  })

  router.delete('/:id', (req, res) => {
    Promise.resolve(req.params.id)
      .then(store.delete)
      .then(() => res.status(StatusCodes.NO_CONTENT).end())
      .catch(ErrorHandler(res))
  })

  function ErrorHandler (res) {
    return function (error) {
      res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
        .send(error.message)
        .end()
    }
  }

  return router
}
