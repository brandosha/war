import { APIFunction } from "../APIUtils"
import Game from "../Game"

interface Options {
  gameId?: string
}

const beginGame: APIFunction = async function(options: Options, clientInfo, send) {
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
  if (game.playerIndex(playerId) < 0) {
    send({
      error: "Player does not have permission to begin the game"
    }, true)
    return
  }

  if (game.players.length < 4) {
    send({
      error: "Not enough players to begin the game"
    }, true)
    return
  }

  await game.begin()
  send({
    gameId
  }, true)
}

export default beginGame
