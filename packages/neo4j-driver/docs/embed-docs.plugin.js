const fs = require('fs')
let option

class EmbebDocsPlugin {
  onStart (ev) {
    option = ev.data.option
  }

  onHandleDocs (ev) {
    if (option.enabled) {
      const data = fs.readFileSync(option.path + '/index.json', 'utf-8')
      const embedDocs = JSON.parse(data.toString())
      ev.data.docs = [...ev.data.docs, ...embedDocs]
    }
  };
}

module.exports = new EmbebDocsPlugin()
