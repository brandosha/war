import * as http from "http"
import * as ws from "ws"
import * as fs from "fs"

const mimeTypes = {
  "js": "text/javascript",
  "html": "text/html",
  "css": "text/css"
}

const server = http.createServer((req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let path = req.url!
  console.log(req.method + " " + path)

  if (path.includes("..")) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  if (req.method === "GET") {
    const splitPath = path.split("/")
    const splitFileName = splitPath[splitPath.length - 1].split(".")
    let extension = splitFileName[splitFileName.length - 1]?.toLowerCase()
    if (!extension) {
      if (!path.endsWith("/")) { path += "/" }
      path += "index.html"
      extension = "html"
    }

    fs.readFile(__dirname + "/src/site" + path, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end("Not Found")
      } else {
        res.writeHead(200, {
          "Content-Type": mimeTypes[extension]
        })
        res.end(data)
      }
    })
    return
  }

  res.writeHead(404)
  res.end("Not Found")
})

const wsServer = new ws.Server({ noServer: true })
wsServer.on("connection", client => {
  const clientInfo = {}

  client.on("message", msg => {
    try {
      const message = JSON.parse(msg.toString())
      console.log(message.action, message.options)

      const { action } = message
      if (typeof action !== "string") { return }
      let { options } = message
      if (typeof options !== "object") { options = {} }

      const send = (data: Record<string, unknown>, isResponse = false) => {
        if (isResponse) { data = Object.assign({ id: message.id }, data) }
        client.send(JSON.stringify(data))
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const apiFunc = require("./src/api/" + action).default
      apiFunc(options, clientInfo, send, client)
    } catch (err) {
      console.error(err)
    }
  })
})

server.on("upgrade", (req, socket, head) => {
  // @ts-ignore
  wsServer.handleUpgrade(req, socket, head, client => {
    wsServer.emit("connection", client, req)
  })
})

server.listen(3000)
