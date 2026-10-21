import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import { NEUTRAL_TELEMETRY } from '../lib/packet';
import { NO_STATS, createSessionId, pairUrl, parseControl, peerOptions, readVideoStats } from '../lib/peer';
import type { SerialStatus, Telemetry } from '../types/controller';
import type { LinkStats, PairStatus, RobotHello } from '../types/link';

const COMMAND_STALE_MS = 400;
const ALIVE_MS = 1000;
const STATE_INTERVAL_MS = 2000;

interface RobotLinkOptions {
  stream: MediaStream | null;
  hello: RobotHello;
  serial: SerialStatus;
  battery: number | null;
}

export function useRobotLink({ stream, hello, serial, battery }: RobotLinkOptions) {
  const [sessionId, setSessionId] = useState(createSessionId);
  const [status, setStatus] = useState<PairStatus>('starting');
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<LinkStats>(NO_STATS);
  const [remoteAlive, setRemoteAlive] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const commandRef = useRef<{ telemetry: Telemetry; seq: number; at: number } | null>(null);
  const helloRef = useRef(hello);

  useEffect(() => {
    helloRef.current = hello;
  }, [hello]);

  useEffect(() => {
    const peer = new Peer(sessionId, peerOptions());
    peerRef.current = peer;
    setStatus('starting');
    setError(null);

    peer.on('open', () => setStatus('waiting'));
    peer.on('disconnected', () => {
      if (!peer.destroyed) peer.reconnect();
    });
    peer.on('error', (failure) => {
      if ((failure as { type?: string }).type === 'unavailable-id') {
        setSessionId(createSessionId());
        return;
      }
      setError("Can't reach the pairing service. Check your internet connection.");
      setStatus('error');
    });
    peer.on('connection', (conn) => {
      if (connRef.current) {
        conn.on('open', () => conn.close());
        return;
      }
      connRef.current = conn;

      const drop = () => {
        if (connRef.current !== conn) return;
        connRef.current = null;
        callRef.current?.close();
        callRef.current = null;
        commandRef.current = null;
        setStatus('waiting');
      };

      conn.on('open', () => {
        conn.send({ type: 'hello', ...helloRef.current });
        setStatus('paired');
      });
      conn.on('data', (data) => {
        const parsed = parseControl(data);
        const previous = commandRef.current;
        if (!parsed || (previous && parsed.seq <= previous.seq)) return;
        const telemetry = helloRef.current.tilt
          ? parsed.telemetry
          : { ...parsed.telemetry, sensors: NEUTRAL_TELEMETRY.sensors };
        commandRef.current = { telemetry, seq: parsed.seq, at: performance.now() };
      });
      conn.on('close', drop);
      conn.on('error', drop);
    });

    return () => {
      peer.destroy();
      peerRef.current = null;
      connRef.current = null;
      callRef.current = null;
      commandRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    const peer = peerRef.current;
    const conn = connRef.current;
    if (status !== 'paired' || !stream || !peer || !conn) return;
    const call = callRef.current;
    if (!call) {
      const next = peer.call(conn.peer, stream);
      callRef.current = next;
      next.on('close', () => {
        if (callRef.current === next) callRef.current = null;
      });
      return;
    }
    const track = stream.getVideoTracks()[0];
    const sender = call.peerConnection.getSenders().find((candidate) => candidate.track?.kind === 'video');
    if (track && sender && sender.track !== track) void sender.replaceTrack(track);
  }, [status, stream]);

  useEffect(() => {
    if (status !== 'paired') {
      setStats(NO_STATS);
      return undefined;
    }
    const timer = window.setInterval(async () => {
      const pc = callRef.current?.peerConnection;
      if (pc) setStats(await readVideoStats(pc, 'outbound').catch(() => NO_STATS));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'paired') return undefined;
    const send = () => connRef.current?.send({ type: 'state', serial, battery });
    send();
    const timer = window.setInterval(send, STATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [status, serial, battery]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const command = commandRef.current;
      setRemoteAlive(command !== null && performance.now() - command.at < ALIVE_MS);
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const getTelemetry = useCallback((): Telemetry => {
    const command = commandRef.current;
    return command && performance.now() - command.at <= COMMAND_STALE_MS ? command.telemetry : NEUTRAL_TELEMETRY;
  }, []);

  const unpair = useCallback(() => setSessionId(createSessionId()), []);

  return { sessionId, pairUrl: pairUrl(sessionId), status, error, stats, remoteAlive, getTelemetry, unpair };
}
