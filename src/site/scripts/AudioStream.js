import { app } from "../app.js"
import { server } from "./Server.js"

class AudioStream {
  constructor() {
    /** @type { (RTCPeerConnection | undefined)[] } */
    this.peerConnections = Array(8)

    /** @type { { makingOffer?: boolean, ignoreOffer?: boolean }[] } */
    this._connectionInfo = Array.from({ length: 8 }, () => ({}))

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
   * @param { number } player
   */
  peerConnection(player, forceReset = false) {
    let pc = /** @type { RTCPeerConnection } */ (this.peerConnections[player])
    if (!forceReset && pc) { return pc }

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: "turn:numb.viagenie.ca",
          credential: "muazkh",
          username: "webrtc@live.com"
        }
      ]
    })
    this.peerConnections[player] = pc

    pc.ontrack = event => {
      console.log("track", player, event.streams[0], event.streams[0].getTracks())
      this.setAudioStream(player, event.streams[0])
    }

    pc.onicecandidate = event => {
      const { candidate } = event
      if (candidate) {
        server.signalRTC(player, { candidate })
      }
    }

    const info = this._connectionInfo[player]
    pc.onnegotiationneeded = async () => {
      console.log(pc.connectionState, pc.signalingState)

      try {
        info.makingOffer = true
        await pc.setLocalDescription()
        server.signalRTC(player, { description: pc.localDescription })
      } catch (err) {
        console.error(err)
      } finally {
        info.makingOffer = false
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        pc.restartIce()
      }
    }

    const micStream = this.localStream
    if (micStream) {
      micStream.getTracks().forEach(track => {
        pc.addTrack(track, micStream)
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
      server.signalRTC(i)
    }
  }

  /**
   * @param { number } player
   * @param { { description?: RTCSessionDescriptionInit, candidate?: RTCIceCandidateInit } | undefined } msg 
   */
  async recieveRTCSignal(player, msg) {
    try {
      const info = this._connectionInfo[player]
      const pc = this.peerConnection(player)

      const { game } = server
      if (!game) { return }
      const polite = game.playerIndex < player

      if (!msg) {
        this.peerConnection(player, true)
      } else if (msg.description) {
        const { description } = msg

        const offerCollision = (description.type == "offer") && (info.makingOffer || pc.signalingState != "stable");
        info.ignoreOffer = !polite && offerCollision
        if (info.ignoreOffer) { return }

        await pc.setRemoteDescription(description);
        if (description.type == "offer") {
          await pc.setLocalDescription();
          server.signalRTC(player, { description: pc.localDescription })
        }
      } else if (msg.candidate) {
        try {
          await pc.addIceCandidate(msg.candidate)
        } catch (err) {
          if (!info.ignoreOffer) {
            throw err
          }
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  disconnect() {
    this.peerConnections.forEach(pc => {
      if (pc) { pc.close() }
    })
  }
}

export const audioStream = new AudioStream()

// @ts-ignore
window.audioStream = audioStream