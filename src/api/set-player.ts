import { APIFunction } from "../APIUtils"

interface Options {
  playerId?: string
}

const setPlayer: APIFunction = function(options: Options, clientInfo, send) {
  const playerId = options.playerId
  clientInfo.playerId = playerId

  send({ playerId }, true)
}

export default setPlayer
