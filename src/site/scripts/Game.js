import { server } from "./Server.js"
import { mod, mulberry32 } from "./utils.js"

/** @typedef { { owner: number, force: number, base?: boolean } } StrongTile */
/** @typedef { StrongTile | null } Tile */

export class Game {
  /**
   * @param { string } id 
   */
  constructor(id) {
    id = id.toLowerCase()
    if (Game.cache[id]) { return Game.cache[id] }

    /** @type { string } */
    this.id = id
    /** @type { number } */
    this.players = 0 
    /** @type { Tile[][] } */
    this.board = []
    /** @type { Coordinate[] } */
    this.bases = []
    /** @type { boolean } */
    this.isGameOver = false
    /** @type { number } */
    this.playerIndex = -1

    /** @type { number } */
    this._timestamp = 0
    /** @type { ((game: Game) => void)[] } */
    this._updateCallbacks = []

    Game.cache[id] = this
  }

  initialBoard() {
    const { players } = this

    const rand = mulberry32(parseInt(this.id.substr(0, 6), 36))
    const playerIndices = Array.from({ length: players }, (_, i) => i)
    for (let i = 0; i < players; i++) {
      const swapIndex = playerIndices[Math.floor(rand() * players)]

      const tempVal = playerIndices[i]
      playerIndices[i] = playerIndices[swapIndex]
      playerIndices[swapIndex] = tempVal
    }

    const tiles = []
    const boardSize = Math.ceil(4 * Math.sqrt(players))
    for (let r = 0; r < boardSize; r++) {
      const row = []
      tiles.push(row)
      for (let c = 0; c < boardSize; c++) {
        row.push(null)
      }
    }

    // http://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/
    const a1 = 0.7548776662466927
    const a2 = 0.5698402909980532

    let rx = rand()
    let ry = rand()

    for (let i = 0; i < players; i++) {
      let x = 0, y = 0

      do {
        rx = (rx + a1) % 1
        ry = (ry + a2) % 1

        x = Math.floor(rx * boardSize)
        y = Math.floor(ry * boardSize)
      } while(tiles[x][y])

      tiles[x][y] = {
        owner: i,
        force: 10,
        base: true
      }
    }

    return tiles
  }

  begin() {
    server.sendMessage("begin-game")
  }

  /**
   * @param { number | Coordinate } rowOrCoord 
   * @param { number } [col] 
   * @returns { Tile }
   */
  getTile(rowOrCoord, col) {
    const boardSize = this.board.length
    if (!boardSize) { return null }

    if (typeof rowOrCoord === "number") {
      if (typeof col !== "number") { return null }

      const row = mod(rowOrCoord, boardSize)
      const column = mod(col, boardSize)

      return this.board[row][column]
    } else {
      const row = mod(rowOrCoord[0], boardSize)
      const column = mod(rowOrCoord[1], boardSize)

      return this.board[row][column]
    }
  }

  /**
   * @param { number | Coordinate } rowOrCoord
   * @param { number | Tile } colOrValue
   * @param { Tile } [value]
   */
  setTile(rowOrCoord, colOrValue, value) {
    const boardSize = this.board.length
    if (!boardSize) { return null }

    if (typeof rowOrCoord === "number") {
      if (typeof colOrValue !== "number") { return }
      if (!value) { return }

      const row = mod(rowOrCoord, boardSize)
      const column = mod(colOrValue, boardSize)

      this.board[row][column] = value
    } else {
      if (typeof colOrValue === "number") { return }

      const row = mod(rowOrCoord[0], boardSize)
      const column = mod(rowOrCoord[1], boardSize)

      this.board[row][column] = colOrValue
    }
  }

