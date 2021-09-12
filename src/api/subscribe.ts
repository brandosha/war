import { APIFunction, subscribeUntilDisconnected } from "../APIUtils"
import Game from "../Game"

interface Options {
  gameId?: string
}

const subscribe: APIFunction = async function(options: Options, clientInfo, send, client) {
  const { gameId } = options
  if (!gameId) {
    send({
      error: "Missing game id parameter"
    }, true)
    return
  }

  const game = new Game(gameId)
  if (await game.load()) {
    send({ gameId }, true)

    subscribeUntilDisconnected(game, send, client)
  } else {
    send({
      error: "Game id not found"
    }, true)
  }
}

export default subscribe
