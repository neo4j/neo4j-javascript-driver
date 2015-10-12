import StreamObserver from './stream-observer';
import Result from './result';

class Session {
  constructor( conn, onClose ) {
    this._conn = conn;
    this._onClose = onClose;
  }

  run(statement, params) {
    let streamObserver = new StreamObserver();
    this._conn.run( statement, params || {}, streamObserver );
    this._conn.pullAll( streamObserver );
    this._conn.sync();
    return new Result( streamObserver );
  }

  close(cb) {
    this._onClose();
    this._conn.close(cb);
  }
}
export default Session
