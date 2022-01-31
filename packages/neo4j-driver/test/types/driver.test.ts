/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Driver, {
  AuthToken,
  Config,
  EncryptionLevel,
  READ,
  SessionMode,
  TrustStrategy,
  WRITE
} from '../../types/driver'
import { Parameters } from '../../types/query-runner'
import { ServerInfo, Session } from 'neo4j-driver-core'
import RxSession from '../../types/session-rx'
import { concat, map, catchError } from 'rxjs/operators'
import { throwError } from 'rxjs'

const dummy: any = null

const authToken: AuthToken = dummy
const scheme: string = authToken.scheme
const principal: string = authToken.principal
const credentials: string = authToken.credentials
const realm1: undefined = <undefined>authToken.realm
const realm2: string = <string>authToken.realm
const parameters1: undefined = <undefined>authToken.parameters
const parameters2: { [key: string]: any } = <{ [key: string]: any }>(
  authToken.parameters
)
const parameters3: Parameters = <Parameters>authToken.parameters

const encryptionLevel: EncryptionLevel = dummy
const encryptionLevelStr: string = encryptionLevel

const trustStrategy: TrustStrategy = dummy
const trustStrategyStr: string = trustStrategy

const config: Config = dummy
const encrypted: undefined | boolean | EncryptionLevel = config.encrypted
const trust: undefined | TrustStrategy = config.trust
const trustedCertificates: undefined | string[] = config.trustedCertificates
const knownHosts: undefined | string = config.knownHosts
const maxTransactionRetryTime: undefined | number =
  config.maxTransactionRetryTime
const maxConnectionLifetime: undefined | number = config.maxConnectionLifetime
const connectionTimeout: undefined | number = config.connectionTimeout
const disableLosslessIntegers: undefined | boolean =
  config.disableLosslessIntegers

const sessionMode: SessionMode = dummy
const sessionModeStr: string = sessionMode

const readMode1: SessionMode = READ
const readMode2: string = READ

const writeMode1: SessionMode = WRITE
const writeMode2: string = WRITE

const driver: Driver = dummy

const session1: Session = driver.session()
const session2: Session = driver.session({ defaultAccessMode: 'READ' })
const session3: Session = driver.session({ defaultAccessMode: READ })
const session4: Session = driver.session({ defaultAccessMode: 'WRITE' })
const session5: Session = driver.session({ defaultAccessMode: WRITE })
const session6: Session = driver.session({
  defaultAccessMode: READ,
  bookmarks: 'bookmark1'
})
const session7: Session = driver.session({
  defaultAccessMode: WRITE,
  bookmarks: 'bookmark2'
})

session1
  .run('RETURN 1')
  .then(result => {
    result.records.forEach(record => {
      console.log(record)
    })
  })
  .then(() => session1.close())

const close: Promise<void> = driver.close()

driver.verifyConnectivity().then((serverInfo: ServerInfo) => {
  console.log(serverInfo.version)
  console.log(serverInfo.address)
})

driver.supportsMultiDb().then((supported: boolean) => {
  console.log(`multi database is supported? => ${supported}`)
})

driver.supportsTransactionConfig().then((supported: boolean) => {
  console.log(`transaction config is supported? => ${supported}`)
})

const rxSession1: RxSession = driver.rxSession()
const rxSession2: RxSession = driver.rxSession({ defaultAccessMode: READ })
const rxSession3: RxSession = driver.rxSession({ defaultAccessMode: 'READ' })
const rxSession4: RxSession = driver.rxSession({ defaultAccessMode: WRITE })
const rxSession5: RxSession = driver.rxSession({ defaultAccessMode: 'WRITE' })
const rxSession6: RxSession = driver.rxSession({
  defaultAccessMode: READ,
  bookmarks: 'bookmark1'
})
const rxSession7: RxSession = driver.rxSession({
  defaultAccessMode: READ,
  bookmarks: ['bookmark1', 'bookmark2']
})
const rxSession8: RxSession = driver.rxSession({
  defaultAccessMode: WRITE,
  bookmarks: 'bookmark1'
})
const rxSession9: RxSession = driver.rxSession({
  defaultAccessMode: WRITE,
  bookmarks: ['bookmark1', 'bookmark2']
})

const rxSession10: RxSession = driver.rxSession({
  defaultAccessMode: WRITE,
  bookmarks: 'bookmark1'
})
const rxSession11: RxSession = driver.rxSession({
  defaultAccessMode: WRITE,
  bookmarks: ['bookmark1', 'bookmark2']
})

rxSession1
  .run('RETURN 1')
  .records()
  .pipe(
    map(r => r.get(0)),
    concat(rxSession1.close()),
    catchError(err => rxSession1.close().pipe(concat(throwError(err))))
  )
  .subscribe({
    next: data => console.log(data),
    complete: () => console.log('completed'),
    error: error => console.log(error)
  })
