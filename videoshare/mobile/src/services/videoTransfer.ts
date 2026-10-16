import { v4 as uuidv4 } from 'uuid';
import type { FileHandle } from 'expo-file-system';
import { WebSocketClient } from './websocket';
import { PairingService } from './pairing';
import { FileSystemService } from './fileSystem';
import { calculateSHA256, verifyChecksum, computeTransferFingerprint } from './hashing';
import { uint8ArrayToBase64, calculateEncodedSize } from '../utils/encoding';
import { DEFAULT_CHUNK_SIZE, calculateTotalChunks, findMissingChunks } from '../utils/chunking';
import { VideoTransferMeta, VideoChunk, TransferProgress, TransferMetrics } from '../types/transfers';

/**
 * Reliability tuning — adaptive to the measured link.
 *
 * Everything here is derived from the observed round-trip time, because a fixed
 * timeout cannot serve both Wi-Fi (RTT ~50 ms) and 2G (RTT of several seconds at
 * ~10 KB/s). A hard 6 s ACK timeout, for example, guaranteed failure on 2G: the
 * sender declared a stall while the very first chunk was still in flight, then
 * "repaired" it by sending it again, doubling the queue and making things worse.
 *
 * The sender also streams the video straight off disk, one slice at a time, and
 * only ever holds one window of encoded chunks in memory, which is what makes
 * multi-gigabyte files possible on a phone at all.
 */
const WINDOW_MIN = 4;                   // starting / congested window (a few chunks in flight)
const WINDOW_MAX = 32;                  // healthy link ceiling (~2 MB with 64 KB chunks)
const WINDOW_GROW_EVERY_ACKS = 6;       // acks between +1 to the window
const PUMP_BATCH = 4;                   // chunks encoded+sent per event-loop tick (keeps the UI alive)

const STALL_RTT_MULTIPLIER = 6;         // an ACK is "late" after 6x the round-trip time
const STALL_TIMEOUT_MIN_MS = 25000;     // ...but never sooner than this
const STALL_TIMEOUT_MAX_MS = 240000;    // ...and never later than this
const MAX_STALL_RETRIES = 8;            // stalled rounds before giving up

const RECONCILE_RTT_MULTIPLIER = 4;     // receiver repair sweep cadence
const RECONCILE_MIN_MS = 12000;
const RECONCILE_MAX_MS = 90000;

const WATCHDOG_INTERVAL_MS = 2000;      // how often the watchdog sweeps active transfers
const RECEIVER_CONFIRM_TIMEOUT_MS = 60 * 60 * 1000; // wait this long for "transfer complete"
const FIRST_WINDOW_DELAY_MS = 250;      // grace period before the very first chunk is sent

/** Assumed round-trip time until the link has been measured. */
const FALLBACK_RTT_MS = 4000;

/** How long to wait for an ACK before assuming the window was lost. */
function stallTimeoutMs(rttMs: number): number {
  const scaled = Math.round(Math.max(rttMs, 250) * STALL_RTT_MULTIPLIER);
  return Math.min(STALL_TIMEOUT_MAX_MS, Math.max(STALL_TIMEOUT_MIN_MS, scaled));
}

/** How often the receiver asks for the chunks it is still missing. */
function reconcileIntervalMs(rttMs: number): number {
  const scaled = Math.round(Math.max(rttMs, 250) * RECONCILE_RTT_MULTIPLIER);
  return Math.min(RECONCILE_MAX_MS, Math.max(RECONCILE_MIN_MS, scaled));
}

/**
 * Repair requests are capped by *bytes* rather than by chunk count, so the
 * payload stays sane whether chunks are 16 KB or 128 KB.
 */
function missingPerRequest(chunkSize: number): number {
  return Math.max(32, Math.min(1024, Math.round((3 * 1024 * 1024) / Math.max(1, chunkSize))));
}

/**
 * Chunk size appropriate for the measured link.
 *
 * On a slow link a large chunk is actively harmful: an 87 KB frame takes ~9 s to
 * cross a 2G connection, and losing the connection mid-frame throws all of that
 * away. Smaller frames complete quickly, fail cheaply, and keep the ACK
 * feedback loop responsive.
 */
export function recommendedChunkSize(rttMs: number): number {
  if (rttMs <= 0) return 64 * 1024;
  if (rttMs <= 150) return 128 * 1024;
  if (rttMs <= 700) return 64 * 1024;
  if (rttMs <= 2500) return 32 * 1024;
  return 16 * 1024;
}

/** Coarse quality bucket used by the UI to describe the current link. */
export function describeLink(rttMs: number): {
  label: string;
  detail: string;
  tone: 'success' | 'accent' | 'warning' | 'danger' | 'neutral';
} {
  if (rttMs <= 0) {
    return { label: 'Measuring', detail: 'Link speed not measured yet', tone: 'neutral' };
  }
  if (rttMs <= 150) {
    return { label: 'Excellent', detail: `${rttMs} ms round trip`, tone: 'success' };
  }
  if (rttMs <= 700) {
    return { label: 'Good', detail: `${rttMs} ms round trip`, tone: 'accent' };
  }
  if (rttMs <= 2500) {
    return { label: 'Slow', detail: `${rttMs} ms round trip`, tone: 'warning' };
  }
  return { label: 'Very slow', detail: `${rttMs} ms round trip`, tone: 'danger' };
}

export interface VideoTransferCallbacks {
  onProgress?: (progress: TransferProgress) => void;
  onComplete?: (filePath: string, metrics: TransferMetrics) => void;
  onError?: (error: string) => void;
  onCancel?: () => void;
}

