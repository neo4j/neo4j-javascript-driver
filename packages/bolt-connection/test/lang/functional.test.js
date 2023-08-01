import { reuseOngoingRequest } from '../../src/lang/functional.js'

describe('functional', () => {
  describe('reuseOnGoingRequest', () => {
    it('should call supplied function with the params', async () => {
      const expectedParams = ['a', 1, { a: 'a' }]
      const func = jest.fn(() => Promise.resolve())

      const decoratedFunction = reuseOngoingRequest(func)
      await decoratedFunction(...expectedParams)

      expect(func).toHaveBeenCalledWith(...expectedParams)
    })

    it('should call supplied function with this', async () => {
      const expectedParams = ['a', 1, { a: 'a' }]
      const thisArg = { t: 'his' }
      const func = jest.fn(async function () {
        return thisArg
      })

      const decoratedFunction = reuseOngoingRequest(func, thisArg)
      const receivedThis = await decoratedFunction(...expectedParams)

      expect(receivedThis).toBe(thisArg)
    })

    it('should values return by the supplied function', async () => {
      const expectedResult = { a: 'abc' }
      const func = jest.fn(() => Promise.resolve(expectedResult))

      const decoratedFunction = reuseOngoingRequest(func)
      const result = await decoratedFunction()

      expect(result).toBe(expectedResult)
    })

    it('should throw value thrown by supplied function', async () => {
      const error = new Error('Ops, I did it!')
      const func = jest.fn(() => Promise.reject(error))

      const decoratedFunction = reuseOngoingRequest(func)
      const promise = decoratedFunction()
      expect(promise).rejects.toThrow(error)
    })

    it('should share ongoing request with same params', async () => {
      const expectedParams = ['a', 1, [3]]
      const expectedResult = { a: 'abc' }
      const { promises, func } = mockPromiseFunction()

      const decoratedFunction = reuseOngoingRequest(func)

      const resultPromises = [
        decoratedFunction(...expectedParams),
        decoratedFunction(...expectedParams),
        decoratedFunction(...expectedParams)
      ]

      expect(func).toBeCalledTimes(1)
      expect(promises.length).toBe(1)

      promises[0].resolve(expectedResult) // closing ongoing request

      const results = await Promise.all(resultPromises)

      expect(results).toEqual([expectedResult, expectedResult, expectedResult])
    })

    it('should not share ongoing request with different params', async () => {
      const expectedParams1 = ['a', 1, [3]]
      const expectedResult1 = { a: 'abc' }
      const expectedParams2 = [4, 'a', []]
      const expectedResult2 = { k: 'bbk' }
      const { promises, func } = mockPromiseFunction()

      const decoratedFunction = reuseOngoingRequest(func)

      const resultPromises = [
        decoratedFunction(...expectedParams1),
        decoratedFunction(...expectedParams2)
      ]

      expect(func).toBeCalledTimes(2)
      expect(func).toBeCalledWith(...expectedParams1)
      expect(func).toBeCalledWith(...expectedParams2)

      expect(promises.length).toBe(2)

      promises[0].resolve(expectedResult1) // closing ongoing request 1
      promises[1].resolve(expectedResult2) // closing ongoing request 2

      const results = await Promise.all(resultPromises)

      expect(results).toEqual([expectedResult1, expectedResult2])
    })

    it('should not share resolved requests with same params', async () => {
      const expectedParams = ['a', 1, [3]]
      const expectedResult1 = { a: 'abc' }
      const expectedResult2 = { k: 'bbk' }
      const { promises, func } = mockPromiseFunction()

      const decoratedFunction = reuseOngoingRequest(func)

      const resultPromises = [
        decoratedFunction(...expectedParams)
      ]

      expect(func).toBeCalledTimes(1)
      expect(promises.length).toBe(1)

      promises[0].resolve(expectedResult1) // closing ongoing request

      const results = await Promise.all(resultPromises)

      resultPromises.push(decoratedFunction(...expectedParams))

      expect(func).toBeCalledTimes(2)
      expect(promises.length).toBe(2)

      promises[1].resolve(expectedResult2) // closing ongoing request

      results.push(await resultPromises[1])

      expect(results).toEqual([expectedResult1, expectedResult2])
    })

    it('should not share rejected requests with same params', async () => {
      const expectedParams = ['a', 1, [3]]
      const expectedResult1 = new Error('Ops, I did it again!')
      const expectedResult2 = { k: 'bbk' }
      const { promises, func } = mockPromiseFunction()

      const decoratedFunction = reuseOngoingRequest(func)

      const resultPromises = [
        decoratedFunction(...expectedParams)
      ]

      expect(func).toBeCalledTimes(1)
      expect(promises.length).toBe(1)

      promises[0].reject(expectedResult1) // closing ongoing request

      const results = await Promise.all(
        resultPromises.map(promise => promise.catch(error => error))
      )

      resultPromises.push(decoratedFunction(...expectedParams))

      expect(func).toBeCalledTimes(2)
      expect(promises.length).toBe(2)

      promises[1].resolve(expectedResult2) // closing ongoing request

      results.push(await resultPromises[1])

      expect(results).toEqual([expectedResult1, expectedResult2])
    })

    function mockPromiseFunction () {
      const promises = []
      const func = jest.fn(() => new Promise((resolve, reject) => {
        promises.push({ resolve, reject })
      }))
      return { promises, func }
    }
  })
})
