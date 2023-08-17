import fs from 'fs'

const DEFAULT_MIME_TYPES = {
  html: 'text/html',
  js: 'text/javascript'
}

const DEFAULT_MIME_TYPE = 'text/plain'

const DEFAULT_INDEX_FILE = '/index.html'

/**
 * This a very minimal implementation of a static files http server.
 *
 * This is intend to be used only in the ${@link RemoteController} scenario and
 * this is not feature complete.
 *
 * Some security measures to avoid external elements to sniff to files out of the base
 * path are in place. Like Directory Transversal.
 */
export class HttpStaticServer {
  constructor ({
    basePath,
    mimeTypes,
    defaultMimeType,
    indexFile
  } = {}) {
    this._basePath = basePath
    this._mimeTypes = mimeTypes || DEFAULT_MIME_TYPES
    this._indexFile = indexFile || DEFAULT_INDEX_FILE
    this._defaultMimeType = defaultMimeType || DEFAULT_MIME_TYPE
  }

  serve (request, response) {
    if (request.method === 'GET') {
      const file = request.url !== '/' ? request.url : this._indexFile
      const filePath = `${this._basePath}${file}`
      const [, extension, ...rest] = file.split('.')
      if (rest.length > 0) {
        writeError(response, 403, '403 Forbidden!')
        return
      }

      if (!fs.existsSync(filePath)) {
        writeError(response, 404, '404 Not Found!')
        return
      }

      fs.readFile(filePath, 'utf-8', (err, message) => {
        if (err) {
          console.error(`HttpStaticServer: Error reading file ${filePath}`, err)
          writeError(response, 500, '500 Internal Server Error!')
          return
        }
        response.writeHead(200, { 'Content-Type': this._mimeTypes[extension] || this._defaultMimeType })
        response.write(message)
        response.end()
      })
    }
  }
}

function writeError (response, code, errorMessage) {
  response.writeHead(code, { 'Content-Type': 'text/plain' })
  response.write(errorMessage)
  response.end()
}
