class Result {
  constructor(streamObserver) {
    this._streamObserver = streamObserver;
    this.p = null;
  }
  createPromise() {
    if(this.p) {
      return;
    }
    let self = this;
    this.p = new Promise((resolve, reject) => {
      let records = [];
      let observer = {
        onNext: (record) => { records.push(record); },
        onCompleted: () => { resolve(records); },
        onError: (error) => { reject(error); }
      }
      self.subscribe(observer);
    });
  }
  catch(cb) {
    this.createPromise();
    this.p.catch(cb);
    return this.p;
  }
  then(cb) {
    this.createPromise();
    this.p.then(cb);
    return this.p;
  }
  subscribe(observer) {
    this._streamObserver.subscribe(observer);
  }
}

export default Result;
