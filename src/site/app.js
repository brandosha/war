import { center, renderBoard } from "./scripts/rendering.js"
import { server } from "./scripts/Server.js"

server.ready.then(async () => {
  console.log("server is ready")

  let gameId = location.hash.slice(1)
  
  let game
  if (gameId) {
    try {
      game = await server.joinGame(gameId)
    } catch (err) {
      console.error(err)
    }
  }

  if (!game) {
    game = await server.createGame()
    location.hash = game.id
  }

  console.log(game)
  let firstRender = true
  game.addUpdateListener(game => {
    if (firstRender) {
      firstRender = false

      const myBase = game.bases[game.playerIndex]
      if (myBase) {
        center(myBase[0], myBase[1])
      } else {
        renderBoard()
      }
    } else {
      renderBoard()
    }
  })
})