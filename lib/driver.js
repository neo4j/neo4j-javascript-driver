import Session from './session';
import {connect} from "./internal/connector";

class Driver {
  constructor(url, userAgent) {
    this._url = url;
    this.userAgent = userAgent || 'neo4j-javascript/0.0';
    this._openSessions = {};
    this._sessionIdGenerator = 0;
  }

  session() {
    var sessionId = this._sessionIdGenerator++,
        conn = connect(this._url);
    conn.initialize(this.userAgent);

    var driver = this;
    var session = new Session( conn, () => {
      // On close of session, remove it from the list of open sessions
      delete driver._openSessions[sessionId]; 
    });

    this._openSessions[sessionId] = session;
    return session;
  }

  close() {
    for (var sessionId in this._openSessions) {
      if (this._openSessions.hasOwnProperty(sessionId)) {
        this._openSessions[sessionId].close();
      }
    }
  }
}

export default Driver
