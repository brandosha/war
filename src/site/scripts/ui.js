/** @typedef { import("./Game").Game } Game */
import { server } from "./Server.js"
import { mod } from "./utils.js"
import { app } from "../app.js"

export const ui = {
  boardOffsetX: 0,
  boardOffsetY: 0,
  /** @type { [number, number] | null } */
  cursor: null,
  mobilizingForce: 0,
  /** @type { Record<number, boolean> } */
  alliances: {}
}
// @ts-ignore
window.ui = ui

const canvas = /** @type { HTMLCanvasElement } */ (document.getElementById("canvas"))
const ctx = /** @type { CanvasRenderingContext2D } */ (canvas.getContext("2d"))

let mouseDown = false
let displacement = {
  x: 0,
  y: 0
}
canvas.addEventListener("mousedown", () => {
  mouseDown = true
  displacement = {
    x: 0,
    y: 0
  }
})
document.addEventListener("mousemove", event => {
  if (mouseDown && server.game) {
    displacement.x += Math.abs(event.movementX)
    displacement.y += Math.abs(event.movementY)

    if (displacement.x > 5 || displacement.y > 5) {
      const canvasRect = canvas.getBoundingClientRect()
      if (canvasRect.width <= 0 || canvasRect.height <= 0) { return }
      ui.boardOffsetX += event.movementX * (canvas.width / canvasRect.width)
      ui.boardOffsetY += event.movementY * (canvas.height / canvasRect.height)
      renderBoard()
    }
  }
})
document.addEventListener("mouseup", () => {
  mouseDown = false
})
canvas.addEventListener("click", event => {
  const { game } = server
  if (!game) { return }
  
  if (displacement.x < 5 || displacement.y < 5) {
    let { x, y } = event

    const canvasRect = canvas.getBoundingClientRect()
    x = x * (canvas.width / canvasRect.width) - ui.boardOffsetX
    y = y * (canvas.height / canvasRect.height) - ui.boardOffsetY

    let { board } = game
    if (board.length === 0) {
      board = game.initialBoard()
    }

    const boardSize = board.length
    const squareSize = Math.min(canvas.width, canvas.height) / boardSize

    const row = mod(Math.round(y / squareSize), boardSize)
    const col = mod(Math.round(x / squareSize), boardSize)

    const tile = game.getTile(row, col)
    if (tile && tile.owner === game.playerIndex) {
      ui.cursor = [row, col]
      addMobilizingForce(Infinity)
    }
    
    renderBoard()
  }
})

window.addEventListener("resize", () => {
  renderBoard()
})

