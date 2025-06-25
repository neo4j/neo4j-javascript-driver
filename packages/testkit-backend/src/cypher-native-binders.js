const WGS_84_2D_CRS_CODE = BigInt(4326)
const CARTESIAN_2D_CRS_CODE = BigInt(7203)

const WGS_84_3D_CRS_CODE = BigInt(4979)
const CARTESIAN_3D_CRS_CODE = BigInt(9157)

export default function CypherNativeBinders (neo4j) {
  function valueResponse (name, value) {
    return { name, data: { value } }
  }
  function objectToCypher (obj) {
    return objectMapper(obj, nativeToCypher)
  }
  function objectToNative (obj) {
    return objectMapper(obj, cypherToNative)
  }

  function objectMemberBitIntToNumber (obj, recursive = false) {
    return objectMapper(obj, val => {
      if (typeof val === 'bigint') {
        return Number(val)
      } else if (recursive && typeof val === 'object') {
        return objectMemberBitIntToNumber(val)
      } else if (recursive && Array.isArray(val)) {
        return val.map(item => objectMemberBitIntToNumber(item, true))
      }
      return val
    })
  }

  function objectMapper (obj, mapper) {
    if (obj === null || obj === undefined) {
      return obj
    }
    return Object.keys(obj).reduce((acc, key) => {
      return { ...acc, [key]: mapper(obj[key]) }
    }, {})
  }

  function nativeToCypher (x) {
    if (x == null) {
      return valueResponse('CypherNull', null)
    }
    switch (typeof x) {
      case 'number':
        if (Number.isInteger(x)) {
          return valueResponse('CypherInt', x)
        }
        return valueResponse('CypherFloat', x)
      case 'bigint':
        return valueResponse('CypherInt', neo4j.int(x).toNumber())
      case 'string':
        return valueResponse('CypherString', x)
      case 'boolean':
        return valueResponse('CypherBool', x)
      case 'object':
        return valueResponseOfObject(x)
    }
    console.log(`type of ${x} is ${typeof x}`)
    const err = 'Unable to convert ' + x + ' to cypher type'
    console.log(err)
    throw Error(err)
  }

  function valueResponseOfObject (x) {
    if (neo4j.isInt(x)) {
      // TODO: Broken!!!
      return valueResponse('CypherInt', x.toInt())
    }
    if (Array.isArray(x)) {
      const values = x.map(nativeToCypher)
      return valueResponse('CypherList', values)
    }
    if (x instanceof neo4j.types.Node) {
      const node = {
        id: nativeToCypher(x.identity),
        labels: nativeToCypher(x.labels),
        props: nativeToCypher(x.properties),
        elementId: nativeToCypher(x.elementId)
      }
      return { name: 'CypherNode', data: node }
    }
    if (x instanceof neo4j.types.Relationship) {
      const relationship = {
        id: nativeToCypher(x.identity),
        startNodeId: nativeToCypher(x.start),
        endNodeId: nativeToCypher(x.end),
        type: nativeToCypher(x.type),
        props: nativeToCypher(x.properties),
        elementId: nativeToCypher(x.elementId),
        startNodeElementId: nativeToCypher(x.startNodeElementId),
        endNodeElementId: nativeToCypher(x.endNodeElementId)
      }
      return { name: 'CypherRelationship', data: relationship }
    }
    if (x instanceof neo4j.types.Path) {
      const path = x.segments
        .map(segment => {
          return {
            nodes: [segment.end],
            relationships: [segment.relationship]
          }
        })
        .reduce(
          (previous, current) => {
            return {
              nodes: [...previous.nodes, ...current.nodes],
              relationships: [
                ...previous.relationships,
                ...current.relationships
              ]
            }
          },
          { nodes: [x.start], relationships: [] }
        )

      return {
        name: 'CypherPath',
        data: {
          nodes: nativeToCypher(path.nodes),
          relationships: nativeToCypher(path.relationships)
        }
      }
    }

    if (neo4j.isDate(x)) {
      return structResponse('CypherDate', {
        year: x.year,
        month: x.month,
        day: x.day
      })
    }
    if (neo4j.isDateTime(x) || neo4j.isLocalDateTime(x)) {
      return structResponse('CypherDateTime', {
        year: x.year,
        month: x.month,
        day: x.day,
        hour: x.hour,
        minute: x.minute,
        second: x.second,
        nanosecond: x.nanosecond,
        utc_offset_s: x.timeZoneOffsetSeconds || (x.timeZoneId == null ? undefined : 0),
        timezone_id: x.timeZoneId
      })
    }
    if (neo4j.isTime(x) || neo4j.isLocalTime(x)) {
      return structResponse('CypherTime', {
        hour: x.hour,
        minute: x.minute,
        second: x.second,
        nanosecond: x.nanosecond,
        utc_offset_s: x.timeZoneOffsetSeconds
      })
    }
    if (neo4j.isDuration(x)) {
      return structResponse('CypherDuration', {
        months: x.months,
        days: x.days,
        seconds: x.seconds,
        nanoseconds: x.nanoseconds
      })
    }

    if (x instanceof neo4j.types.Point) {
      let system = 'unknown'
      if (x.srid === WGS_84_2D_CRS_CODE || x.srid === WGS_84_3D_CRS_CODE) {
        system = 'wgs84'
      } else if (x.srid === CARTESIAN_2D_CRS_CODE || x.srid === CARTESIAN_3D_CRS_CODE) {
        system = 'cartesian'
      }
      return structResponse('CypherPoint', {
        system,
        x: x.x,
        y: x.y,
        z: x.z == null ? undefined : x.z
      })
    }

    if (x.typedArray != null) {
      const isLittleEndian = checkLittleEndian()
      let dtype = ''
      const setview = new DataView(new ArrayBuffer(x.typedArray.byteLength))
      // we want exact byte accuracy, so we cannot simply get the valye from the typed array
      const getview = new DataView(x.typedArray.buffer)
      let get
      let set
      switch (x.type) {
        case 'INT8':
          dtype = 'i8'
          set = setview.setInt8.bind(setview)
          get = getview.getInt8.bind(getview)
          break
        case 'INT16':
          dtype = 'i16'
          set = setview.setInt16.bind(setview)
          get = getview.getInt16.bind(getview)
          break
        case 'INT32':
          dtype = 'i32'
          set = setview.setInt32.bind(setview)
          get = getview.getInt32.bind(getview)
          break
        case 'INT64':
          dtype = 'i64'
          set = setview.setBigInt64.bind(setview)
          get = getview.getBigInt64.bind(getview)
          break
        case 'FLOAT32':
          dtype = 'f32'
          set = setview.setUint32.bind(setview)
          get = getview.getUint32.bind(getview)
          break
        case 'FLOAT64':
          dtype = 'f64'
          set = setview.setBigInt64.bind(setview)
          get = getview.getBigInt64.bind(getview)
          break
        default:
          throw new Error(`Vector is of unsupported type ${x.type}`)
      }
      for (let i = 0; i < x.typedArray.length; i++) {
        set(i * x.typedArray.BYTES_PER_ELEMENT, get(i * x.typedArray.BYTES_PER_ELEMENT, isLittleEndian))
      }
      const data = toHexString(new Uint8Array(setview.buffer))
      return structResponse('CypherVector', { dtype, data })
    }

    // If all failed, interpret as a map
    const map = {}
    for (const [key, value] of Object.entries(x)) {
      map[key] = nativeToCypher(value)
    }
    return valueResponse('CypherMap', map)
  }

  function structResponse (name, data) {
    const map = {}
    for (const [key, value] of Object.entries(data)) {
      map[key] = typeof value === 'bigint' || neo4j.isInt(value)
        ? neo4j.int(value).toNumber()
        : value
    }
    return { name, data: map }
  }

  function cypherToNative (c) {
    const {
      name,
      data
    } = c
    switch (name) {
      case 'CypherString':
        return data.value
      case 'CypherInt':
        return BigInt(data.value)
      case 'CypherFloat':
        return data.value
      case 'CypherNull':
        return data.value
      case 'CypherBool':
        return data.value
      case 'CypherList':
        return data.value.map(cypherToNative)
      case 'CypherDateTime':
        if (data.utc_offset_s == null && data.timezone_id == null) {
          return new neo4j.LocalDateTime(
            data.year,
            data.month,
            data.day,
            data.hour,
            data.minute,
            data.second,
            data.nanosecond
          )
        }
        return new neo4j.DateTime(
          data.year,
          data.month,
          data.day,
          data.hour,
          data.minute,
          data.second,
          data.nanosecond,
          data.utc_offset_s,
          data.timezone_id
        )
      case 'CypherTime':
        if (data.utc_offset_s == null) {
          return new neo4j.LocalTime(
            data.hour,
            data.minute,
            data.second,
            data.nanosecond
          )
        }
        return new neo4j.Time(
          data.hour,
          data.minute,
          data.second,
          data.nanosecond,
          data.utc_offset_s
        )
      case 'CypherDate':
        return new neo4j.Date(
          data.year,
          data.month,
          data.day
        )
      case 'CypherDuration':
        return new neo4j.Duration(
          data.months,
          data.days,
          data.seconds,
          data.nanoseconds
        )
      case 'CypherMap':
        return Object.entries(data.value).reduce((acc, [key, val]) => {
          acc[key] = cypherToNative(val)
          return acc
        }, {})
      case 'CypherPoint':
        if (data.system === 'wgs84') {
          if (data.z != null) {
            return new neo4j.Point(WGS_84_3D_CRS_CODE, data.x, data.y, data.z)
          } else {
            return new neo4j.Point(WGS_84_2D_CRS_CODE, data.x, data.y)
          }
        } else if (data.system === 'cartesian') {
          if (data.z != null) {
            return new neo4j.Point(CARTESIAN_3D_CRS_CODE, data.x, data.y, data.z)
          } else {
            return new neo4j.Point(CARTESIAN_2D_CRS_CODE, data.x, data.y)
          }
        }
        throw new Error(`Unknown Point system '${data.system}'`)
      case 'CypherVector': {
        const isLittleEndian = checkLittleEndian()
        const arrayBuffer = toByteArray(data.data)
        const setview = new DataView(new ArrayBuffer(arrayBuffer.byteLength))
        const getview = new DataView(arrayBuffer.buffer)
        let get
        let set
        let resultArray
        switch (data.dtype) {
          case 'i8':
            return neo4j.vector(Int8Array.from(arrayBuffer))
          case 'i16':
            resultArray = new Int16Array(setview.buffer)
            get = getview.getInt16.bind(getview)
            set = setview.setInt16.bind(setview)
            break
          case 'i32':
            resultArray = new Int32Array(setview.buffer)
            get = getview.getInt32.bind(getview)
            set = setview.setInt32.bind(setview)
            break
          case 'i64':
            resultArray = new BigInt64Array(setview.buffer)
            get = getview.getBigInt64.bind(getview)
            set = setview.setBigInt64.bind(setview)
            break
          case 'f32':
            resultArray = new Float32Array(setview.buffer)
            // Due to JS imprecision when working with float32, we will get incorrect byte values if using the float functions
            get = getview.getUint32.bind(getview)
            set = setview.setUint32.bind(setview)
            break
          case 'f64':
            resultArray = new Float64Array(setview.buffer)
            get = getview.getBigInt64.bind(getview)
            set = setview.setBigInt64.bind(setview)
            break
          default:
            throw new Error('Unknown Inner Vector type ' + data.dtype)
        }
        for (let i = 0; i < arrayBuffer.length; i += resultArray.BYTES_PER_ELEMENT) {
          set(i, get(i), isLittleEndian)
        }
        return neo4j.vector(resultArray)
      }
    }
    console.log(`Type ${name} is not handle by cypherToNative`, c)
    const err = 'Unable to convert ' + c + ' to native type'
    console.log(err)
    throw Error(err)
  }

  function parseAuthToken (authToken) {
    switch (authToken.scheme) {
      case 'basic':
        return neo4j.auth.basic(
          authToken.principal,
          authToken.credentials,
          authToken.realm
        )
      case 'kerberos':
        return neo4j.auth.kerberos(authToken.credentials)
      case 'bearer':
        return neo4j.auth.bearer(authToken.credentials)
      default:
        return neo4j.auth.custom(
          authToken.principal,
          authToken.credentials,
          authToken.realm,
          authToken.scheme,
          authToken.parameters
        )
    }
  }

  function toHexString (byteArray) {
    let string = ''
    for (let i = 0; i < byteArray.length; i++) {
      string += (('0' + byteArray[i].toString(16) + ' ').slice(-3))
    }
    return string.slice(0, -1)
  }

  function toByteArray (hexString) {
    const result = []
    for (let i = 0; i < hexString.length; i += 3) {
      result.push(parseInt(hexString.substr(i, i + 2), 16))
    }
    return Uint8Array.from(result)
  }

  function checkLittleEndian () {
    const dataview = new DataView(new ArrayBuffer(2))
    dataview.setInt16(0, 1000, true)
    const typeArray = new Int16Array(dataview.buffer)
    return typeArray[0] === 1000
  }

  this.valueResponse = valueResponse
  this.objectToCypher = objectToCypher
  this.objectToNative = objectToNative
  this.objectMemberBitIntToNumber = objectMemberBitIntToNumber
  this.nativeToCypher = nativeToCypher
  this.cypherToNative = cypherToNative
  this.parseAuthToken = parseAuthToken
}
