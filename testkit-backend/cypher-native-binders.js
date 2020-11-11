import neo4j from 'neo4j-driver'

export function valueResponse (name, value) {
  return { name: name, data: { value: value } }
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
    case 'string':
      return valueResponse('CypherString', x)
    case 'boolean':
      return valueResponse('CypherBool', x)
    case 'object':
      if (neo4j.isInt(x)) {
        // TODO: Broken!!!
        console.log(x)
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
          props: nativeToCypher(x.properties)
        }
        return { name: 'CypherNode', data: node }
      }
      // If all failed, interpret as a map
      const map = {}
      for (const [key, value] of Object.entries(x)) {
        map[key] = nativeToCypher(value)
      }
      return valueResponse('CypherMap', map)
  }
  console.log(`type of ${x} is ${typeof x}`)
  const err = 'Unable to convert ' + x + ' to cypher type'
  console.log(err)
  throw Error(err)
}

export function cypherToNative (c) {
  const {
    name,
    data: { value }
  } = c
  switch (name) {
    case 'CypherString':
      return value
    case 'CypherInt':
      return value
    case 'CypherFloat':
      return value
    case 'CypherNull':
      return value
    case 'CypherBool':
      return value
    case 'CypherList':
      return value.map(cypherToNative)
    case 'CypherMap':
      return Object.entries(value).reduce((acc, [key, val]) => {
        acc[key] = cypherToNative(val)
        return acc
      }, {})
  }
  console.log(`Type ${name} is not handle by cypherToNative`, c)
  const err = 'Unable to convert ' + c + ' to native type'
  console.log(err)
  throw Error(err)
}
