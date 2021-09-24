import { app } from "../app.js"
import { server } from "./Server.js"

class AudioStream {
  constructor() {
    /** @type { (RTCPeerConnection | undefined)[] } */
    this.peerConnections = Array(8)

    // /** @type { MediaStreamTrack? } */
    // this.micTrack = null

    /** @type { MediaStream? } */
    this.localStream = null

    /** @type { HTMLAudioElement[] } */
    this.audioElements = Array(8)

    this._micEnabled = false
    this._muted = true
  }

  get micEnabled() {
    return this._micEnabled
  }
  set micEnabled(enabled) {
    if (this.micTrack) {
      this.micTrack.enabled = enabled
      this._micEnabled = enabled
    }
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

    const micStream = new MediaStream([micTrack])
    this.localStream = micStream
    this.peerConnections.forEach(pc => {
      if (!pc) { return }
      pc.addTrack(micTrack, micStream)
    })

    return micTrack
  }

  /**
   * @param { number } playerIndex 
   * @param { MediaStream } stream 
   */
  setAudioStream(playerIndex, stream) {
    this._initializeAudioElements()
    this.audioElements[playerIndex].srcObject = stream
  }

  _initializeAudioElements() {
    if (!this.audioElements[0]) {
      for (let i = 0; i < 8; i++) {
        this.audioElements[i] = /** @type { HTMLAudioElement } */ (document.getElementById("audio-stream-" + i))
      }
    }
  }

  /**
   * @param { number } playerIndex
   */
  peerConnection(playerIndex) {
    let pc = /** @type { RTCPeerConnection } */ (this.peerConnections[playerIndex])
    if (pc) { return pc }

    pc = new RTCPeerConnection()
    this.peerConnections[playerIndex] = pc

    pc.ontrack = event => {
      console.log("track", playerIndex, event.streams[0], event.streams[0].getTracks())
      this.setAudioStream(playerIndex, event.streams[0])
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

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      server.sendMessage("signal-rtc", {
        player: playerIndex,
        data: {
          description: pc.localDescription
        }
      })
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        // @ts-ignore
        pc.addTrack(track, this.localStream)
      })
    }

    return pc
  }

  async signal() {
    const { game } = server
    if (!game || game.playerIndex < 0) { return }

    for (let i = 0; i < game.players; i++) {
      if (i === game.playerIndex) { continue }

      const existingPc = this.peerConnections[i]
      if (existingPc && ["connected", "connecting", "new"].includes(existingPc.connectionState)) { continue }

      this.peerConnection(i)
      server.sendMessage("signal-rtc", { player: i })
    }
  }
}

export const audioStream = new AudioStream()

// @ts-ignore
window.audioStream = audioStream