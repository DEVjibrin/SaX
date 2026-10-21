import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LogDirection,
  LogEntry,
  SerialApi,
  SerialPortLike,
  SerialStatus,
  WebSerial,
  WebSerialOptions,
} from '../types/controller';
import { NEUTRAL_TELEMETRY, toLine } from '../lib/packet';

interface Session {
  port: SerialPortLike;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  timer: number;
  lastRx: number;
  heard: boolean;
  readLoop: Promise<void>;
}

const encoder = new TextEncoder();
const HEARTBEAT_ACK = /^\{\s*"hb"\s*:/;
const STOP_LINE = `${toLine(NEUTRAL_TELEMETRY)}\n`;

const settle = async (task: Promise<unknown>, ms = 400): Promise<void> => {
  let timeout: number | undefined;
  try {
    await Promise.race([
      task,
      new Promise<void>((resolve) => {
        timeout = window.setTimeout(resolve, ms);
      }),
    ]);
  } catch {
    return;
  } finally {
    window.clearTimeout(timeout);
  }
};

/**
 * Serial bridge to the microcontroller. On every heartbeat it forwards the raw controls and phone
 * sensors as one JSON line. It never interprets them: all logic runs on the firmware.
 */
export function useWebSerial(options: WebSerialOptions = {}): WebSerial {
  const {
    baudRate = 115200,
    heartbeatMs = 100,
    timeoutMs = 500,
    startupGraceMs = 3000,
    telemetry,
    maxLogs = 500,
  } = options;

  const serial = useMemo<SerialApi | null>(
    () =>
      typeof navigator !== 'undefined' && 'serial' in navigator
        ? (navigator as unknown as { serial: SerialApi }).serial
        : null,
    [],
  );

  const [status, setStatus] = useState<SerialStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const busyRef = useRef(false);
  const logId = useRef(0);

  const log = useCallback(
    (direction: LogDirection, message: string) => {
      const entry: LogEntry = { id: ++logId.current, timestamp: Date.now(), direction, message };
      setLogs((current) => [...current.slice(-(maxLogs - 1)), entry]);
    },
    [maxLogs],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  const packet = useCallback(() => toLine(telemetry?.() ?? NEUTRAL_TELEMETRY), [telemetry]);

  const teardown = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    window.clearInterval(session.timer);
    await settle(session.writer.write(encoder.encode(STOP_LINE)));
    await settle(session.writer.close());
    await settle(session.reader.cancel());
    await settle(session.readLoop);
    await settle(session.port.close(), 1000);
  }, []);

  const fail = useCallback(
    async (session: Session, message: string) => {
      if (sessionRef.current !== session) return;
      setStatus('error');
      setError(message);
      log('sys', message);
      await teardown();
    },
    [log, teardown],
  );

  const readLoop = useCallback(
    async (session: Session) => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await session.reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;
          session.lastRx = performance.now();
          session.heard = true;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          if (buffer.length > 4096) {
            lines.push(buffer);
            buffer = '';
          }
          for (const raw of lines) {
            const line = raw.trim();
            if (line && !HEARTBEAT_ACK.test(line)) log('rx', line);
          }
        }
      } catch {
        void fail(session, 'Serial connection lost.');
      } finally {
        session.reader.releaseLock();
      }
      void fail(session, 'The device closed the serial stream.');
    },
    [fail, log],
  );

  const connect = useCallback(async () => {
    if (!serial || busyRef.current || sessionRef.current) return;
    busyRef.current = true;
    setError(null);
    setStatus('connecting');
    try {
      const port = await serial.requestPort();
      await port.open({ baudRate });
      if (!port.readable || !port.writable) throw new Error('The port has no readable or writable stream.');

      const session: Session = {
        port,
        reader: port.readable.getReader(),
        writer: port.writable.getWriter(),
        timer: 0,
        lastRx: performance.now(),
        heard: false,
        readLoop: Promise.resolve(),
      };
      sessionRef.current = session;
      session.readLoop = readLoop(session);
      session.timer = window.setInterval(() => {
        const limit = session.heard ? timeoutMs : startupGraceMs;
        if (performance.now() - session.lastRx > limit) {
          void fail(session, 'Hardware stopped responding. Connection closed.');
          return;
        }
        session.writer
          .write(encoder.encode(`${packet()}\n`))
          .catch(() => void fail(session, 'Lost the connection while sending the heartbeat.'));
      }, heartbeatMs);

      setStatus('connected');
      log('sys', `Connected at ${baudRate} baud. Packets every ${heartbeatMs} ms.`);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotFoundError') {
        setStatus('disconnected');
      } else {
        const message = err instanceof Error ? err.message : 'Unable to open the serial port.';
        setError(message);
        setStatus('error');
        log('sys', message);
      }
    } finally {
      busyRef.current = false;
    }
  }, [serial, baudRate, packet, heartbeatMs, timeoutMs, startupGraceMs, readLoop, fail, log]);

  const disconnect = useCallback(async () => {
    if (sessionRef.current) {
      await teardown();
      log('sys', 'Disconnected.');
    }
    setStatus('disconnected');
    setError(null);
  }, [log, teardown]);

  const send = useCallback(
    async (command: string) => {
      const session = sessionRef.current;
      const text = command.trim();
      if (!session || !text) return false;
      try {
        await session.writer.write(encoder.encode(`${text}\n`));
        log('tx', text);
        return true;
      } catch {
        log('sys', `Failed to send: ${text}`);
        return false;
      }
    },
    [log],
  );

  const teardownRef = useRef(teardown);
  useEffect(() => {
    teardownRef.current = teardown;
  }, [teardown]);
  useEffect(
    () => () => {
      void teardownRef.current();
    },
    [],
  );

  return { isSupported: serial !== null, status, error, logs, connect, disconnect, send, clearLogs, log, packet };
}