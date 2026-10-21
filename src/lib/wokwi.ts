import type { PinKind, PinMapping } from '../types/controller';

export const PIN_KIND_LABEL: Record<PinKind, string> = {
  motor: 'Motor driver',
  servo: 'Servo',
  relay: 'Relay',
  sensor: 'Sensor',
  led: 'Indicator',
  other: 'Other',
};

const KIND_ORDER: PinKind[] = ['motor', 'servo', 'relay', 'sensor', 'led', 'other'];

const KIND_RULES: [PinKind, RegExp][] = [
  ['servo', /servo/i],
  ['relay', /relay/i],
  ['motor', /motor|wheel|drive|esc|thrust|stepper|l298|l293|drv|a4988|\b(?:ena|enb|in[1-4]|pwm|step|dir)\b/i],
  ['led', /led|buzzer|neopixel|lamp/i],
  ['sensor', /sensor|trig|echo|ldr|dht|pir|mpu|sr04|button|btn|switch|pot|photo|ultrasonic|encoder/i],
];

const BOARD = /arduino|esp32|esp8266|pi-pico|stm32|attiny|nano|mega|uno/i;
const PIN_TOKEN = /^(?:GPIO_NUM_|GPIO|IO|D|A)?\d{1,2}$/i;
const PINISH_NAME = /pin|motor|servo|relay|led|trig|echo|sensor|btn|button|buzzer|pwm|\b(?:ena|enb|in[1-4]|dir|step)\b/i;

const classify = (text: string): PinKind =>
  KIND_RULES.find(([, rule]) => rule.test(text.replace(/[_.\-:]/g, ' ')))?.[0] ?? 'other';

function formatPin(token: string, esp: boolean): string {
  const analog = /^A(\d+)$/i.exec(token);
  if (analog) return `A${analog[1]}`;
  const digits = token.replace(/\D/g, '');
  return esp ? `GPIO${digits}` : `D${digits}`;
}

export function parseWokwiUrl(value: string): string | null {
  const match = /^(?:https?:\/\/)?(?:www\.)?wokwi\.com\/(?:[\w-]+\/)*projects\/(\d+)/i.exec(value.trim());
  return match ? `https://wokwi.com/projects/${match[1]}` : null;
}

function fromSketch(sketch: string): PinMapping[] {
  const code = sketch.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const esp = /esp32|esp_|ledcAttach|GPIO_NUM_|WiFi\.h/i.test(code);
  const consts = new Map<string, string>();
  for (const match of code.matchAll(/#define\s+(\w+)\s+((?:GPIO_NUM_|[AD])?\d{1,2})\b/gi)) consts.set(match[1], match[2]);
  for (const match of code.matchAll(/\b(?:u?int(?:8|16|32)?_t|int|byte|short|gpio_num_t)\s+(\w+)\s*=\s*((?:GPIO_NUM_|[AD])?\d{1,2})\s*;/gi)) {
    consts.set(match[1], match[2]);
  }

  const found = new Map<string, PinMapping>();
  const add = (token: string, label: string, kind: PinKind) => {
    const pin = formatPin(token, esp);
    found.set(`${pin}|${label}`, { pin, label, kind, source: 'sketch' });
  };

  const used = new Set<string>();
  const usage = /\b(pinMode|digitalWrite|analogWrite|digitalRead|analogRead|ledcAttachPin|ledcAttach|\w+\.attach)\s*\(\s*(\w+)/g;
  for (const match of code.matchAll(usage)) {
    const fn = match[1];
    const arg = match[2];
    const token = consts.get(arg) ?? (PIN_TOKEN.test(arg) ? arg : undefined);
    if (!token) continue;
    const label = consts.has(arg) ? arg : fn.endsWith('.attach') ? fn.replace('.attach', '') : `${fn}(${arg})`;
    const kind = classify(label);
    const fallback: PinKind = /Read$/.test(fn) ? 'sensor' : fn.endsWith('.attach') ? 'servo' : 'other';
    add(token, label, kind === 'other' ? fallback : kind);
    used.add(arg);
  }
  for (const [name, token] of consts) {
    if (!used.has(name) && PINISH_NAME.test(name.replace(/_/g, ' '))) add(token, name, classify(name));
  }
  return [...found.values()];
}

interface DiagramPart {
  id?: string;
  type?: string;
}

function fromDiagram(diagram: string): PinMapping[] {
  const parsed = JSON.parse(diagram) as { parts?: unknown; connections?: unknown } | null;
  const parts = Array.isArray(parsed?.parts) ? (parsed.parts as DiagramPart[]) : [];
  const connections = Array.isArray(parsed?.connections) ? parsed.connections : [];
  const types = new Map(parts.map((part) => [part.id ?? '', part.type ?? '']));
  const esp = parts.some((part) => /esp32|esp8266/i.test(part.type ?? ''));

  const found: PinMapping[] = [];
  for (const connection of connections) {
    if (!Array.isArray(connection)) continue;
    const [a, b] = connection as unknown[];
    if (typeof a !== 'string' || typeof b !== 'string') continue;
    for (const [mcuEnd, otherEnd] of [[a, b], [b, a]]) {
      const [mcuId, mcuPin = ''] = mcuEnd.split(':');
      const [otherId, otherPin = ''] = otherEnd.split(':');
      const otherType = types.get(otherId) ?? '';
      if (!BOARD.test(types.get(mcuId) ?? '') || BOARD.test(otherType) || !PIN_TOKEN.test(mcuPin)) continue;
      found.push({
        pin: formatPin(mcuPin, esp),
        label: `${otherId}:${otherPin}`,
        kind: classify(`${otherType} ${otherId} ${otherPin}`),
        source: 'diagram',
      });
    }
  }
  return found;
}

export function extractPins(sketch: string, diagram: string): { pins: PinMapping[]; diagramError: string | null } {
  let wired: PinMapping[] = [];
  let diagramError: string | null = null;
  if (diagram.trim()) {
    try {
      wired = fromDiagram(diagram);
    } catch {
      diagramError = "diagram.json isn't valid JSON. Check for a missing comma, quote, or bracket.";
    }
  }

  const byPin = new Map<string, PinMapping>();
  for (const entry of [...wired, ...fromSketch(sketch)]) {
    if (!byPin.has(entry.pin)) byPin.set(entry.pin, entry);
  }
  const pins = [...byPin.values()].sort(
    (a, b) =>
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      a.pin.localeCompare(b.pin, undefined, { numeric: true }),
  );
  return { pins, diagramError };
}
