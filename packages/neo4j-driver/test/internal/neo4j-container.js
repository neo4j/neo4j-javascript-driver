
export default class Neo4jContainer {
  constructor ({ user, password, containerLogs, version, edition, disabled }) {
    this._user = user
    this._password = password
    this._containerLogs = containerLogs || false
    this._version = version
    this._edition = edition
    this._container = null
    this._disabled = disabled || false
    this._usages = 0
  }

  async start () {
    this._usages++
    if (this._disabled) {
      return
    }
    console.log('Starting container')
    if (this._container != null) {
      console.log('Container already started')
      return
    }

    const tag = this._edition != null ? `${this._version}-${this._edition}` : this._version

    // Browser does not support testcontainers
    const path = globalThis.Window ? './browser/testcontainer' : './node/testcontainer'
    const { GenericContainer, DockerImageName, Wait } = require(path)

    let container = new GenericContainer(new DockerImageName(null, 'neo4j', tag).toString())
      .withEnv('NEO4J_AUTH', `${this._user}/${this._password}`)

    if (this._edition === 'enterprise') {
      container = container.withEnv('NEO4J_ACCEPT_LICENSE_AGREEMENT', 'yes')
    }

    this._container = await container.withExposedPorts(7687, 7474)
      .withWaitStrategy(Wait.forLogMessage(/Started/))
      .start()

    console.log('Container started at ' + `${this._container.getHost()}:${this._container.getMappedPort(7687)}`)

    if (this._containerLogs) {
      const stream = await this._container.logs()
      stream
        .on('data', line => console.log(line))
        .on('err', line => console.error(line))
        .on('end', () => console.log('Stream closed'))
    }
  }

  getBoltPort (defaultPort = 7687) {
    return this.getMappedPort(7687, defaultPort)
  }

  getHttpPort (defaultPort = 7474) {
    return this.getMappedPort(7474, defaultPort)
  }

  getMappedPort (port, defaultPort) {
    return this._container != null ? this._container.getMappedPort(port) : defaultPort
  }

  async stop () {
    this._usages--
    if (this._usages <= 0) {
      this._usages = 0
      if (this._container != null) {
        await this._container.stop()
      }
      this._container = undefined
    }
  }
}
