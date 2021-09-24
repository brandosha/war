import { APIFunction } from "../APIUtils"
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

  game.addPlayer(playerId, client)
  
  clientInfo.gameId = game.id
  send({ gameId: game.id }, true)
  send({
    gameId: game.id,
    update: game.getUpdate()
  })
}

export default createGame