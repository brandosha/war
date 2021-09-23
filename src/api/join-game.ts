import { APIFunction, subscribeUntilDisconnected } from "../APIUtils"
import Game from "../Game"

interface Options {
  gameId?: string
}

const joinGame: APIFunction = function(options: Options, clientInfo, send, client) {
  const { playerId } = clientInfo
  if (!playerId) {
    send({
      error: "Missing player id"
    }, true)
    return
  }

  const { gameId } = options
  if (!gameId) {
    send({
      error: "Missing game id parameter"
    }, true)
    return
  }

  const game = new Game(gameId)
  if (game.players.length) {
    if (game.players.length >= 25) {
      send({ error: "The game is full" }, true)
      return
    }

    clientInfo.gameId = game.id
    send({ playerIndex: game.addPlayer(playerId, client) }, true)
    subscribeUntilDisconnected(game, send, client)
  } else {
    Game.cache[gameId] = undefined

    send({
      error: "Game id not found"
    }, true)
  }
}

export default joinGame
