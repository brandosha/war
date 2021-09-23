import { APIFunction } from "../APIUtils"
import Game from "../Game"

interface Options {
  force: number,
  fromTile: [number, number],
  direction: string
}

const invade: APIFunction = async function(options: Options, clientInfo, send) {
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

  for (const key of ["force", "fromTile", "direction"]) {
    if (!options[key]) {
      send({ error: `Missing ${key} parameter` })
      return
    }
  }
  const { force, fromTile, direction } = options

  const game = new Game(gameId)
  if (await game.load()) {
    const tile0 = game.getTile(fromTile)
    if (!tile0) {
      send({ error: "Invalid move [0]" }, true)
      return
    }

    const owner = game.players[tile0.owner]
    if (owner !== clientInfo.playerId) {
      send({ error: "Invalid move [1]" }, true)
      return
    }

    if (game.invade(force, fromTile, direction)) {
      send({ success: true }, true)
    } else {
      send({ error: "Invalid move [2]" }, true)
      return
    }
  } else {
    send({ error: "Game does not exist" }, true)
  }
}

export default invade
