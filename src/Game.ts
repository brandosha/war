import { db } from "./Database"
import { mod, mulberry32 } from "./utils"

interface StrongTile {
  owner: number
  force: number
  base?: boolean
}
type Tile = StrongTile | null

interface GameUpdate {
  players: number,
  board: string,
  timestamp: number
}

export default class Game {
  readonly id: string

  variation = "normal"
  board: Tile[][] = []
  players: string[] = []
  bases: Coordinate[] = []

  constructor(id: string | null = null) {
    if (id) {
      id = id.toLowerCase()
    } else {
      id = Game.generateId()
    }

    const existing = Game.cache[id]
    if (existing) { return existing }

    this.id = id
    Game.cache[id] = this
  }

  playerIndex(playerId: string) {
    return this.players.indexOf(playerId)
  }

  private static parseSaveData(data: string) {
    const variation = Game.variations[b64Dec[data[0]]]

    const split = data.slice(1).split(";")
    const players = split[0].split(",")
    const board = Game.parseBoardData(split[1])
    const timestamp = parseInt(split[2])

    return {
      variation,
      players,
      board,
      timestamp
    }
  }
  private saveData(): string {
    const variation = b64Enc[variationIndices[this.variation]]
    const players = this.players.join(",")
    const board = this.boardData()

    return variation + players + ";" + board + ";" + b64Encode(Math.floor(Date.now() / 1000))
  }

