/** @typedef { import("./scripts/Game").Game } Game */
import { center, renderBoard, ui } from "./scripts/ui.js"
import { server } from "./scripts/Server.js"
import { mod } from "./scripts/utils.js"

const canvas = document.getElementById("canvas")

/** @type { Game | null } */
let game = null

const app = Vue.createApp({
  data() {
    return {
      gameId: location.hash.slice(1),
      players: 0,
      playerIndex: -1,
      alliances: ui.alliances,
      allianceCursor: 0,
      showAllianceUi: true,

      begun: false,
      showCanvas: false
    }
  },
  methods: {
    async joinGame() {
      try {
        game = await server.joinGame(this.gameId)
        listenToGame(game)

        this.playerIndex = game.playerIndex
        location.hash = game.id
      } catch (err) {
        this.gameId = ""
        console.error(err)
      }
    },
    async createGame() {
      game = await server.createGame()
      listenToGame(game)
      
      this.playerIndex = game.playerIndex
      this.gameId = game.id
      location.hash = game.id
    },
    shareLink() {
      navigator.share({
        url: location.href
      })
    },
    cancel() {
      if (game) { game.clearListeners() }

      location.hash = ""
      this.gameId = ""
      this.players = 0
    },
    startGame() {
      if (game) { game.begin() }
    },
    /**
     * @param { number } d 
     */
    moveAllianceCursor(d) {
      this.allianceCursor = mod(this.allianceCursor + d, this.players)
      if (this.allianceCursor === this.playerIndex) {
        const sign = Math.sign(d) || 1
        this.allianceCursor = mod(this.allianceCursor + sign, this.players)
      }
    },
    toggleAlliance() {
      ui.alliances[this.allianceCursor] = !ui.alliances[this.allianceCursor]
      this.$forceUpdate()
    },
    /**
     * @param { number } i
     */
    allianceClicked(i) {
      const diff = i - this.allianceCursor
      console.log(i, this.allianceCursor, diff)
      this.moveAllianceCursor(diff)
      console.log(this.allianceCursor)
      this.toggleAlliance()
      this.$forceUpdate()
    }
  },
  watch: {
    showCanvas(showCanvas) {
      if (showCanvas) {
        canvas.style.display = "block"
      } else {
        canvas.style.display = "none"
      }
    },
    showAllianceUi(show) {
      const box = document.getElementById("alliance-box")

      if (show) {
        box.style.width = "initial"
        box.style.height = "initial"
      } else {
        box.style.width = "6.5em"
        box.style.height = "2.5em"
      }
    },
    alliances() {
      const storedAlliances = JSON.parse(localStorage.getItem("alliances") || "{}")

      const allianceArr = Array(this.players)
      for (let i = 0; i < this.players; i++) {
        allianceArr[i] = ui.alliances[i] ? "1" : "0"
      }

      storedAlliances[this.gameId] = allianceArr.join("")
      localStorage.setItem("alliances", JSON.stringify(storedAlliances))
    }
  }
}).mount("#app")

// @ts-ignore
window.app = app

/**
 * 
 * @param { Game } game 
 */
function listenToGame(game) {
  let firstRender = true
  game.addUpdateListener(() => {
    app.players = game.players

    const begun = game.board.length > 0
    app.begun = begun

    if (begun) {
      app.showCanvas = true

      app.moveAllianceCursor(0)
      app.$nextTick(() => {
        if (firstRender) {
          firstRender = false
    
          const myBase = game.bases[game.playerIndex]
          if (myBase) {
            ui.cursor = myBase
            center(myBase[0], myBase[1])

            const baseTile = game.getTile(myBase)
            if (baseTile) { ui.mobilizingForce = baseTile.force }
          }
        }
        renderBoard()
      })
    }
  })
}

server.ready.then(async () => {
  const gameId = location.hash.slice(1)
  
  if (gameId) {
    app.gameId = gameId
    app.joinGame()
  }

  console.log("server is ready")
})