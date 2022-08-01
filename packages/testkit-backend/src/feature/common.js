import tls from 'tls'

const SUPPORTED_TLS = (() => {
  if (tls.DEFAULT_MAX_VERSION) {
    const min = Number(tls.DEFAULT_MIN_VERSION.split('TLSv')[1])
    const max = Number(tls.DEFAULT_MAX_VERSION.split('TLSv')[1])
    const result = []
    for (let version = min > 1 ? min : 1.1; version <= max; version = Number((version + 0.1).toFixed(1))) {
      result.push(`Feature:TLS:${version.toFixed(1)}`)
    }
    return result
  }
  return []
})()

const features = [
  'Feature:Auth:Custom',
  'Feature:Auth:Kerberos',
  'Feature:Auth:Bearer',
  'Feature:API:BookmarkManager',
  'Feature:API:SSLConfig',
  'Feature:API:SSLSchemes',
  'Feature:API:Type.Temporal',
  'AuthorizationExpiredTreatment',
  'ConfHint:connection.recv_timeout_seconds',
  'Feature:Impersonation',
  'Feature:Bolt:3.0',
  'Feature:Bolt:4.1',
  'Feature:Bolt:4.2',
  'Feature:Bolt:4.3',
  'Feature:Bolt:4.4',
  'Feature:Bolt:5.0',
  'Feature:Bolt:Patch:UTC',
  'Feature:API:ConnectionAcquisitionTimeout',
  'Feature:API:Driver:GetServerInfo',
  'Feature:API:Driver.VerifyConnectivity',
  'Optimization:EagerTransactionBegin',
  'Optimization:ImplicitDefaultArguments',
  'Optimization:MinimalResets',
  ...SUPPORTED_TLS
]

export default features
