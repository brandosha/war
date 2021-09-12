import * as ws from "ws"
import Game from "./Game"

interface ClientInfo {
  playerId?: string
}

export type APIFunction = (options, clientInfo: ClientInfo, send: (data: Record<string, unknown>, isResponse?: boolean) => void, client: ws) => void

export function subscribeUntilDisconnected(game: Game, send: (data: Record<string, unknown>, isResponse?: boolean) => void, client: ws) {
  const listener = update => send({ gameId: game.id, update })
  game.addUpdateListener(listener)

  client.on("close", () => {
    game.removeUpdateListener(listener)
  })
}