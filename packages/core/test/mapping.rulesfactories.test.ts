import { Date, DateTime, Duration, int, Integer, LocalDateTime, LocalTime, Point, Time, uuid, Vector } from '../src'
import { rule } from '../src/mapping.rulesfactories'

describe('Rulesfactories', () => {
  it.each([
    ['Number', rule.asNumber(), 1, 1],
    ['String', rule.asString(), 'hi', 'hi'],
    ['BigInt', rule.asBigInt(), BigInt(1), BigInt(1)],
    ['Integer', rule.asInteger(), Integer.fromValue(1), Integer.fromValue(1)],
    ['Point', rule.asPoint(), new Point(0, 1, 1), new Point(0, 1, 1)],
    ['Duration', rule.asDuration(), new Duration(1, 1, 1, 1), new Duration(1, 1, 1, 1)],
    ['LocalTime', rule.asLocalTime(), new LocalTime(1, 1, 1, 1), new LocalTime(1, 1, 1, 1)],
    ['Time', rule.asTime(), new Time(1, 1, 1, 1, 1), new Time(1, 1, 1, 1, 1)],
    ['Date', rule.asDate(), new Date(1, 1, 1), new Date(1, 1, 1)],
    ['LocalDateTime', rule.asLocalDateTime(), new LocalDateTime(1, 1, 1, 1, 1, 1, 1), new LocalDateTime(1, 1, 1, 1, 1, 1, 1)],
    ['DateTime', rule.asDateTime(), new DateTime(1, 1, 1, 1, 1, 1, 1, 1), new DateTime(1, 1, 1, 1, 1, 1, 1, 1)],
    ['Simple List', rule.asList({ apply: rule.asString() }), ['hello'], ['hello']],
    [
      'Complex List',
      rule.asList({ apply: rule.asVector({ asTypedList: true }) }),
      [Float32Array.from([0.1, 0.2]), Float32Array.from([0.3, 0.4]), Float32Array.from([0.5, 0.6])],
      [new Vector(Float32Array.from([0.1, 0.2])), new Vector(Float32Array.from([0.3, 0.4])), new Vector(Float32Array.from([0.5, 0.6]))]
    ],
    [
      'Vector',
      rule.asVector(),
      new Vector(Int32Array.from([0, 1, 2])),
      new Vector(Int32Array.from([0, 1, 2]))
    ],
    [
      'Converted Vector',
      rule.asVector({ asTypedList: true, from: 'vec' }),
      Float32Array.from([0.1, 0.2]),
      new Vector(Float32Array.from([0.1, 0.2]))
    ],
    [
      'Object with nested rules',
      rule.asObject({ date: rule.asDate({ stringify: true }), vec: rule.asVector({ asTypedList: true, from: 'vector' }) }),
      {
        date: '2024-01-12',
        vec: Int16Array.from([4, 8])
      },
      {
        date: new Date(int(2024), int(1), int(12)),
        vector: new Vector(Int16Array.from([4, 8]))
      }
    ],
    ['UUID', rule.asUUID(), uuid('12345678-1234-1234-1234-123456789abc'), uuid('12345678-1234-1234-1234-123456789abc')],
    ['Stringified UUID', rule.asUUID({ stringify: true }), '12345678-1234-1234-1234-123456789abc', uuid('12345678-1234-1234-1234-123456789abc')]
  ])('should be able to map %s as property', (_, rule, param, expected) => {
    if (rule.parameterConversion != null) {
      param = rule.parameterConversion(param)
    }
    // @ts-expect-error
    rule.validate(param)
    expect(param).toEqual(expected)
  })

  it.each([
    ['Date', rule.asDate({ stringify: true }), '2024-01-12'],
    ['DateTime', rule.asDateTime({ stringify: true }), '2024-01-01T01:01:01-10:23:03'],
    ['Duration', rule.asDuration({ stringify: true }), 'PT1H'],
    ['Time', rule.asTime({ stringify: true }), '10:10:10Z'],
    ['Simple List', rule.asList({ apply: rule.asString() }), ['hello']],
    [
      'Complex List',
      rule.asList({ apply: rule.asVector({ asTypedList: true }) }),
      [Float32Array.from([0.1, 0.2]), Float32Array.from([0.3, 0.4]), Float32Array.from([0.5, 0.6])]
    ],
    [
      'Converted Vector',
      rule.asVector({ asTypedList: true }),
      Float32Array.from([0.1, 0.2])
    ],
    [
      'Object with nested rules',
      rule.asObject({ date: rule.asDate({ stringify: true }), vec: rule.asVector({ asTypedList: true }) }),
      {
        date: '2024-01-12',
        vec: Int16Array.from([4, 8])
      }
    ],
    [
      'Integer-mapped Number',
      rule.asNumber({ isInteger: true }),
      1
    ],
    ['Stringified UUID', rule.asUUID({ stringify: true }), '12345678-1234-1234-1234-123456789abc']
  ])('mapping %s as property and back should be lossless', (_, rule, param) => {
    if (rule.parameterConversion != null && rule.convert != null) {
      expect(rule.convert(rule.parameterConversion(param), 'test conversion')).toEqual(param)
    } else {
      throw new Error('rule lacks parameterConversion and/or convert')
    }
  })
})
