// Minimal WHEP client (draft-ietf-wish-whep). Pulls a one-way audio+video
// stream from a server like the lowlatency-cam-streamer sidecar. No deps.
//
// Wire protocol:
//   1. Build SDP offer with recvonly transceivers.
//   2. POST it to the WHEP URL as `application/sdp`.
//   3. Use the returned `application/sdp` body as the remote answer.
//   4. The Location response header points at the resource we DELETE on stop.

export interface WhepStats {
  codec: string;
  width: number;
  height: number;
  fps: number;
  bitrateKbps: number;
  rttMs: number;
  packetsLost: number;
  jitterMs: number;
  framesDropped: number;
}

export interface WhepClient {
  /** Negotiate the session and start receiving media. Resolves once the answer is applied. */
  start(): Promise<void>;
  /** Tear down the peer connection and best-effort delete the WHEP resource on the server. */
  stop(): Promise<void>;
  /** Pull a fresh stats snapshot. Returns null until the first inbound video stats are available. */
  getStats(): Promise<WhepStats | null>;
  /** Single MediaStream that aggregates all inbound tracks. Stable for the lifetime of the client. */
  readonly stream: MediaStream;
  /** Fired on every RTCPeerConnection state transition. */
  onStateChange?: (state: RTCPeerConnectionState) => void;
}

interface WhepClientOptions {
  url: string;
}

export function createWhepClient({url}: WhepClientOptions): WhepClient {
  const stream = new MediaStream();
  // Keep abort handles for the in-flight negotiation so stop() can interrupt
  // a long-pending POST without leaving a dangling fetch and a dead pc.
  const abort = new AbortController();

  let pc: RTCPeerConnection | null = null;
  let resourceUrl: string | null = null;
  let prevBytes = 0;
  let prevTs = 0;
  let stopped = false;

  // Public client object - we attach methods after definition so onStateChange
  // can be reassigned at any time.
  const client: WhepClient = {
    stream,
    start,
    stop,
    getStats,
  };

  async function start(): Promise<void> {
    if (pc) throw new Error('WhepClient.start() called twice');
    if (stopped) throw new Error('WhepClient.start() after stop()');

    pc = new RTCPeerConnection({bundlePolicy: 'max-bundle', iceServers: []});
    pc.addTransceiver('video', {direction: 'recvonly'});
    pc.addTransceiver('audio', {direction: 'recvonly'});
    pc.ontrack = (ev) => {
      // Track in our own MediaStream rather than handing the server-published
      // one out - that way the consumer sees a stable srcObject across
      // reconnects driven from a single client instance.
      for (const track of ev.streams[0]?.getTracks() ?? [ev.track]) {
        if (!stream.getTracks().includes(track)) stream.addTrack(track);
      }
    };
    pc.onconnectionstatechange = () => {
      if (!pc) return;
      client.onStateChange?.(pc.connectionState);
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/sdp'},
      body: offer.sdp,
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`WHEP negotiation failed: HTTP ${res.status}`);
    const location = res.headers.get('Location');
    if (location) {
      // Servers may return either an absolute URL or a path relative to the
      // WHEP endpoint. Resolve against the request URL so DELETE later works.
      resourceUrl = /^https?:/i.test(location) ? location : new URL(location, url).toString();
    }
    const answer = await res.text();
    await pc.setRemoteDescription({type: 'answer', sdp: answer});
  }

  async function stop(): Promise<void> {
    if (stopped) return;
    stopped = true;
    abort.abort();
    if (resourceUrl) {
      // Best-effort cleanup. WHEP servers are required to accept DELETE on
      // the session resource; if it 404s we don't care.
      try {
        await fetch(resourceUrl, {method: 'DELETE'});
      } catch {
        // intentionally swallowed - teardown shouldn't fail user-visibly
      }
      resourceUrl = null;
    }
    if (pc) {
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pc = null;
    }
    for (const track of stream.getTracks()) stream.removeTrack(track);
  }

  async function getStats(): Promise<WhepStats | null> {
    if (!pc) return null;
    const report = await pc.getStats();
    let inboundVideo: RTCInboundRtpStreamStats | undefined;
    let candidatePair: RTCIceCandidatePairStats | undefined;
    let codec: RTCRtpCodec | undefined;
    report.forEach((entry) => {
      if (entry.type === 'inbound-rtp' && (entry as RTCInboundRtpStreamStats).kind === 'video') {
        inboundVideo = entry as RTCInboundRtpStreamStats;
      }
      if (entry.type === 'candidate-pair' && (entry as RTCIceCandidatePairStats).nominated) {
        candidatePair = entry as RTCIceCandidatePairStats;
      }
    });
    if (inboundVideo?.codecId) {
      const codecEntry = report.get(inboundVideo.codecId);
      if (codecEntry) codec = codecEntry as RTCRtpCodec;
    }
    if (!inboundVideo) return null;

    const bytes = inboundVideo.bytesReceived ?? 0;
    const ts = inboundVideo.timestamp;
    let bitrateKbps = 0;
    if (prevTs && ts > prevTs) {
      bitrateKbps = ((bytes - prevBytes) * 8) / (ts - prevTs);
    }
    prevBytes = bytes;
    prevTs = ts;

    return {
      codec: codec?.mimeType?.replace('video/', '') ?? '',
      width: inboundVideo.frameWidth ?? 0,
      height: inboundVideo.frameHeight ?? 0,
      fps: inboundVideo.framesPerSecond ?? 0,
      bitrateKbps,
      rttMs: (candidatePair?.currentRoundTripTime ?? 0) * 1000,
      packetsLost: inboundVideo.packetsLost ?? 0,
      jitterMs: (inboundVideo.jitter ?? 0) * 1000,
      framesDropped: inboundVideo.framesDropped ?? 0,
    };
  }

  return client;
}