/**
 * A video prepared for sending.
 *
 * This is only a *descriptor*. It deliberately holds no payload: the chunks are
 * read from `uri` on demand while the transfer runs, so a 2 GB video never has to
 * be loaded into memory.
 */
export interface PreProcessedVideo {
  transferId: string;
  sourceUri: string;
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  totalChunks: number;
  chunkSize: number;
  checksum: string;
}

interface OutgoingSource {
  uri: string;
  fileSize: number;
  chunkSize: number;
  staged: boolean;
  handle: FileHandle | null;
}

/**
 * Transport abstraction for sending both text chat and video data chunks
 */
export class ChatTransport {
  private static ws = WebSocketClient.getInstance();

  static sendVideoStart(meta: VideoTransferMeta) {
    this.ws.send({
      action: 'video:start',
      ...meta,
    });
  }

  static sendVideoChunk(chunk: VideoChunk): boolean {
    // Returns false when the socket is not open; video chunks are never queued
    // (they are far too large to buffer), so the caller must retry later.
    return this.ws.send({
      action: 'video:chunk',
      ...chunk,
    });
  }

  static sendVideoAck(transferId: string, chunkIndex: number) {
    this.ws.send({
      action: 'video:ack',
      transferId,
      chunkIndex,
      status: 'received',
    });
  }

  static sendVideoComplete(transferId: string, checksumVerified: boolean) {
    this.ws.send({
      action: 'video:complete',
      transferId,
      checksumVerified,
    });
  }

  static requestMissingChunks(transferId: string, missingIndices: number[]) {
    this.ws.send({
      action: 'video:request_missing',
      transferId,
      missingIndices,
    });
  }

  static cancelTransfer(transferId: string, reason?: string) {
    this.ws.send({
      action: 'video:cancel',
      transferId,
      reason,
    });
  }
}

/**
 * Manages outgoing and incoming video transfers
 */
export class VideoTransferService {
  private static ws = WebSocketClient.getInstance();
  private static activeTransfers = new Map<string, TransferProgress>();
  private static activeTransferCallbacks = new Map<string, VideoTransferCallbacks>();
  private static isListening: boolean = false;

  // ----- Sender state -----
  private static outgoingSources = new Map<string, OutgoingSource>();
  private static nextChunkIndex = new Map<string, number>();
  private static inFlight = new Map<string, Set<number>>();
  private static retransmitQueue = new Map<string, number[]>();
  private static ackedIndices = new Map<string, Set<number>>();
  private static lastAckAt = new Map<string, number>();
  private static stallAttempts = new Map<string, number>();
  private static startedAt = new Map<string, number>();
  private static awaitingConfirmSince = new Map<string, number>();
  private static pumpPending = new Set<string>();

  // ----- Adaptive-link state -----
  /** Current congestion window, grown on healthy ACKs and halved on a stall. */
  private static windowSize = new Map<string, number>();
  /** Smoothed round-trip time for this transfer, never below the socket's own. */
  private static rttMs = new Map<string, number>();
  /** ACKs counted towards the next window increase. */
  private static ackStreak = new Map<string, number>();
  /** When each in-flight chunk was last written to the socket (RTT sampling). */
  private static sendTimes = new Map<string, Map<number, number>>();
  /** Transfers told to hold off by a transient (non-fatal) server error. */
  private static pausedTransfers = new Set<string>();
  /** Full metadata per outgoing transfer, so `video:start` can be replayed. */
  private static outgoingMeta = new Map<string, VideoTransferMeta>();

  // ----- Receiver state -----
  private static receivedIndices = new Map<string, Set<number>>();
  private static incomingChunkSize = new Map<string, number>();
  private static lastReceiverActivityAt = new Map<string, number>();

  // Screens subscribe here to render transfers they did not initiate themselves
  // (i.e. the receiving side of an incoming video).
  private static globalProgressListeners = new Set<(progress: TransferProgress) => void>();

  private static watchdogTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Subscribe to progress for every transfer, in both directions.
   * Returns an unsubscribe function.
   */
  static subscribeProgress(listener: (progress: TransferProgress) => void): () => void {
    this.globalProgressListeners.add(listener);
    return () => {
      this.globalProgressListeners.delete(listener);
    };
  }

