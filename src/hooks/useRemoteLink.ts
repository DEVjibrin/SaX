import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { type DataConnection, type MediaConnection } from 'peerjs';
import { NO_STATS, peerOptions, readVideoStats } from '../lib/peer';
import type { Telemetry } from '../types/controller';
import type { LinkStats, RemoteStatus, RobotHello, RobotMessage, RobotState } from '../types/link';

const OFFLINE: RobotState = { serial: 'disconnected', battery: null };

export function useRemoteLink(session: string | null) {
  const [status, setStatus] = useState<RemoteStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hello, setHello] = useState<RobotHello | null>(null);
  const [robot, setRobot] = useState<RobotState>(OFFLINE);
  const [stats, setStats] = useState<LinkStats>(NO_STATS);
  const [attempt, setAttempt] = useState(0);

  const connRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    setStream(null);
    setHello(null);
    setRobot(OFFLINE);
    seq.current = 0;

    if (!session) {
      setError('This link has no session code. Scan the QR code on the robot again.');
      setStatus('error');
      return undefined;
    }
    setError(null);
    setStatus('connecting');

    const peer = new Peer(peerOptions());

    peer.on('open', () => {
      const conn = peer.connect(session, { serialization: 'json', reliable: false });
      connRef.current = conn;
      const closed = () => setStatus((current) => (current === 'error' ? current : 'closed'));

      conn.on('open', () => setStatus('connected'));
      conn.on('data', (data) => {
        const message = data as RobotMessage | null;
        if (message?.type === 'hello') {
          setHello({ name: message.name, badge: message.badge, tilt: message.tilt });
        } else if (message?.type === 'state') {
          setRobot({ serial: message.serial, battery: message.battery });
        }
      });
      conn.on('close', closed);
      conn.on('error', closed);
    });

    // Handle incoming video call from the Node
    peer.on('call', (call) => {
      callRef.current = call;
      // Answer WITHOUT passing a local stream, because the Remote only receives video
      call.answer();
      call.on('stream', (remoteStream) => {
        setStream(remoteStream);
      });
      call.on('close', () => setStream(null));
      call.on('error', () => setStream(null));
    });

    peer.on('error', (failure) => {
      const type = (failure as { type?: string }).type;
      setError(
        type === 'peer-unavailable'
          ? "The robot isn't available. Check that its QR code is still on screen, then try again."
          : "Can't reach the pairing service. Check your internet connection.",
      );
      setStatus('error');
    });

    return () => {
      peer.destroy();
      connRef.current = null;
      callRef.current = null;
    };
  }, [session, attempt]);

  useEffect(() => {
    if (status !== 'connected') {
      setStats(NO_STATS);
      return undefined;
    }
    const timer = window.setInterval(async () => {
      const pc = callRef.current?.peerConnection;
      if (pc) setStats(await readVideoStats(pc, 'inbound').catch(() => NO_STATS));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const send = useCallback((telemetry: Telemetry) => {
    const conn = connRef.current;
    if (conn?.open) conn.send({ type: 'control', seq: ++seq.current, ...telemetry });
  }, []);

  const reconnect = useCallback(() => setAttempt((current) => current + 1), []);

  return { status, error, stream, hello, robot, stats, send, reconnect };
}