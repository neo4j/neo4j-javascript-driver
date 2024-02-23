/**
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [https://neo4j.com]
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

import fs from 'fs'

function readFile (file) {
  return new Promise((resolve, reject) => fs.readFile(file, (err, data) => {
    if (err) {
      return reject(err)
    }
    return resolve(data)
  }))
}

function loadCert (fileOrFiles) {
  if (Array.isArray(fileOrFiles)) {
    return Promise.all(fileOrFiles.map(loadCert))
  }
  return readFile(fileOrFiles)
}

function loadKey (fileOrFiles) {
  if (Array.isArray(fileOrFiles)) {
    return Promise.all(fileOrFiles.map(loadKey))
  }

  if (typeof fileOrFiles === 'string') {
    return readFile(fileOrFiles)
  }

  return readFile(fileOrFiles.path)
    .then(pem => ({
      pem,
      passphrase: fileOrFiles.password
    }))
}

export default {
  async load (clientCertificate) {
    const certPromise = loadCert(clientCertificate.certfile)
    const keyPromise = loadKey(clientCertificate.keyfile)

    const [cert, key] = await Promise.all([certPromise, keyPromise])

    return {
      cert,
      key,
      passphrase: clientCertificate.password
    }
  }
}
