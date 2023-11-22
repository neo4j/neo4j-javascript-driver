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

type NumberOrString = number | string
export default class Neo4jContainer {
  private usages: number = 0
  private container: any | undefined = undefined

  constructor (
    private readonly user: string,
    private readonly password: string,
    private readonly version: string,
    private readonly edition: string | undefined,
    private readonly disabled: boolean,
    private readonly containerLogs: boolean = false

  ) {
  }

  async start (): Promise<void> {
    if (this.disabled) {
      return
    }
    this.usages++
    console.log('Starting container')
    if (this.container != null) {
      console.log('Container already started')
      return
    }

    const tag = this.edition != null ? `${this.version}-${this.edition}` : this.version

    // Browser does not support testcontainers
    // @ts-expect-error
    const path = global.window != null ? './browser/testcontainer' : './node/testcontainer'
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { GenericContainer, DockerImageName, Wait } = require(path)

    let container = new GenericContainer(new DockerImageName(undefined, 'neo4j', tag).toString())
      .withEnv('NEO4J_AUTH', `${this.user}/${this.password}`)

    if (this.edition === 'enterprise') {
      container = container.withEnv('NEO4J_ACCEPT_LICENSE_AGREEMENT', 'yes')
    }

    this.container = await container.withExposedPorts(7687, 7474)
      .withWaitStrategy(Wait.forLogMessage(/Started/))
      .start()

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    console.log('Container started at ' + `${this.container.getHost()}:${this.container.getMappedPort(7687)}`)

    if (this.containerLogs) {
      const stream = await this.container.logs()
      stream
        .on('data', (line: string) => console.log(line))
        .on('err', (line: string) => console.error(line))
        .on('end', () => console.log('Stream closed'))
    }
  }

  getBoltPort (defaultPort: NumberOrString = 7687): NumberOrString {
    return this.getMappedPort(7687, defaultPort)
  }

  getHttpPort (defaultPort: NumberOrString = 7474): NumberOrString {
    return this.getMappedPort(7474, defaultPort)
  }

  getMappedPort (port: number, defaultPort: NumberOrString): NumberOrString {
    return this.container != null ? this.container.getMappedPort(port) : defaultPort
  }

  async stop (): Promise<void> {
    this.usages--
    if (this.usages <= 0) {
      this.usages = 0
      await this.container?.stop()
      this.container = undefined
    }
  }
}