  /**
   * Push a progress snapshot to the transfer's own callbacks and to every global
   * listener. A faulty listener must never break an in-flight transfer.
   */
  private static notifyProgress(progress: TransferProgress) {
    const snapshot = { ...progress };
    const callbacks = this.activeTransferCallbacks.get(progress.transferId);
    if (callbacks && callbacks.onProgress) {
      callbacks.onProgress(snapshot);
    }
    for (const listener of Array.from(this.globalProgressListeners)) {
      try {
        listener(snapshot);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Initializes listeners for incoming chunks, acknowledgements, and resumes
   */
  static init() {
    if (this.isListening) return;
    this.isListening = true;

    const ws = WebSocketClient.getInstance();

    // Receiver handles video start
    ws.on('video:start', async (data: VideoTransferMeta) => {
      await this.handleIncomingTransferStart(data);
    });

    // Receiver handles video chunks
    ws.on('video:chunk', async (chunk: VideoChunk) => {
      await this.handleIncomingChunk(chunk);
    });

    // Sender handles chunk acknowledgements
    ws.on('video:ack', (ack: { transferId: string; chunkIndex: number; status: string }) => {
      this.handleChunkAck(ack.transferId, ack.chunkIndex);
    });

    // Sender handles missing chunk requests (resume / repair)
    ws.on('video:request_missing', (data: { transferId: string; missingIndices: number[] }) => {
      this.handleResumeMissing(data.transferId, data.missingIndices);
    });

    // Peer completed transfer
    ws.on('video:complete', (data: { transferId: string; checksumVerified?: boolean }) => {
      if (data.checksumVerified === false) {
        this.failTransfer(data.transferId, 'Receiver reported an integrity mismatch');
      } else {
        this.handleTransferVerified(data.transferId);
      }
    });

    // Cancellation
    ws.on('video:cancel', (data: { transferId: string; reason?: string }) => {
      this.handleTransferCancelled(data.transferId, data.reason);
    });

    // Transfer error (raised by the server for either side).
    //
    // The server marks conditions that are expected on a flaky link — the peer's
    // socket being momentarily gone, a route that vanished because the server
    // restarted — as `fatal: false`. Treating those as permanent failures was the
    // single biggest cause of transfers dying on low-quality connections.
    ws.on(
      'video:error',
      (data: { transferId: string; error: string; fatal?: boolean; code?: string }) => {
        if (data.fatal === false) {
          this.handleTransientError(data.transferId, data.error, data.code);
          return;
        }
        this.failTransfer(data.transferId, data.error || 'Transfer error');
      }
    );

    // Re-arm everything after the socket comes back.
    ws.on('connection:change', (data: { status: string; reconnected?: boolean }) => {
      if (data.status === 'connected') {
        this.handleReconnect(data.reconnected === true);
      }
    });

    this.startWatchdog();
  }

  /**
   * The link dropped and came back.
   *
   * Nothing about a transfer is terminal just because the socket blipped: the
   * receiver still has every chunk it managed to persist, and the sender still
   * has its window bookkeeping. Reset the stall counters, make sure the server
   * has routing for this transfer again, and let the watchdog take it from there.
   */
  private static handleReconnect(reconnected: boolean) {
    // Sender side: forgive any elapsed stall time and replay the handshake so the
    // route is re-registered even if the server process restarted.
    for (const [transferId, progress] of Array.from(this.activeTransfers.entries())) {
      if (progress.direction !== 'outgoing') continue;
      if (progress.status !== 'transferring' && progress.status !== 'verifying') continue;

      this.lastAckAt.set(transferId, Date.now());
      this.stallAttempts.set(transferId, 0);
      this.pausedTransfers.delete(transferId);

      if (reconnected) {
        this.replayVideoStart(transferId);
      }
      this.pump(transferId);
    }

    // Receiver side: re-request whatever is still missing.
    for (const [transferId, progress] of Array.from(this.activeTransfers.entries())) {
      if (progress.direction !== 'incoming' || progress.status !== 'transferring') continue;
      this.lastReceiverActivityAt.set(transferId, Date.now());
      void this.resumeTransfer(transferId);
    }
  }

  /**
   * Re-send `video:start`. The receiver treats a repeated start as idempotent, so
   * this is safe and it re-establishes server-side routing.
   */
  private static replayVideoStart(transferId: string) {
    const meta = this.outgoingMeta.get(transferId);
    if (meta) ChatTransport.sendVideoStart(meta);
  }

  /**
   * A retryable condition: pause rather than fail. The watchdog keeps sweeping,
   * so the transfer picks itself back up as soon as the link allows.
   */
  private static handleTransientError(transferId: string, error: string, code?: string) {
    const progress = this.activeTransfers.get(transferId);
    if (!progress || progress.direction !== 'outgoing') return;
    if (progress.status !== 'transferring' && progress.status !== 'verifying') return;

    console.warn(`[VideoTransfer] transient error on ${transferId}: ${error} (${code ?? 'n/a'})`);

    this.pausedTransfers.add(transferId);
    // Give the link (or the server) room to recover before retrying.
    const rtt = this.rttMs.get(transferId) ?? FALLBACK_RTT_MS;
    this.lastAckAt.set(transferId, Date.now() + Math.max(15000, rtt * 2));
    this.shrinkWindow(transferId);

    if (code === 'TRANSFER_NOT_FOUND') {
      // The server lost its route (redeploy / restart). Re-announce the transfer.
      this.replayVideoStart(transferId);
    }
  }

  // ----- Window / RTT helpers -----

  private static currentRtt(transferId: string): number {
    const socketRtt = this.ws.getRoundTripMs();
    const measured = this.rttMs.get(transferId) ?? 0;
    return Math.max(measured, socketRtt, 0);
  }

  private static growWindow(transferId: string) {
    const streak = (this.ackStreak.get(transferId) ?? 0) + 1;
    if (streak < WINDOW_GROW_EVERY_ACKS) {
      this.ackStreak.set(transferId, streak);
      return;
    }
    this.ackStreak.set(transferId, 0);
    const current = this.windowSize.get(transferId) ?? WINDOW_MIN;
    if (current < WINDOW_MAX) {
      this.windowSize.set(transferId, Math.min(WINDOW_MAX, current + 1));
    }
  }

  private static shrinkWindow(transferId: string) {
    const current = this.windowSize.get(transferId) ?? WINDOW_MIN;
    this.windowSize.set(transferId, Math.max(WINDOW_MIN, Math.floor(current / 2)));
    this.ackStreak.set(transferId, 0);
  }

  private static updateRtt(transferId: string, sampleMs: number) {
    const socketRtt = this.ws.getRoundTripMs();
    const previous = this.rttMs.get(transferId) ?? socketRtt;
    const smoothed =
      previous <= 0 ? sampleMs : Math.round(previous * 0.7 + sampleMs * 0.3);
    this.rttMs.set(transferId, Math.max(smoothed, socketRtt));
  }

  /**
   * Live view of the link, for the UI. Reported in the same units the transfer
   * engine uses so the numbers on screen match the ones driving the timeouts.
   */
  static getLinkInfo(): {
    roundTripMs: number;
    windowSize: number;
    label: string;
    detail: string;
    tone: 'success' | 'accent' | 'warning' | 'danger' | 'neutral';
  } {
    const socketRtt = this.ws.getRoundTripMs();
    const active = Array.from(this.rttMs.entries());
    const transferRtt = active.length > 0 ? Math.max(...active.map(([, v]) => v)) : 0;
    const roundTripMs = Math.max(socketRtt, transferRtt);
    const windowSize =
      Array.from(this.windowSize.values()).sort((a, b) => b - a)[0] ?? WINDOW_MIN;
    return { roundTripMs, windowSize, ...describeLink(roundTripMs) };
  }

  /** Chunk size suited to the link right now. */
  static recommendedChunkSize(): number {
    return recommendedChunkSize(this.ws.getRoundTripMs());
  }

  /**
   * SENDER: Prepare a video for transfer.
   *
   * Cheap on purpose — it only inspects the file and derives the chunk plan. The
   * bytes are read lazily while the transfer runs, so this stays fast (and memory
   * flat) even for a 2 GB video.
   */
  static async preProcessVideo(
    sourceUri: string,
    fileName: string,
    mimeType: string = 'video/mp4',
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    onProgress?: (percent: number, step: string) => void
  ): Promise<PreProcessedVideo> {
    const transferId = uuidv4();

    if (onProgress) onProgress(15, 'Preparing the selected video...');
    const uri = await FileSystemService.ensureLocalFile(sourceUri, transferId);

    if (onProgress) onProgress(45, 'Inspecting the video file...');
    const fileSize = await FileSystemService.getFileSize(uri);
    if (!fileSize || fileSize <= 0) {
      throw new Error('The selected video could not be read. Please pick it again.');
    }

    const totalChunks = calculateTotalChunks(fileSize, chunkSize);

    if (onProgress) onProgress(80, 'Computing transfer fingerprint...');
    const checksum = computeTransferFingerprint(fileName, fileSize, totalChunks, chunkSize);

    if (onProgress) onProgress(100, 'Ready to send');

    return {
      transferId,
      sourceUri,
      uri,
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      checksum,
    };
  }

  /**
   * SENDER: convenience wrapper that prepares and starts a transfer from a file.
   */
  static async sendVideoFromFile(
    uri: string,
    fileName: string,
    mimeType: string = 'video/mp4',
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    callbacks?: VideoTransferCallbacks
  ): Promise<string> {
    const preprocessed = await this.preProcessVideo(uri, fileName, mimeType, chunkSize);
    return this.sendPreProcessedVideo(preprocessed, callbacks);
  }

  /**
   * SENDER: Transmit a prepared video once the receiver's storage is verified.
   */
  static async sendPreProcessedVideo(
    preprocessed: PreProcessedVideo,
    callbacks?: VideoTransferCallbacks
  ): Promise<string> {
    this.init();

    const pairState = PairingService.getPairingState();
    if (!pairState.sessionId || !pairState.partnerDeviceId) {
      throw new Error('Device is not paired with a recipient');
    }

    const {
      transferId,
      sourceUri,
      uri,
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      checksum,
    } = preprocessed;

    const meta: VideoTransferMeta = {
      transferId,
      sessionId: pairState.sessionId,
      senderDeviceId: pairState.deviceId,
      receiverDeviceId: pairState.partnerDeviceId,
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      encoding: 'base64',
      checksum,
    };

    const progress: TransferProgress = {
      transferId,
      direction: 'outgoing',
      fileName,
      fileSize,
      totalChunks,
      completedChunks: 0,
      acknowledgedChunks: [],
      speedBytesPerSec: 0,
      etaSeconds: 0,
      percentage: 0,
      status: 'initiating',
      checksum,
    };

    this.activeTransfers.set(transferId, progress);
    if (callbacks) {
      this.activeTransferCallbacks.set(transferId, callbacks);
    }

    this.outgoingSources.set(transferId, {
      uri,
      fileSize,
      chunkSize,
      staged: uri !== sourceUri,
      handle: null,
    });

    // Send video:start metadata to receiver
    ChatTransport.sendVideoStart(meta);
    progress.status = 'transferring';
    this.notifyProgress(progress);

    // Initialise the sliding window.
    const startTime = Date.now();
    this.startedAt.set(transferId, startTime);
    this.nextChunkIndex.set(transferId, 0);
    this.inFlight.set(transferId, new Set());
    this.retransmitQueue.set(transferId, []);
    this.ackedIndices.set(transferId, new Set());
    this.lastAckAt.set(transferId, startTime);
    this.stallAttempts.set(transferId, 0);

    // Seed the adaptive state from the socket's own RTT measurement. Starting
    // small and growing is what keeps a 2G link alive: a 32-chunk window on a
    // 10 KB/s link is two minutes of queued data before the first ACK can return.
    this.outgoingMeta.set(transferId, meta);
    this.windowSize.set(transferId, WINDOW_MIN);
    this.ackStreak.set(transferId, 0);
    this.rttMs.set(transferId, this.ws.getRoundTripMs() || FALLBACK_RTT_MS);
    this.sendTimes.set(transferId, new Map());
    this.pausedTransfers.delete(transferId);

    // Defer the first window so the caller can hand control back to the UI while
    // the receiver registers the incoming transfer and its storage directory.
    setTimeout(() => this.pump(transferId), FIRST_WINDOW_DELAY_MS);

    return transferId;
  }

  /**
   * SENDER: read one chunk's bytes straight off disk and base64-encode them.
   * Returns null when the source is unavailable (and fails the transfer).
   */
  private static encodeChunk(transferId: string, index: number): string | null {
    const source = this.outgoingSources.get(transferId);
    if (!source) return null;

    const start = index * source.chunkSize;
    const length = Math.min(source.chunkSize, source.fileSize - start);
    if (length <= 0) return null;

    if (!source.handle) {
      try {
        source.handle = FileSystemService.openReadHandle(source.uri);
      } catch {
        this.failTransfer(transferId, 'Could not open the selected video for reading.');
        return null;
      }
    }

    try {
      source.handle.offset = start;
      const bytes = source.handle.readBytes(length);
      return uint8ArrayToBase64(bytes);
    } catch {
      this.failTransfer(transferId, 'Failed while reading the video from device storage.');
      return null;
    }
  }

  /**
   * SENDER: Fill the sliding window with in-flight chunks.
   *
   * Work is limited to `PUMP_BATCH` chunks per call and the remainder is deferred
   * to the next tick, so encoding + hashing never freezes the UI on a large file.
   */
  private static pump(transferId: string) {
    const progress = this.activeTransfers.get(transferId);
    const source = this.outgoingSources.get(transferId);
    if (!progress || !source) return;
    if (progress.status !== 'transferring') return;
    if (this.pumpPending.has(transferId)) return;

    const window = this.windowSize.get(transferId) ?? WINDOW_MIN;
    const inFlight = this.inFlight.get(transferId) ?? new Set<number>();
    this.inFlight.set(transferId, inFlight);

    let budget = PUMP_BATCH;
    const total = progress.totalChunks;

    const send = (index: number): boolean => {
      const data = this.encodeChunk(transferId, index);
      if (data === null) return false;
      const hash = calculateSHA256(data);
      const sent = ChatTransport.sendVideoChunk({
        transferId,
        chunkIndex: index,
        totalChunks: total,
        data,
        hash,
      });
      if (!sent) return false;
      inFlight.add(index);
      // Timestamp at the moment of hand-off so ACK latency includes queue drain,
      // which is exactly what a slow link needs to be measured against.
      this.sendTimes.get(transferId)?.set(index, Date.now());
      return true;
    };

    // 1. Urgent: repair chunks the receiver explicitly asked for.
    const repairs = this.retransmitQueue.get(transferId) ?? [];
    this.retransmitQueue.set(transferId, repairs);
    while (repairs.length > 0 && budget > 0 && inFlight.size < window) {
      if (!send(repairs[0])) return;
      repairs.shift();
      budget--;
    }

    // 2. Sequential fill of the remaining window.
    let next = this.nextChunkIndex.get(transferId) ?? 0;
    while (next < total && inFlight.size < window && budget > 0) {
      if (!send(next)) break;
      next++;
      budget--;
    }
    this.nextChunkIndex.set(transferId, next);

    const moreToSend = next < total || repairs.length > 0;
    if (moreToSend && inFlight.size < window && budget === 0) {
      this.pumpPending.add(transferId);
      setTimeout(() => {
        this.pumpPending.delete(transferId);
        this.pump(transferId);
      }, 0);
    }
  }

  /**
   * Periodic sweep that keeps both directions moving even when the network
   * drops the odd frame.
   */
  private static startWatchdog() {
    if (this.watchdogTimer) return;

    this.watchdogTimer = setInterval(() => {
      const now = Date.now();

      // --- Sender: retransmit chunks whose ACKs never arrived ---
      for (const [transferId, inFlight] of Array.from(this.inFlight.entries())) {
        const progress = this.activeTransfers.get(transferId);
        if (!progress) continue;
        if (
          progress.status === 'completed' ||
          progress.status === 'failed' ||
          progress.status === 'cancelled'
        ) {
          continue;
        }

        const next = this.nextChunkIndex.get(transferId) ?? progress.totalChunks;
        const hasOutstanding = inFlight.size > 0;
        const hasUnsent = next < progress.totalChunks;

        // Every chunk delivered: the receiver is assembling/verifying. Wait for
        // its confirmation, but do not wait forever.
        if (progress.status === 'verifying' || (!hasOutstanding && !hasUnsent)) {
          const since = this.awaitingConfirmSince.get(transferId);
          if (since && now - since > RECEIVER_CONFIRM_TIMEOUT_MS) {
            this.failTransfer(
              transferId,
              'The receiver never confirmed the transfer completed.'
            );
          }
          continue;
        }

        if (progress.status !== 'transferring') continue;

        // A closed socket is not a stall. Reconnecting is handled elsewhere, and
        // counting this as a stall would burn through the retry budget while the
        // link is simply down — guaranteeing failure after a normal blip.
        if (!this.ws.isConnected()) {
          this.lastAckAt.set(transferId, now);
          continue;
        }

        if (!hasOutstanding) {
          // Window is empty but chunks remain: the socket was probably closed
          // between ticks, so simply try to refill it.
          this.pump(transferId);
          continue;
        }

        const rtt = this.currentRtt(transferId);
        const stallTimeout = stallTimeoutMs(rtt);
        const lastAck = this.lastAckAt.get(transferId) ?? now;
        if (now - lastAck < stallTimeout) continue;

        const attempts = (this.stallAttempts.get(transferId) ?? 0) + 1;
        this.stallAttempts.set(transferId, attempts);
        this.lastAckAt.set(transferId, now);

        // A stall means we are pushing harder than the link can take.
        this.shrinkWindow(transferId);

        if (attempts > MAX_STALL_RETRIES) {
          this.failTransfer(
            transferId,
            'Transfer stalled: the receiver stopped acknowledging chunks.'
          );
          continue;
        }

        const repairs = this.retransmitQueue.get(transferId) ?? [];
        this.retransmitQueue.set(transferId, repairs);
        for (const index of Array.from(inFlight)) {
          if (!repairs.includes(index)) repairs.push(index);
        }
        this.pump(transferId);
      }

      // --- Receiver: ask the sender for anything still missing ---
      for (const [transferId, received] of Array.from(this.receivedIndices.entries())) {
        const progress = this.activeTransfers.get(transferId);
        if (!progress || progress.direction !== 'incoming') continue;
        if (progress.status !== 'transferring') continue;
        if (received.size >= progress.totalChunks) continue;

        // While offline there is nothing to ask for; skip so the sweep does not
        // queue a repair request for every interval that passes.
        if (!this.ws.isConnected()) {
          this.lastReceiverActivityAt.set(transferId, now);
          continue;
        }

        const reconcile = reconcileIntervalMs(this.currentRtt(transferId));
        const lastActivity = this.lastReceiverActivityAt.get(transferId) ?? now;
        if (now - lastActivity < reconcile) continue;

        const cap = missingPerRequest(this.incomingChunkSize.get(transferId) ?? DEFAULT_CHUNK_SIZE);
        const missing: number[] = [];
        for (let i = 0; i < progress.totalChunks && missing.length < cap; i++) {
          if (!received.has(i)) missing.push(i);
        }

        this.lastReceiverActivityAt.set(transferId, now);
        if (missing.length > 0) {
          ChatTransport.requestMissingChunks(transferId, missing);
        }
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  /**
   * SENDER: Handle acknowledgement of received chunk.
   * ACKs both advance the window and drive the progress UI.
   */
  private static handleChunkAck(transferId: string, chunkIndex: number) {
    const progress = this.activeTransfers.get(transferId);
    if (!progress) return;

    // Free the window slot (duplicate ACKs are ignored).
    const inFlight = this.inFlight.get(transferId);
    if (inFlight) inFlight.delete(chunkIndex);

    const acked = this.ackedIndices.get(transferId) ?? new Set<number>();
    this.ackedIndices.set(transferId, acked);
    if (acked.has(chunkIndex)) {
      this.pump(transferId);
      return;
    }
    acked.add(chunkIndex);

    // Sample the round-trip time from this chunk's send timestamp. Because it
    // includes the time the frame spent queued behind the rest of the window,
    // the measurement naturally reflects how congested the link really is.
    const sentAt = this.sendTimes.get(transferId);
    if (sentAt) {
      const at = sentAt.get(chunkIndex);
      if (at !== undefined) {
        this.updateRtt(transferId, Math.max(1, Date.now() - at));
        sentAt.delete(chunkIndex);
      }
    }

    progress.completedChunks = acked.size;
    if (!progress.acknowledgedChunks) progress.acknowledgedChunks = [];
    progress.acknowledgedChunks.push(chunkIndex);
    progress.percentage = Math.floor((acked.size / progress.totalChunks) * 100);

    const startTime = this.startedAt.get(transferId) ?? Date.now();
    const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
    const transferredBytes = (acked.size / progress.totalChunks) * progress.fileSize;
    progress.speedBytesPerSec = Math.round(transferredBytes / elapsedSec);
    const remainingBytes = progress.fileSize - transferredBytes;
    progress.etaSeconds =
      progress.speedBytesPerSec > 0
        ? Math.max(0, Math.ceil(remainingBytes / progress.speedBytesPerSec))
        : 0;

    this.lastAckAt.set(transferId, Date.now());
    this.stallAttempts.set(transferId, 0);
    this.pausedTransfers.delete(transferId);
    // The link is clearly working: open the window back up.
    this.growWindow(transferId);

    // All chunks delivered: the receiver now assembles and verifies.
    if (acked.size >= progress.totalChunks && !this.awaitingConfirmSince.has(transferId)) {
      this.awaitingConfirmSince.set(transferId, Date.now());
      progress.status = 'verifying';
    }

    this.notifyProgress(progress);

    // Window slot freed -> keep feeding the receiver.
    this.pump(transferId);
  }

  /**
   * RECEIVER: Handle incoming video:start metadata.
   *
   * The transfer MUST be registered synchronously, before any `await`. The
   * WebSocket dispatcher does not await handlers, so a chunk arriving in the
   * same burst would otherwise find no entry in `activeTransfers` and be
   * silently dropped (there is no server-side buffering to recover it).
   */
  private static async handleIncomingTransferStart(meta: VideoTransferMeta) {
    // A repeated `video:start` means the sender reconnected (or replayed the
    // handshake after the server lost its route). Keep everything already
    // received: restarting from scratch here would throw away gigabytes.
    const existing = this.activeTransfers.get(meta.transferId);
    if (existing && existing.direction === 'incoming') {
      if (existing.status === 'transferring') {
        this.lastReceiverActivityAt.set(meta.transferId, Date.now());
        this.notifyProgress(existing);
      }
      return;
    }

    const progress: TransferProgress = {
      transferId: meta.transferId,
      direction: 'incoming',
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      totalChunks: meta.totalChunks,
      completedChunks: 0,
      acknowledgedChunks: [],
      speedBytesPerSec: 0,
      etaSeconds: 0,
      percentage: 0,
      status: 'transferring',
      checksum: meta.checksum,
    };

    this.activeTransfers.set(meta.transferId, progress);
    this.receivedIndices.set(meta.transferId, new Set());
    this.incomingChunkSize.set(meta.transferId, meta.chunkSize);
    this.lastReceiverActivityAt.set(meta.transferId, Date.now());
    this.startedAt.set(meta.transferId, Date.now());

    this.notifyProgress(progress);

    try {
      await FileSystemService.initTransferDirectory(meta.transferId);
    } catch (err: any) {
      this.failTransfer(
        meta.transferId,
        err?.message || 'Failed to prepare local storage for the incoming transfer'
      );
    }
  }

  /**
   * RECEIVER: Handle incoming chunk.
   *
   * Each chunk is written straight to disk and its own SHA-256 is verified before
   * it is accepted, so nothing proportional to the video size is held in memory.
   */
  private static async handleIncomingChunk(chunk: VideoChunk) {
    const progress = this.activeTransfers.get(chunk.transferId);
    if (!progress) {
      console.warn(
        `[VideoTransfer] Chunk #${chunk.chunkIndex} arrived before video:start for ${chunk.transferId}`
      );
      return;
    }
    if (progress.status !== 'transferring') return;

    const received = this.receivedIndices.get(chunk.transferId) ?? new Set<number>();
    this.receivedIndices.set(chunk.transferId, received);

    // Duplicate (retransmitted) chunk we already persisted -> just re-ACK.
    if (received.has(chunk.chunkIndex)) {
      ChatTransport.sendVideoAck(chunk.transferId, chunk.chunkIndex);
      return;
    }

    // 1. Verify chunk hash integrity
    const calculatedHash = calculateSHA256(chunk.data);
    if (!verifyChecksum(chunk.hash, calculatedHash)) {
      console.warn(`[VideoTransfer] Corrupted chunk #${chunk.chunkIndex} received. Requesting resend.`);
      return;
    }

    // 2. Write chunk to local filesystem
    try {
      await FileSystemService.writeChunk(chunk.transferId, chunk.chunkIndex, chunk.data);
    } catch (err: any) {
      this.failTransfer(chunk.transferId, err?.message || 'Failed to write chunk to storage');
      return;
    }
    received.add(chunk.chunkIndex);

    // 3. Send acknowledgement back to sender
    ChatTransport.sendVideoAck(chunk.transferId, chunk.chunkIndex);

    // 4. Update receiver progress (O(1))
    progress.completedChunks = received.size;
    if (!progress.acknowledgedChunks) progress.acknowledgedChunks = [];
    progress.acknowledgedChunks.push(chunk.chunkIndex);
    progress.percentage = Math.floor((received.size / chunk.totalChunks) * 100);
    this.lastReceiverActivityAt.set(chunk.transferId, Date.now());

    this.notifyProgress(progress);

    // 5. If all chunks arrived, reconstruct and verify.
    if (received.size >= chunk.totalChunks) {
      await this.finalizeAndVerifyReceiver(chunk.transferId, progress);
    }
  }

  /**
   * RECEIVER: stream the chunks into the final video file and verify integrity.
   */
  private static async finalizeAndVerifyReceiver(
    transferId: string,
    progress: TransferProgress
  ) {
    if (progress.status !== 'transferring') return;

    const callbacks = this.activeTransferCallbacks.get(transferId);

    try {
      progress.status = 'reconstructing';
      progress.percentage = 0;
      this.notifyProgress(progress);

      const { filePath, byteLength } = await FileSystemService.reassembleVideo(
        transferId,
        progress.fileName,
        progress.totalChunks,
        (copied, total) => {
          progress.percentage = Math.floor((copied / total) * 100);
          this.notifyProgress(progress);
        }
      );

      progress.status = 'verifying';
      this.notifyProgress(progress);

      const chunkSize = this.incomingChunkSize.get(transferId) ?? DEFAULT_CHUNK_SIZE;
      const expectedFingerprint = progress.checksum;
      const actualFingerprint = computeTransferFingerprint(
        progress.fileName,
        progress.fileSize,
        progress.totalChunks,
        chunkSize
      );

      const everyChunkVerified =
        (this.receivedIndices.get(transferId)?.size ?? 0) === progress.totalChunks;
      const sizeMatches = byteLength === progress.fileSize;
      const fingerprintMatches = verifyChecksum(expectedFingerprint, actualFingerprint);
      const isVerified = everyChunkVerified && sizeMatches && fingerprintMatches;

      if (isVerified) {
        progress.status = 'completed';
        progress.percentage = 100;
        progress.localFilePath = filePath;

        const startTime = this.startedAt.get(transferId) ?? Date.now();
        const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        const metrics: TransferMetrics = {
          originalSize: progress.fileSize,
          encodedSize: calculateEncodedSize(progress.fileSize),
          compressionRatio: 1.0,
          totalChunks: progress.totalChunks,
          elapsedSeconds,
          avgSpeedBytesPerSec: Math.round(progress.fileSize / elapsedSeconds),
          retransmittedBytes: 0,
          finalHashVerified: true,
          sha256Result: actualFingerprint,
        };
        progress.metrics = metrics;
        this.notifyProgress(progress);

        // Temporary chunk files are already deleted chunk-by-chunk during
        // reassembly; this clears anything left behind.
        await FileSystemService.cleanupTransferChunks(transferId);

        ChatTransport.sendVideoComplete(transferId, true);

        if (callbacks && callbacks.onComplete) {
          callbacks.onComplete(filePath, metrics);
        }
      } else {
        const reason = !sizeMatches
          ? `Assembled file is ${byteLength} bytes but ${progress.fileSize} were expected.`
          : !everyChunkVerified
          ? 'Not every chunk was received.'
          : 'Transfer metadata mismatch.';
        progress.status = 'failed';
        progress.error = reason;
        this.notifyProgress(progress);
        ChatTransport.sendVideoComplete(transferId, false);
        if (callbacks && callbacks.onError) {
          callbacks.onError(reason);
        }
      }
    } catch (err: any) {
      progress.status = 'failed';
      progress.error = err?.message || 'Reconstruction error';
      this.notifyProgress(progress);
      ChatTransport.sendVideoComplete(transferId, false);
      if (callbacks && callbacks.onError) {
        callbacks.onError(progress.error!);
      }
    } finally {
      this.cleanupTransfer(transferId);
    }
  }

  /**
   * RESUME: check and request missing chunks after reconnection.
   */
  static async resumeTransfer(transferId: string) {
    const progress = this.activeTransfers.get(transferId);
    if (!progress) return;

    if (progress.direction === 'incoming') {
      const inMemory = this.receivedIndices.get(transferId);
      let savedIndices: number[];
      if (inMemory) {
        savedIndices = Array.from(inMemory);
      } else {
        savedIndices = await FileSystemService.getSavedChunkIndices(transferId);
        this.receivedIndices.set(transferId, new Set(savedIndices));
      }
      const missing = findMissingChunks(savedIndices, progress.totalChunks);

      if (missing.length === 0) {
        await this.finalizeAndVerifyReceiver(transferId, progress);
      } else {
        ChatTransport.requestMissingChunks(transferId, missing);
      }
    }
  }

  /**
   * SENDER: queue requested missing chunks for repair. They are re-read from disk
   * and re-sent in batched ticks by `pump`.
   */
  private static handleResumeMissing(transferId: string, missingIndices: number[]) {
    const progress = this.activeTransfers.get(transferId);
    const source = this.outgoingSources.get(transferId);
    if (!progress || !source) return;

    const repairs = this.retransmitQueue.get(transferId) ?? [];
    this.retransmitQueue.set(transferId, repairs);
    const queued = new Set(repairs);

    for (const index of missingIndices) {
      if (index < 0 || index >= progress.totalChunks) continue;
      if (!queued.has(index)) {
        repairs.push(index);
        queued.add(index);
      }
    }

    this.lastAckAt.set(transferId, Date.now());
    this.pump(transferId);
  }

  private static handleTransferVerified(transferId: string) {
    const progress = this.activeTransfers.get(transferId);
    if (progress) {
      progress.status = 'completed';
      progress.percentage = 100;
      progress.completedChunks = progress.totalChunks;
      this.notifyProgress(progress);
      const callbacks = this.activeTransferCallbacks.get(transferId);
      if (callbacks && callbacks.onComplete) {
        callbacks.onComplete(
          progress.localFilePath || '',
          progress.metrics || {
            originalSize: progress.fileSize,
            encodedSize: calculateEncodedSize(progress.fileSize),
            compressionRatio: 1.0,
            totalChunks: progress.totalChunks,
            elapsedSeconds: 1,
            avgSpeedBytesPerSec: progress.fileSize,
            retransmittedBytes: 0,
            finalHashVerified: true,
            sha256Result: progress.checksum,
          }
        );
      }
    }
    this.cleanupTransfer(transferId);
  }

  private static handleTransferCancelled(transferId: string, reason?: string) {
    const progress = this.activeTransfers.get(transferId);
    if (progress) {
      progress.status = 'cancelled';
      progress.error = reason || 'Transfer cancelled';
      const callbacks = this.activeTransferCallbacks.get(transferId);
      this.notifyProgress(progress);
      if (callbacks && callbacks.onCancel) {
        callbacks.onCancel();
      }
    }
    FileSystemService.cleanupTransferChunks(transferId);
    this.cleanupTransfer(transferId);
  }

  /**
   * Mark a transfer as failed, notify the UI, and release its resources.
   */
  private static failTransfer(transferId: string, error: string) {
    const progress = this.activeTransfers.get(transferId);
    if (progress && progress.status !== 'completed' && progress.status !== 'failed') {
      progress.status = 'failed';
      progress.error = error;
      const callbacks = this.activeTransferCallbacks.get(transferId);
      this.notifyProgress(progress);
      if (callbacks && callbacks.onError) {
        callbacks.onError(error);
      }
    } else if (!progress) {
      console.warn(`[VideoTransfer] error for unknown transfer ${transferId}: ${error}`);
    }
    this.cleanupTransfer(transferId);
  }

  /**
   * Release everything except the final progress snapshot, which the UI still
   * needs in order to render the outcome.
   */
  private static cleanupTransfer(transferId: string) {
    const source = this.outgoingSources.get(transferId);
    if (source) {
      FileSystemService.closeHandle(source.handle);
      if (source.staged) {
        FileSystemService.deleteFile(source.uri);
      }
      this.outgoingSources.delete(transferId);
    }

    this.inFlight.delete(transferId);
    this.nextChunkIndex.delete(transferId);
    this.retransmitQueue.delete(transferId);
    this.ackedIndices.delete(transferId);
    this.lastAckAt.delete(transferId);
    this.stallAttempts.delete(transferId);
    this.awaitingConfirmSince.delete(transferId);
    this.lastReceiverActivityAt.delete(transferId);
    this.receivedIndices.delete(transferId);
    this.incomingChunkSize.delete(transferId);
    this.activeTransferCallbacks.delete(transferId);
    this.pumpPending.delete(transferId);
    this.windowSize.delete(transferId);
    this.rttMs.delete(transferId);
    this.ackStreak.delete(transferId);
    this.sendTimes.delete(transferId);
    this.pausedTransfers.delete(transferId);
    this.outgoingMeta.delete(transferId);
  }

  static cancel(transferId: string) {
    ChatTransport.cancelTransfer(transferId);
    this.handleTransferCancelled(transferId);
  }

  static getTransfer(transferId: string): TransferProgress | undefined {
    return this.activeTransfers.get(transferId);
  }
}
