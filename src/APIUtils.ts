import type * as WebSocket from "ws"

interface ClientInfo {
  playerId?: string,
  gameId?: string
}

export type APIFunction = (options, clientInfo: ClientInfo, send: (data: Record<string, unknown>, isResponse?: boolean) => void, client: WebSocket) => void