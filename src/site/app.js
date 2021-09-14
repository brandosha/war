/** @typedef { import("./scripts/Game").Game } Game */
import { center, keyPressed, renderBoard, ui } from "./scripts/ui.js"
import { server } from "./scripts/Server.js"
import { mod } from "./scripts/utils.js"

const canvas = document.getElementById("canvas")

/** @type { Record<string, string> } */
const storedAlliances = JSON.parse(localStorage.getItem("alliances") || "{}")

/** @type { Game | null } */
let game = null

export const app = Vue.createApp({
  data() {
    return {
      gameId: location.hash.slice(1),
      players: 0,
      playerIndex: -1,
      /** @type { Record<number, boolean> } */
      alliances: {},
      allianceCursor: 0,
      showAllianceUi: true,
      showTouchControls: true || window.matchMedia("(pointer: coarse)").matches,

      begun: false,
      showCanvas: false
    }
  },
  methods: {
    async joinGame() {
      try {
        this.gameId = this.gameId.toLowerCase()
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
      if (!this.showAllianceUi) {
        this.showAllianceUi = true
      } else {
        this.allianceCursor = mod(this.allianceCursor + d, this.players)
        if (this.allianceCursor === this.playerIndex) {
          const sign = Math.sign(d) || 1
          this.allianceCursor = mod(this.allianceCursor + sign, this.players)
        }
      }
    },
    toggleAlliance() {
      if (!this.showAllianceUi) {
        this.showAllianceUi = true
      } else {
        ui.alliances[this.allianceCursor] = !ui.alliances[this.allianceCursor]
        this.$forceUpdate()
      }
    },
    /**
     * @param { number } i
     */
    allianceClicked(i) {
      this.moveAllianceCursor(i - this.allianceCursor)
      this.toggleAlliance()
      this.$forceUpdate()
    },
    /**
     * @param { string } key 
     */
    pressKey(key) {
      keyPressed(key)
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
    alliances: {
      handler() {
        let allianceStr = ""
        for (let i = 0; i < this.players; i++) {
          allianceStr += ui.alliances[i] ? "1" : "0"
        }

        storedAlliances[this.gameId] = allianceStr
        localStorage.setItem("alliances", JSON.stringify(storedAlliances))
      },
      deep: true
    }
  }
}).mount("#app")

// @ts-ignore
window.app = app; ui.alliances = app.alliances

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

          const alliances = storedAlliances[game.id]
          if (alliances) {
            for (let i = 0; i < alliances.length; i++) {
              ui.alliances[i] = alliances[i] === "1"
            }
          }
    
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