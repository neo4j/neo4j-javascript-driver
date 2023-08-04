
export default class Neo4jContainer {
  constructor ({ user, password, containerLogs, version, edition, disabled }) {
    this._user = user
    this._password = password
    this._containerLogs = containerLogs || false
    this._version = version
    this._edition = edition
    this._container = null
    this._disabled = disabled || false
  }

  async start () {
    if (this._disabled) {
      return
    }
    console.log('Starting container')
    if (this._container != null) {
      console.log('Container already started')
      return
    }

    const tag = this._edition != null ? `${this._version}-${this._edition}` : this._version

    const { GenericContainer, Wait } = require('testcontainers')
    const { DockerImageName } = require('testcontainers/dist/docker-image-name')

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

  getBoltPort () {
    return this.getMappedPort(7687)
  }

  getHttpPort () {
    return this.getMappedPort(7474)
  }

  getMappedPort (port) {
    return this._container != null ? this._container.getMappedPort(port) : port
  }

  async stop () {
    await this._container.stop()
    this._container = undefined
  }
}
