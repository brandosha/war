import { audioStream } from "./AudioStream.js"
import { Game } from "./Game.js"

class Server {
  constructor() {
    /** @type { Promise<void> } */
    this.ready = new Promise(r => r()) // Default value so `ready` is always defined

    this._messageId = 0
    this._pendingResponses = {}

    let wsProtocol = "ws"
    if (location.protocol === "https:") { wsProtocol += "s" }

    const ws = new WebSocket(wsProtocol + "://" + location.host)
    this._ws = ws

    this._initializeWebsocket()
  }

  _initializeWebsocket() {
    const ws = this._ws
    
    this.ready = new Promise(resolve => {
      ws.onopen = async () => {
        let playerId = localStorage.getItem("playerId")
        if (!playerId) {
          playerId = Game.generateId(8)
          localStorage.setItem("playerId", playerId)
        }

        await this.setPlayerId(playerId)
        resolve()
      }
    })

    ws.onmessage = async message => {
      const data = JSON.parse(message.data)
      console.log(data)

      if (data.id !== undefined) {
        const promise = this._pendingResponses[data.id]
        delete this._pendingResponses[data.id]

        if (promise) {
          if (data.error) {
            promise.reject(new Error(data.error))
          } else {
            promise.resolve(data)
          }
        }
      } else {
        if (data.update) {
          const game = Game.cache[data.gameId]
          if (game) {
            game._update(data.update)
          }
        } else if (data.rtcSignal) {
          /** @type { { player: number, data?: { description?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit } } } */
          const signal = data.rtcSignal
          if (!signal.data) {
            audioStream.peerConnections[signal.player] = undefined
            audioStream.peerConnection(signal.player)
          } else if (signal.data.description) {
            const { description } = signal.data

            if (description.type === "offer") {
              const pc = audioStream.peerConnection(signal.player)
              console.log("connection", signal.player, pc)
  
              pc.setRemoteDescription(description)
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
  
              this.sendMessage("signal-rtc", {
                player: signal.player,
                data: {
                  description: pc.localDescription
                }
              })
            } else if (description.type === "answer") {
              const pc = audioStream.peerConnections[signal.player]
              if (!pc) { return }
              console.log("connection", signal.player, pc)
  
              await pc.setRemoteDescription(description)
            }
          } else if (signal.data.candidate) {
            const pc = audioStream.peerConnections[signal.player]
            if (pc) { pc.addIceCandidate(signal.data.candidate) }
          }
        }
      }
    }

    ws.onclose = () => {
      this._ws = new WebSocket(ws.url)
      this._initializeWebsocket()
    }

    const { game } = this
    if (game) {
      this.ready.then(() => this.joinGame(game.id))
    }
  }

  /**
   * @param { string } action
   * @param {*} [options]
   */
  sendMessage(action, options) {
    return new Promise((resolve, reject) => {
      const id = this._messageId++

      this._ws.send(JSON.stringify({
        id, action, options
      }))

      this._pendingResponses[id] = { resolve, reject }
      setTimeout(() => {
        if (!this._pendingResponses[id]) { return }

        resolve(null)
        console.error("Resolved due to timeout")
      }, 5000)
    })
  }

  async setPlayerId(playerId) {
    playerId = playerId.toLowerCase()

    await this.sendMessage("set-player", { playerId })
    this.playerId = playerId
    localStorage.setItem("playerId", playerId)
  }

  async createGame() {
    const gameInfo = await this.sendMessage("create-game")

    this.game = new Game(gameInfo.gameId)
    this.game.playerIndex = 0
    return this.game
  }

  async joinGame(gameId) {
    const gameInfo = await this.sendMessage("join-game", { gameId })

    this.game = new Game(gameId)
    this.game.playerIndex = gameInfo.playerIndex
    return this.game
  }
}

export const server = new Server()

// @ts-ignore
window.server = server