  /**
   * @param { number } force 
   * @param { Coordinate } fromTile 
   * @param { Direction } direction 
   */
  mobilize(force, fromTile, direction) {
    if (!this.board.length) { return false }

    force = Math.floor(force)
    if (force < 1) { return false }

    const tile0 = this.getTile(fromTile)
    if (!tile0 || tile0.force < force) { return false }
    if (tile0.base && force === tile0.force) { return false }

    const directionCoord = Game.Direction[direction]
    if (!directionCoord) { return false }

    const toTile = add(fromTile, directionCoord)
    const tile1 = this.getTile(toTile)

    if (!tile1) {
      if (force >= tile0.force) { return false }

      this.setTile(toTile, {
        owner: tile0.owner,
        force
      })
    } else {
      if (force === tile0.force) {
        if (!this._canRemove(fromTile)) { return false }
      }

      tile1.force += force
    }
    tile0.force -= force
    if (tile0.force === 0) { this.setTile(fromTile, null) }

    this._triggerUpdateCallbacks()
    server.sendMessage("mobilize", { force, fromTile, direction })

    return true
  }

  /**
   * @param { number } force 
   * @param { Coordinate } fromTile 
   * @param { Direction } direction 
   */
  invade(force, fromTile, direction) {
    if (!this.board.length) { return false }

    force = Math.floor(force)
    if (force < 1) { return false }

    const tile0 = this.getTile(fromTile)
    if (!tile0 || tile0.force < force) { return false }
    if (tile0.base && force === tile0.force) { return false }

    const directionCoord = Game.Direction[direction]
    if (!directionCoord) { return false }

    const toTile = add(fromTile, directionCoord)
    const tile1 = this.getTile(toTile)

    if (!tile1 || tile1.owner === tile0.owner) { return false }

    const remainingForce = force - tile1.force
    if (remainingForce > 0) {
      // Temporary for the `canRemove`
      this.setTile(toTile, {
        owner: tile0.owner,
        force: remainingForce
      })
    }
    
    if (force === tile0.force && !this._canRemove(fromTile)) {
      this.setTile(toTile, tile1)
      return false
    }

    tile0.force -= force
    tile1.force -= force
    
    if (tile0.force <= 0) {
      this.setTile(fromTile, null)
      // this.purgeDisconnectedTiles(tile0.owner)
    }
    if (tile1.force <= 0) {
      if (tile1.force === 0) {
        this.setTile(toTile, null)
      }
      this._purgeDisconnectedTiles(tile1.owner)
    }

    this._triggerUpdateCallbacks()
    server.sendMessage("invade", { force, fromTile, direction })

    return true
  }

  /**
   * @private
   * @param { Coordinate } coord 
   */
  _canRemove(coord) {
    const tile = this.getTile(coord)
    if (!tile) { return true }
    if (tile.base) { return false }
    const { owner } = tile

    const board = this.board.map(row => row.slice())
    const boardSize = board.length
    coord[0] = mod(coord[0], boardSize)
    coord[1] = mod(coord[1], boardSize)
    board[coord[0]][coord[1]] = null

    const base = this.bases[owner]
    if (!base) { return false }

    /** @type { Record<string, boolean> } */
    const connectedTiles = {}

    /**
     * @param { Coordinate } coord 
     */
    const search = (coord) => {
      coord = [mod(coord[0], boardSize), mod(coord[1], boardSize)]

      if (connectedTiles[coord.join()] !== undefined) { return }

      const tile = board[coord[0]][coord[1]]
      if (tile && tile.owner === owner) {
        connectedTiles[coord.join()] = true;

        directions.forEach(direction => {
          search(add(coord, Game.Direction[direction]))
        })
      } else {
        connectedTiles[coord.join()] = false
      }
    }
    search(base)

    for (let r = 0; r < boardSize; r++) {
      const row = board[r]
      for (let c = 0; c < boardSize; c++) {
        const tile = row[c]
        const key = [r, c].join()
        if (tile && tile.owner === owner && !connectedTiles[key]) {
          return false
        }
      }
    }

    return true
  }

