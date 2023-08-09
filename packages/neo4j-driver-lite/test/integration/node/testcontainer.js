const { GenericContainer, Wait } = require('testcontainers')
const { DockerImageName } = require('testcontainers/dist/docker-image-name')

module.exports = {
  GenericContainer,
  Wait,
  DockerImageName
}