  initialBoard(): Tile[][] {
    const { players } = this

    const rand = mulberry32(parseInt(this.id.substr(0, 6), 36))
    const playerIndices = Array.from({ length: players.length }, (_, i) => i)
    for (let i = 0; i < players.length; i++) {
      const swapIndex = playerIndices[Math.floor(rand() * players.length)]

      const tempVal = playerIndices[i]
      playerIndices[i] = playerIndices[swapIndex]
      playerIndices[swapIndex] = tempVal
    }

    const tiles: Tile[][] = []
    const boardSize = Math.ceil(4 * Math.sqrt(players.length))
    for (let r = 0; r < boardSize; r++) {
      const row: Tile[] = []
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

    for (let i = 0; i < players.length; i++) {
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

  boardData(): string {
    const tileArr: string[] = []

    const boardSize = this.board.length

    for (let r = 0; r < boardSize; r++) {
      const row = this.board[r]
      for (let c = 0; c < boardSize; c++) {
        const tile = row[c]
        if (!tile) {
          tileArr.push("")
          continue
        }
        
        let tileStr = b64Enc[tile.owner] + b64Encode(tile.force)
        if (tile.base) { tileStr += "*" }

        tileArr.push(tileStr)
      }
    }

    return tileArr.join(",")
  }
  static parseBoardData(data: string): Tile[][] {
    if (data === "") { return [] }

    const tileArr = data.split(",")
    const boardSize = Math.sqrt(tileArr.length)
    const tiles: Tile[][] = []

    let i = 0
    for (let r = 0; r < boardSize; r++) {
      const row: Tile[] = []
      tiles.push(row)

      for (let c = 0; c < boardSize; c++) {
        const tileStr = tileArr[i++]
        if (tileStr === "") {
          row.push(null)
          continue
        }

        const tile: StrongTile = {
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

  isGameOver = false

  haltForceDistribution?: () => void
  scheduleForceDistribution() {
    if (!this.hasBegun || this.isGameOver || this.haltForceDistribution) { return }

    const boardSize = this.board.length

    let timeoutHandle: ReturnType<typeof setTimeout>
    const scheduleNext = () => {
      const delay = (Math.random() * 15 + 30) * 1000

      timeoutHandle = setTimeout(() => {
        for (let r = 0; r < boardSize; r++) {
          const row = this.board[r]
          for (let c = 0; c < boardSize; c++) {
            const tile = row[c]
            
            if (tile && tile.force > 0) {
              tile.force += 1
            }
          }
        }

        this.triggerUpdate()
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    
    this.haltForceDistribution = () => {
      clearTimeout(timeoutHandle)
      this.haltForceDistribution = undefined
    }
  }

  hasBegun: boolean | null = null
  async load(): Promise<boolean> {
    if (this.hasBegun == null) {
      const saveData = await db.get(this.id)
      if (saveData) {
        const game = Game.parseSaveData(saveData)

        this.variation = game.variation
        this.players = game.players
        this.board = game.board

        this.hasBegun = true
        this.scheduleForceDistribution()
      } else {
        this.hasBegun = false
      }
    }

    return this.hasBegun
  }

  async save(): Promise<void> {
    // Disable database integration for now

    // if (this.hasBegun) {
    //   await db.set(this.id, this.saveData())
    // }
  }

  async begin(): Promise<void> {
    this.board = this.initialBoard()
    this.hasBegun = true
    this.scheduleForceDistribution()
    this.save()

    this.triggerUpdate()
  }

  getTile(row: number, col: number): Tile
  getTile(coord: Coordinate): Tile
  getTile(rowOrCoord: number | Coordinate, col?: number) {
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

  setTile(row: number, col: number, value: Tile): void
  setTile(coord: Coordinate, value: Tile): void
  setTile(rowOrCoord: number | Coordinate, colOrValue: number | Tile, value?: Tile) {
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

  mobilize(force: number, fromTile: Coordinate, direction: string) {
    if (!this.hasBegun) { return false }

    force = Math.floor(force)
    if (force < 1) { return false }

    const tile0 = this.getTile(fromTile)
    if (!tile0 || tile0.force < force) { return false }
    if (tile0.base && force === tile0.force) { return false }

    const directionCoord = Game.Direction[direction]
    if (!directionCoord) { return false }

    /** @type { Coordinate } */
    const toTile: Coordinate = [fromTile[0] + directionCoord[0], fromTile[1] + directionCoord[1]]
    const tile1 = this.getTile(toTile)

    if (!tile1) {
      if (force >= tile0.force) { return false }

      this.setTile(toTile, {
        owner: tile0.owner,
        force
      })
    } else {
      if (force === tile0.force) {
        if (!this.canRemove(fromTile)) { return false }
      }

      tile1.force += force
    }
    tile0.force -= force
    if (tile0.force === 0) { this.setTile(fromTile, null) }

    this.triggerUpdate()
    this.save()

    return true
  }

  invade(force: number, fromTile: Coordinate, direction: string) {
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
    
    if (force === tile0.force && !this.canRemove(fromTile)) {
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
      this.purgeDisconnectedTiles(tile1.owner)
    }

    this.triggerUpdate()

    return true
  }

  private canRemove(coord: Coordinate) {
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

    const connectedTiles: Record<string, boolean> = {}

    const search = (coord: Coordinate) => {
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
    console.log(connectedTiles)

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
   * @param { number } playerIndex
   */
  private purgeDisconnectedTiles(playerIndex: number) {
    const boardSize = this.board.length

    const base = this.bases[playerIndex]
    if (!base) { return }

    /** @type { Record<string, boolean> } */
    const connectedTiles: Record<string, boolean> = {}

    /**
     * @param { Coordinate } coord 
     */
    const search = (coord: Coordinate) => {
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

  private updateCallbacks: ((update: GameUpdate) => void)[] = []
  addUpdateListener(callback: (update: GameUpdate) => void) {
    this.updateCallbacks.push(callback)
    callback(this.getUpdate())

    this.scheduleForceDistribution()
  }
  removeUpdateListener(callback: (update: GameUpdate) => void) {
    for (let i = 0; i < this.updateCallbacks.length; i++) {
      const cb = this.updateCallbacks[i]
      if (cb === callback) {
        this.updateCallbacks.splice(i, 1)
        break
      }
    }

    if (this.updateCallbacks.length <= 0) {
      this.haltForceDistribution?.()

      setTimeout(() => {
        if (this.updateCallbacks.length <= 0) {
          Game.cache[this.id] = undefined
        }
      }, 5000)
    }
  }

  private getUpdate() {
    return {
      players: this.players.length,
      board: this.boardData(),
      timestamp: Date.now()
    }
  }
  private triggerUpdate() {
    this.save()
    this.setBases()

    const update = this.getUpdate()
    this.updateCallbacks.forEach(callback => callback(update))
  }

  private setBases() {
    if (!this.hasBegun) { return }
    
    const boardSize = this.board.length
    this.bases = Array(this.players.length)

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

    if (this.hasBegun && basesCount <= 1) {
      this.isGameOver = true
      this.haltForceDistribution?.()
    }
  }

  addPlayer(playerId: string) {
    let playerIndex = this.playerIndex(playerId)
    if (this.hasBegun || playerIndex > -1) { return playerIndex }

    playerIndex = this.players.length
    this.players.push(playerId)
    this.triggerUpdate()

    return playerIndex
  }

  static generateId(length = 6) {
    const charset = "0123456789abcdefghijklmnopqrstuvwxyz"

    let id = ""
    for (let i = 0; i < length; i++) {
      id += charset[Math.floor(Math.random() * charset.length)]
    }

    return id
  }
  static cache: Record<string, Game | undefined> = {}
  static variations = ["normal"]

  static Direction: Record<string, Coordinate> = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1]
  }
}

const directions: ["up", "down", "left", "right"] = ["up", "down", "left", "right"]

const variationIndices: Record<string, string> = {}
Game.variations.forEach((variation, i) => variationIndices[variation] = i.toString())

const b64Enc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
const b64Dec: Record<string, number> = {}
b64Enc.split("").forEach((char, i) => b64Dec[char] = i)

function b64Encode(num: number) {
  if (num < 0) { throw new Error("Cannot base64 encode negative numbers") }
  if (num === 0) { return b64Enc[0] }

  let out = ""

  while (num > 0) {
    out = b64Enc[num & 63] + out
    num = Math.floor(num / 64)
  }

  return out
}

function b64Decode(str: string) {
  let out = 0

  for (let i = 0; i < str.length; i++) {
    const char = str[i]
    if (b64Dec[char] === undefined) { continue }
    
    out *= 64
    out += b64Dec[char]
  }

  return out
}

type Coordinate = [number, number]

function add(coord1: Coordinate, coord2: Coordinate): Coordinate {
  return [coord1[0] + coord2[0], coord1[1] + coord2[1]]
}