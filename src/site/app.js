/** @typedef { import("./scripts/Game").Game } Game */
import { center, keyPressed, renderBoard, ui } from "./scripts/ui.js"
import { server } from "./scripts/Server.js"
import { audioStream } from "./scripts/AudioStream.js"
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
      showInstruction: false,

      micEnabled: false,
      muted: true,

      begun: false,
      _playingUpdates: 0,
      showCanvas: false
    }
  },
  methods: {
    async joinGame(clickEvent) {
      if (clickEvent && this.muted) { this.toggleAudio() }

      try {
        this.gameId = this.gameId.toLowerCase()
        game = await server.joinGame(this.gameId)
        listenToGame(game)

        this.playerIndex = game.playerIndex
        location.hash = game.id
      } catch (err) {
        location.hash = ""
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

      if (this.muted) { this.toggleAudio() }
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

      this.showCanvas = false
      server.game = undefined
      server._ws.close()
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
    },
    /**
     * @param { "up" | "down" | "left" | "right" } direction 
     */
    arrowPath(direction) {
      // @ts-ignore
      direction = direction.toLowerCase()

      if (direction === "up") {
        return "m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z"
      } else if (direction === "down") {
        return "M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"
      } else if (direction === "left") {
        return "m3.86 8.753 5.482 4.796c.646.566 1.658.106 1.658-.753V3.204a1 1 0 0 0-1.659-.753l-5.48 4.796a1 1 0 0 0 0 1.506z"
      } else if (direction === "right") {
        return "m12.14 8.753-5.482 4.796c-.646.566-1.658.106-1.658-.753V3.204a1 1 0 0 1 1.659-.753l5.48 4.796a1 1 0 0 1 0 1.506z"
      }
    },

    async toggleMic() {
      if (audioStream.micTrack) {
        this.micEnabled = !this.micEnabled
        audioStream.micEnabled = this.micEnabled
      } else if (!this.micEnabled) {
        try {
          await audioStream.getMicTrack()
          this.micEnabled = true
        } catch (err) {
          console.log(err)
          this.micEnabled = false
        }
      }
    },
    async toggleAudio() {
      this.muted = !this.muted
      audioStream.muted = this.muted
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
    },
    /**
     * @param { boolean } micEnabled 
     */
    // async micEnabled(micEnabled) {
    //   if (audioStream.localAudio) {
    //     audioStream.localAudio.getAudioTracks().forEach(track => track.enabled = !micEnabled)
    //   } else if (!micEnabled) {
    //     try {
    //       await audioStream.getLocalAudio()
    //     } catch (err) {
    //       console.log(err)
    //       this.micEnabled = true
    //     }
    //   }
    // }
  },
  computed: {
    playing() {
      this._playingUpdates;

      return game && !game.isGameOver && !!game.bases[game.playerIndex]
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
  let firstUpdate = true
  let firstRender = true

  game.addUpdateListener(() => {
    if (firstUpdate) {
      firstUpdate = false
      audioStream.signal()
    }

    app.players = game.players

    const begun = game.board.length > 0
    app.begun = begun

    if (begun) {
      app.showCanvas = true
      app._playingUpdates++

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

            // const baseTile = game.getTile(myBase)
            // if (baseTile) { ui.mobilizingForce = baseTile.force }
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