  /**
   * @private
   * @param { number } playerIndex
   */
  _purgeDisconnectedTiles(playerIndex) {
    const boardSize = this.board.length

    const base = this.bases[playerIndex]
    if (!base) { return }

    /** @type { Record<string, boolean> } */
    const connectedTiles = {}

    /**
     * @param { Coordinate } coord 
     */
    const search = (coord) => {
      coord = [mod(coord[0], boardSize), mod(coord[1], boardSize)]

      if (connectedTiles[coord.join()] !== undefined) { return }

      const tile = this.getTile(coord)
      if (tile && tile.owner === playerIndex) {
        connectedTiles[coord.join()] = true;

        directions.forEach(direction => {
          search(add(coord, Game.Direction[direction]))
        })
      } else {
        connectedTiles[coord.join()] = false
      }
    }
    search(base)

    for (let r = 0; r < boardSize; r++) {
      const row = this.board[r]
      for (let c = 0; c < boardSize; c++) {
        const coord = [r, c].join()
        const tile = row[c]
        if (tile && tile.owner === playerIndex && !connectedTiles[coord]) {
          row[c] = null
        }
      }
    }
  }

  /**
   * @param { { players: number, board: string, timestamp: number } } update 
   */
  _update(update) {
    if (update.timestamp < this._timestamp) { return }

    this.players = update.players
    this.board = Game.parseBoardData(update.board)
    this._timestamp = update.timestamp

    this._setBases()
    this._triggerUpdateCallbacks()
  }
  /** @private */
  _triggerUpdateCallbacks() {
    this._updateCallbacks.forEach(cb => cb(this))
  }

  /** @private */
  _setBases() {
    const boardSize = this.board.length

    this.bases = Array(this.players)

    let basesCount = 0
    for (let r = 0; r < boardSize; r++) {
      const row = this.board[r]
      for (let c = 0; c < boardSize; c++) {
        const tile = row[c]
        
        if (tile && tile.base) {
          this.bases[tile.owner] = [r, c]
          basesCount += 1
        }
      }
    }

    if (this.board.length && basesCount <= 1) {
      this.isGameOver = true
    }
  }

  /**
   * @param { (game: Game) => void } listener 
   */
  addUpdateListener(listener) {
    this._updateCallbacks.push(listener)
  }
  clearListeners() {
    this._updateCallbacks = []
  }

  static parseBoardData(data) {
    if (data === "") { return [] }

    const tileArr = data.split(",")
    const boardSize = Math.sqrt(tileArr.length)
    const tiles = []

    let i = 0
    for (let r = 0; r < boardSize; r++) {
      const row = []
      tiles.push(row)

      for (let c = 0; c < boardSize; c++) {
        const tileStr = tileArr[i++]
        if (tileStr === "") {
          row.push(null)
          continue
        }

        const tile = {
          owner: b64Dec[tileStr[0]],
          force: b64Decode(tileStr.slice(1))
        }
        if (tileStr.endsWith("*")) {
          tile.base = true
        }

        row.push(tile)
      }
    }
    return tiles
  }

  static generateId(length = 6) {
    const charset = "0123456789abcdefghijklmnopqrstuvwxyz"
    let id = ""
    for (let i = 0; i < length; i++) {
      id += charset[Math.floor(Math.random() * charset.length)]
    }
    return id
  }
}
/** @type { Record<string, Game> } */
Game.cache = {}

const b64Enc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const b64Dec = {}
b64Enc.split("").forEach((char, i) => b64Dec[char] = i)
// function b64Encode(num) {
//   if (num < 0)
//       throw new Error("Cannot base64 encode negative numbers")
//   if (num === 0)
//       return b64Enc[0]
//   let out = ""
//   while (num > 0) {
//       out = b64Enc[num & 63] + out
//       num = Math.floor(num / 64)
//   }
//   return out
// }
function b64Decode(str) {
  let out = 0
  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (b64Dec[char] === undefined) { continue }
    out *= 64
    out += b64Dec[char]
  }
  return out
}

/** @typedef { [number, number] } Coordinate An array in the form [row, column] */
/** @typedef { "up" | "down" | "left" | "right" } Direction */
/** @type { Record<Direction, Coordinate> } */
Game.Direction = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1]
}

/** @type { ["up", "down", "left", "right"] } */
const directions = ["up", "down", "left", "right"]

/**
 * @param { Coordinate } coord1
 * @param { Coordinate } coord2
 * @returns { Coordinate }
 */
function add(coord1, coord2) {
  return [coord1[0] + coord2[0], coord1[1] + coord2[1]]
}