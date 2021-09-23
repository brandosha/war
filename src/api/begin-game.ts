import { APIFunction } from "../APIUtils"
import Game from "../Game"

const beginGame: APIFunction = async function(options, clientInfo, send) {
  const { playerId, gameId } = clientInfo
  if (!playerId) {
    send({
      error: "Missing player id"
    }, true)
    return
  } else if (!gameId) {
    send({
      error: "Missing game id"
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
