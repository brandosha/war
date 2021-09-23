import { app } from "../app.js"
import { server } from "./Server.js"

class AudioStream {
  constructor() {
    /** @type { RTCPeerConnection[] } */
    this.peerConnections = Array(8)

    /** @type { MediaStreamTrack? } */
    this.micTrack = null

    /** @type { HTMLAudioElement[] } */
    this.audioElements = Array(8)

    this._micEnabled = false
    this._muted = false
  }

  get micEnabled() {
    return this._micEnabled
  }
  set micEnabled(enabled) {
    if (this.micTrack) {
      this.micTrack.enabled = enabled
    }

    this._micEnabled = enabled
  }

  get muted() {
    return this._muted
  }
  set muted(muted) {
    this._initializeAudioElements()
    this.audioElements.forEach(e => {
      if (e.paused) { e.play() }
      e.muted = muted
    })

    this._muted = muted
  }

  async getMicTrack() {
    if (this.micTrack) { return this.micTrack }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    console.log("mic", stream.getTracks())
    const micTrack = this.micTrack = stream.getAudioTracks()[0]
    if (!micTrack) { throw new Error("No mics found") }
    
    this.micEnabled = !!this.micEnabled

    micTrack.onended = () => {
      this.micEnabled = false
      app.micEnabled = false
      this.micTrack = null
    }

    this.peerConnections.forEach(pc => {
      pc.addTrack(micTrack)
    })

    return micTrack
  }

  /**
   * @param { number } playerIndex 
   * @param { MediaStreamTrack } track 
   */
  setAudioStream(playerIndex, track) {
    this._initializeAudioElements()
    this.audioElements[playerIndex].srcObject = new MediaStream([track])
  }

  _initializeAudioElements() {
    if (!this.audioElements[0]) {
      for (let i = 0; i < 8; i++) {
        this.audioElements[i] = /** @type { HTMLAudioElement } */ (document.getElementById("audio-stream-" + i))
      }
    }
  }

  /**
   * @param { RTCPeerConnection } pc 
   * @param { number } playerIndex 
   */
  setPeerConnection(pc, playerIndex) {
    this.peerConnections[playerIndex] = pc

    pc.ontrack = event => {
      console.log("track", playerIndex, event.track)
      this.setAudioStream(playerIndex, event.track)
    }

    pc.onicecandidate = event => {
      const { candidate } = event
      if (candidate) {
        server.sendMessage("signal-rtc", {
          player: playerIndex,
          data: { candidate }
        })
      }
    }

    pc.onnegotiationneeded = async () => {
      console.log(pc.connectionState, pc.signalingState)
      const { game } = server
      if (!game) { return }
      if (pc.connectionState !== "new" && game.playerIndex < playerIndex) { return }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      server.sendMessage("signal-rtc", {
        player: playerIndex,
        data: {
          description: pc.localDescription
        }
      })
    }

    if (this.micTrack) { pc.addTrack(this.micTrack) }
  }

  async signal() {
    const { game } = server
    if (!game || game.playerIndex < 0) { return }

    for (let i = 0; i < game.players; i++) {
      if (i === game.playerIndex) { continue }

      const existingPc = this.peerConnections[i]
      if (existingPc && ["connected", "connecting", "new"].includes(existingPc.connectionState)) { continue }

      this.setPeerConnection(new RTCPeerConnection(), i)
      server.sendMessage("signal-rtc", { player: i })
    }
  }
}

export const audioStream = new AudioStream()

// @ts-ignore
window.audioStream = audioStream