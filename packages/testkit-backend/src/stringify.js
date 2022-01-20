export default function stringify(json) {
  return JSON.stringify(json, (_, value) =>
    typeof value === 'bigint' ? `${value}n` : value
  )
}
