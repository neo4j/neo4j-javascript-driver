import sinon from 'sinon'

export default class FakeTime {
  constructor (time) {
    this._clock = sinon.useFakeTimers(time || new Date().getTime())
  }

  tick (incrementMs) {
    this._clock.tick(incrementMs)
  }

  restore () {
    this._clock.restore()
  }
}