export function renderBoard() {
  const { game } = server
  if (!game) { return }

  let { board } = game
  if (game.board.length === 0) {
    board = game.initialBoard()
  }
  const boardSize = board.length

  const canvasRect = canvas.getBoundingClientRect()
  canvas.width = canvasRect.width * window.devicePixelRatio
  canvas.height = canvasRect.height * window.devicePixelRatio

  const squareSize = Math.min(canvas.width, canvas.height) / boardSize
  const squareRows = Math.floor(canvas.height / squareSize)
  const squareColumns = Math.floor(canvas.width / squareSize)

  // Draw the grid
  ctx.strokeStyle = "#555"
  ctx.lineWidth = squareSize / 4

  for (let r = -1; r < squareRows + 2; r++) {
    for (let c = -1; c < squareColumns + 2; c++) {
      let y = r * squareSize + ui.boardOffsetY
      y = mod(y, -squareSize, (squareRows + 2) * squareSize)

      let x = c * squareSize + ui.boardOffsetX
      x = mod(x, -squareSize, (squareColumns + 2) * squareSize)
      
      ctx.beginPath()
      ctx.moveTo(x, (y + squareSize))
      ctx.lineTo(x, y)
      ctx.lineTo(x + squareSize, y)
      ctx.stroke()
    }
  }

  // Draw the pieces
  ctx.font = `${squareSize / 4}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  for (let r = -1; r < squareRows + 2; r++) {
    for (let c = -1; c < squareColumns + 2; c++) {
      let y = r * squareSize + ui.boardOffsetY
      y = mod(y, -squareSize, (squareRows + 2) * squareSize)

      let x = c * squareSize + ui.boardOffsetX
      x = mod(x, -squareSize, (squareColumns + 2) * squareSize)

      const row = mod(Math.round((y - ui.boardOffsetY) / squareSize), boardSize)
      const col = mod(Math.round((x - ui.boardOffsetX) / squareSize), boardSize)

      const tile = board[row][col]
      if (tile) {
        const hue = tile.owner / game.players * 360 + 225

        if (tile.base) {
          ctx.fillStyle = `hsl(${hue}, 70%, 60%)`
        } else {
          ctx.fillStyle = `hsl(${hue}, 70%, 70%)`
        }
        const rectSide = Math.ceil(squareSize)
        ctx.fillRect(Math.floor(x - squareSize / 2), Math.floor(y - squareSize / 2), rectSide, rectSide)

        ctx.fillStyle = "black"
        ctx.fillText(tile.force.toString(), x, y)
      }
    }
  }

  // Draw cursor
  if (!ui.cursor) { return }

  ctx.font = `${squareSize / 8}px sans-serif`
  ctx.strokeStyle = "#ddd"
  ctx.lineWidth = squareSize / 32

  for (let r = -1; r < squareRows + 2; r++) {
    for (let c = -1; c < squareColumns + 2; c++) {
      let y = r * squareSize + ui.boardOffsetY
      y = mod(y, -squareSize, (squareRows + 2) * squareSize)

      let x = c * squareSize + ui.boardOffsetX
      x = mod(x, -squareSize, (squareColumns + 2) * squareSize)

      const row = mod(Math.round((y - ui.boardOffsetY) / squareSize), boardSize)
      const col = mod(Math.round((x - ui.boardOffsetX) / squareSize), boardSize)

      const tile = board[row][col]
      if (tile && row === ui.cursor[0] && col === ui.cursor[1]) {
        const rectX = Math.floor(x - squareSize / 2)
        const rectY = Math.floor(y - squareSize / 2)
        const rectSide = Math.ceil(squareSize)
        ctx.strokeRect(rectX, rectY, rectSide, rectSide)

        const smallRectSide = squareSize / 4
        ctx.fillStyle = "#ddd"
        ctx.fillRect(rectX, rectY, smallRectSide, smallRectSide)

        ctx.fillStyle = "black"
        ctx.fillText(Math.min(ui.mobilizingForce, tile.force).toString(), rectX + smallRectSide / 2, rectY + smallRectSide / 2)
      }
    }
  }
}

/**
 * @param { number } row
 * @param { number } col
 */
export function center(row, col) {
  const { game } = server
  if (!game) { return }

  let { board } = game
  if (game.board.length === 0) {
    board = game.initialBoard()
  }
  const boardSize = board.length

  const canvasRect = canvas.getBoundingClientRect()
  canvas.width = canvasRect.width * window.devicePixelRatio
  canvas.height = canvasRect.height * window.devicePixelRatio

  const squareSize = Math.min(canvas.width, canvas.height) / boardSize
  const squareRows = Math.floor(canvas.height / squareSize)
  const squareColumns = Math.floor(canvas.width / squareSize)

  ui.boardOffsetY = (squareRows / 2 - row) * squareSize
  ui.boardOffsetX = (squareColumns / 2 - col) * squareSize

  renderBoard()
}

/**
 * @param { "up" | "down" | "left" | "right" } direction 
 */
function move(direction) {
  if (!ui.cursor) { return }

  const { game } = server
  if (!game) { return }
  const base = game.bases[game.playerIndex]

  const boardSize = game.board.length
  if (!boardSize) { return }

  const tile0 = game.getTile(ui.cursor)
  if (!tile0) {
    if (base) { ui.cursor = base }

    renderBoard()
    return
  }

  const coord = /** @type { [number, number] } */ (ui.cursor.slice())
  if (direction === "up") {
    coord[0] = mod(coord[0] - 1, boardSize)
  } else if (direction === "down") {
    coord[0] = (coord[0] + 1) % boardSize
  } else if (direction === "left") {
    coord[1] = mod(coord[1] - 1, boardSize)
  } else if (direction === "right") {
    coord[1] = (coord[1] + 1) % boardSize
  }

  const force = Math.min(ui.mobilizingForce, tile0.force)
  
  const tile1 = game.getTile(coord)
  if (force <= 0) {
    if (tile1 && tile1.owner === game.playerIndex) {
      ui.cursor = coord
    }
  } else if (!tile1 || tile1.owner === game.playerIndex) {
    if(game.mobilize(force, ui.cursor, direction)) {
      ui.cursor = coord
      ui.mobilizingForce = force
    } else {
      if (game.mobilize(force - 1, ui.cursor, direction)) {
        ui.cursor = coord
        ui.mobilizingForce = force - 1
      } else if (tile1 && tile1.owner === game.playerIndex) {
        ui.cursor = coord
      }
    }
  } else if (ui.alliances[tile1.owner]) {
    if(game.mobilize(force, ui.cursor, direction)) {
      if (force === tile0.force) {
        ui.cursor = base
        addMobilizingForce(Infinity)
      }
    } else {
      if (game.mobilize(tile0.force - 1, ui.cursor, direction)) {
        if (force === tile0.force) {
          ui.cursor = base
          addMobilizingForce(Infinity)
        }
      }
    }
  } else {
    const successful = game.attack(Math.min(force, tile0.force), ui.cursor, direction)
    if (successful && force === tile0.force) {
      ui.cursor = base
    }
  }

  renderBoard()
}

/**
 * @param { number } amount
 */
function addMobilizingForce(amount) {
  if (!ui.cursor) { return }

  const { game } = server
  if (!game) { return }

  if (typeof amount === "number") {
    const tile = game.getTile(ui.cursor)
    if (!tile) { return }

    ui.mobilizingForce = Math.max(0, Math.min(tile.force, ui.mobilizingForce + amount))
  }

  renderBoard()
}

document.addEventListener("keydown", e => {
  if (!server.game || server.game.board.length <= 0) { return }

  app.showTouchControls = false
  keyPressed(e.key)
})

/**
 * @param { string } key 
 */
export function keyPressed(key) {
  if (key === "ArrowUp") {
    move("up")
  } else if (key === "ArrowDown") {
    move("down")
  } else if (key === "ArrowLeft") {
    move("left")
  } else if (key === "ArrowRight") {
    move("right")
  } else if (key === "s") {
    addMobilizingForce(1)
  } else if (key === "a") {
    addMobilizingForce(-1)
  } else if (key === "w") {
    addMobilizingForce(Infinity)
  } else if (key === "q") {
    addMobilizingForce(-Infinity)
  } else if (key === "z") {
    app.moveAllianceCursor(-1)
  } else if (key === "x") {
    app.toggleAlliance()
  } else if (key === "c") {
    app.moveAllianceCursor(1)
  }
}