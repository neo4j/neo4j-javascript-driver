/**
 * @property {function(username: string, password: string, realm: ?string)} basic the function to create a
 * basic authentication token.
 * @property {function(base64EncodedTicket: string)} kerberos the function to create a Kerberos authentication token.
 * Accepts a single string argument - base64 encoded Kerberos ticket.
 * @property {function(base64EncodedTicket: string)} bearer the function to create a Bearer authentication token.
 * Accepts a single string argument - base64 encoded Bearer ticket.
 * @property {function(principal: string, credentials: string, realm: string, scheme: string, parameters: ?object)} custom
 * the function to create a custom authentication token.
 */
 const auth = {
  basic: (username: string, password: string, realm?: string) => {
    if (realm) {
      return {
        scheme: 'basic',
        principal: username,
        credentials: password,
        realm: realm
      }
    } else {
      return { scheme: 'basic', principal: username, credentials: password }
    }
  },
  kerberos: (base64EncodedTicket: string) => {
    return {
      scheme: 'kerberos',
      principal: '', // This empty string is required for backwards compatibility.
      credentials: base64EncodedTicket
    }
  },
  bearer: (base64EncodedToken: string) => {
    return {
      scheme: 'bearer',
      credentials: base64EncodedToken
    }
  },
  custom: (
    principal: string,
    credentials: string,
    realm: string,
    scheme: string,
    parameters?: string
  ) => {
    if (parameters) {
      return {
        scheme: scheme,
        principal: principal,
        credentials: credentials,
        realm: realm,
        parameters: parameters
      }
    } else {
      return {
        scheme: scheme,
        principal: principal,
        credentials: credentials,
        realm: realm
      }
    }
  }
}

export default auth