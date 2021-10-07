import auth from '../src/auth'

describe('auth', () => {

  test('.bearer()', () => {
    expect(auth.bearer('==Qyahiadakkda')).toEqual({ scheme: 'bearer', credentials: '==Qyahiadakkda' } )
  })
  
})
