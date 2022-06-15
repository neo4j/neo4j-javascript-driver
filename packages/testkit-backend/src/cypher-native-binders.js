import neo4j from './neo4j'

export function valueResponse (name, value) {
  return { name: name, data: { value: value } }
}

export function objectToCypher (obj) {
  return objectMapper(obj, nativeToCypher)
}

export function objectMemberBitIntToNumber (obj, recursive = false) {
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

export function nativeToCypher (x) {
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
  // If all failed, interpret as a map
  const map = {}
  for (const [key, value] of Object.entries(x)) {
    map[key] = nativeToCypher(value)
  }
  return valueResponse('CypherMap', map)
}

export function cypherToNative (c) {
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
      return new neo4j.DateTime(
        data.year,
        data.month,
        data.day,
        data.hour,
        data.minute,
        data.second,
        data.nanosecond,
        data.timezone_id == null ? data.utc_offset_s : null,
        data.timezone_id
      )
    case 'CypherMap':
      return Object.entries(data.value).reduce((acc, [key, val]) => {
        acc[key] = cypherToNative(val)
        return acc
      }, {})
  }
  console.log(`Type ${name} is not handle by cypherToNative`, c)
  const err = 'Unable to convert ' + c + ' to native type'
  console.log(err)
  throw Error(err)
}
