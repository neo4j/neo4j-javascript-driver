import sinon from 'sinon'

export default class FakeTime {
  constructor (time) {
    this._clock = sinon.useFakeTimers({
      now: time || new Date().getTime(),
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'setImmediate', 'clearImmediate', 'hrtime', 'performance', 'queueMicrotask', 'Intl']
    })
  }

  tick (incrementMs) {
    this._clock.tick(incrementMs)
  }

  restore () {
    this._clock.restore()
  }
}
