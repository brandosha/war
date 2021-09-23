import { APIFunction } from "../APIUtils"
import Game from "../Game"

interface Options {
  player?: number,
  data?: unknown
}

const mobilize: APIFunction = async function(options: Options, clientInfo, send) {
  const { playerId, gameId } = clientInfo
  if (!playerId) {
    send({ error: "Missing player id" }, true)
    return
  } else if (!gameId) {
    send({
      error: "Missing game id"
    }, true)
    return
  }

  const { player, data } = options
  if (typeof player !== "number") {
    send({
      error: "Missing player index parameter"
    }, true)
    return
  }

  const game = new Game(gameId)
  if (game.players.length > 0) {
    const fromPlayerIndex = game.playerIndex(playerId)
    if (fromPlayerIndex < 0) {
      send({ error: "Player does not have permission to signal" }, true)
      return
    }

    const connection = game.connections.players[player][0]
    if (!connection) {
      send({ sent: false }, true)
      return
    }

    connection.send(JSON.stringify({
      rtcSignal: {
        player: fromPlayerIndex,
        data
      }
    }))
    send({ sent: true }, true)
  } else {
    send({ error: "Game does not exist" }, true)
  }
}

export default mobilize
