import { APIFunction, subscribeUntilDisconnected } from "../APIUtils"
import Game from "../Game"

const createGame: APIFunction = async function(options, clientInfo, send, client) {
  const { playerId } = clientInfo
  if (!playerId) {
    send({
      error: "Missing player id"
    }, true)
    return
  }

  let game = new Game()
  let exists = await game.load()
  while (exists) {
    game = new Game()
    exists = await game.load()
  }

  game.addPlayer(playerId)
  
  send({
    gameId: game.id
  }, true)

  subscribeUntilDisconnected(game, send, client)
}

export default createGame