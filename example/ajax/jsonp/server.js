const http = require('http')
const {URL} = require('url')
const host = '127.0.0.1'
const port = 3000

const server = http.createServer((req, res) => {
  let JSONP = parseJSONPURL(`http://${host}:${port}` + req.url, 'callback')
  if (JSONP) {
    let callbackName = JSONP.jsonpCallback
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json;charset=utf-8')
    let data = {name: 'loveZcz'}
    data = JSON.stringify(data)
    let callback = callbackName + `(${data})`
    res.end(callback)
  }else {
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/plain')
    res.end('Hello World\n')
  }
})

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`)
})

function parseJSONPURL (url, jsonp) {
  let myURL = new URL(url)
  let search = myURL.search
  let pattern = new RegExp(`\\?(?:.*)${jsonp}=([^&]+)`)
  let result = pattern.exec(search)
  if (result) {
    return {jsonpCallback: result[1]}
  }
  return false
}