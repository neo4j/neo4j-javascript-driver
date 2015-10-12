/** 
 * Handles a RUN/PULL_ALL, or RUN/DISCARD_ALL requests, maps the responses
 * in a way that a user-provided observer can see these as a clean Stream
 * of records.
 */
class StreamObserver {
  constructor() {
    // This class will queue up incoming messages until a user-provided observer
    // for the incoming stream is registered. Thus, we keep fields around
    // for tracking head/records/tail. These are only used if there is no
    // observer registered.
    this._head = null;
    this._queuedRecords = [];
    this._tail = null;
    this._error = null;
  }

  onNext(rawRecord) {
    let record = {};
    for (var i = 0; i < this._head.length; i++) {
      record[this._head[i]] = rawRecord[i];
    };

    if( this._observer ) {
      this._observer.onNext( record );
    } else {
      this._queuedRecords.push( record );
    }
  }

  onCompleted(meta) {
    if( this._head === null ) {
      // Stream header
      this._head = meta.fields;
    } else {
      // End of stream
      if( this._observer ) {
        this._observer.onCompleted( meta );
      } else {
        this._tail = meta;
      }
    }
  }

  onError(error) {
    if( this._observer ) {
      this._observer.onError( error );
    } else {
      this._error = error;
    }
  }

  subscribe( observer ) {
    if( this._error ) {
      observer.onError(this._error);
      return;
    }

    if( this._queuedRecords.length > 0 ) {
      for (var i = 0; i < _queuedRecords.length; i++) {
        observer.onNext( _queuedRecords[i] );
      };
    }

    if( this._tail ) {
      observer.onCompleted( this._tail );
    }

    this._observer = observer;
  }
}

export default StreamObserver;
