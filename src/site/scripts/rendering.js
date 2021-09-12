/** @typedef { import("./Game").Game } Game */
import { server } from "./Server.js"
import { mod } from "./utils.js"


const canvas = /** @type { HTMLCanvasElement } */ (document.getElementById("canvas"))
const ctx = /** @type { CanvasRenderingContext2D } */ (canvas.getContext("2d"))

let mouseDown = false
let boardOffsetX = 0
let boardOffsetY = 0
canvas.addEventListener("mousedown", () => {
  mouseDown = true
})
document.addEventListener("mousemove", event => {
  if (mouseDown && server.game) {
    const canvasRect = canvas.getBoundingClientRect()
    boardOffsetX += event.movementX * (canvas.width / canvasRect.width)
    boardOffsetY += event.movementY * (canvas.height / canvasRect.height)

    renderBoard()
  }
})
document.addEventListener("mouseup", () => {
  mouseDown = false
})

window.addEventListener("resize", () => {
  if (server.game) { renderBoard() }
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
      let y = r * squareSize + boardOffsetY
      y = mod(y, -squareSize, (squareRows + 2) * squareSize)

      let x = c * squareSize + boardOffsetX
      x = mod(x, -squareSize, (squareColumns + 2) * squareSize)
      
      ctx.beginPath()
      ctx.moveTo(x, (y + squareSize))
      ctx.lineTo(x, y)
      ctx.lineTo(x + squareSize, y)
      ctx.stroke()
    }
  }

  // Draw the pieces
  ctx.strokeStyle = "black"
  ctx.lineWidth = 0.5 // squareSize / 160
  ctx.font = `${squareSize / 4}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  for (let r = -1; r < squareRows + 2; r++) {
    for (let c = -1; c < squareColumns + 2; c++) {
      let y = r * squareSize + boardOffsetY
      y = mod(y, -squareSize, (squareRows + 2) * squareSize)

      let x = c * squareSize + boardOffsetX
      x = mod(x, -squareSize, (squareColumns + 2) * squareSize)

      const row = mod(Math.round((y - boardOffsetY) / squareSize), boardSize)
      const col = mod(Math.round((x - boardOffsetX) / squareSize), boardSize)

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

  boardOffsetY = (squareRows / 2 - row) * squareSize
  boardOffsetX = (squareColumns / 2 - col) * squareSize

  renderBoard()
}

// @ts-ignore
window.center = center