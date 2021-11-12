import Controller from './interface'
import LocalController from './local'
import RemoteController from './remote'

/**
 * Controllers are piece of code responsabile for redicting the requests to the correct handler.
 *
 * {@link LocalController} delegates the requests to be handled by local handlers.
 * {@link RemoteController} delegates the request to be handled by remote clients by forwarding the requests over websockets.
 */
export default Controller
export {
  LocalController,
  RemoteController
}
