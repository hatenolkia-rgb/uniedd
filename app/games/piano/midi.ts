/** Web MIDI keyboard input: auto-detects keyboards, follows hot-plugging, reports note on/off. */

export type MidiStatus = "idle" | "asking" | "ready" | "denied" | "unsupported";
export type MidiDevice = { id: string; name: string };
export type MidiNoteEvent = { midi: number; velocity: number; on: boolean; perfTime: number; device: string };

type Access = {
  inputs: Map<string, MidiPort>;
  onstatechange: ((e: Event) => void) | null;
};
type MidiPort = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state: string;
  onmidimessage: ((e: { data: Uint8Array; timeStamp: number }) => void) | null;
};

export function midiSupported() {
  return typeof navigator !== "undefined" && typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === "function";
}

/** Decode one MIDI message into a note event (null for anything else: pedal, clock, etc.). */
export function decodeMidi(data: ArrayLike<number>): { midi: number; velocity: number; on: boolean } | null {
  if (!data || data.length < 3) return null;
  const cmd = data[0] & 0xf0;
  if (cmd === 0x90 && data[2] > 0) return { midi: data[1], velocity: data[2] / 127, on: true };
  if (cmd === 0x80 || (cmd === 0x90 && data[2] === 0)) return { midi: data[1], velocity: 0, on: false };
  return null;
}

export class MidiKeyboard {
  private access: Access | null = null;
  devices: MidiDevice[] = [];
  onNote: ((e: MidiNoteEvent) => void) | null = null;
  onDevices: ((d: MidiDevice[]) => void) | null = null;

  /** Has the user already allowed MIDI on this site? (lets us connect without a prompt) */
  static async alreadyAllowed() {
    try {
      const st = await navigator.permissions.query({ name: "midi" as PermissionName });
      return st.state === "granted";
    } catch {
      return false;
    }
  }

  async connect(): Promise<MidiStatus> {
    if (!midiSupported()) return "unsupported";
    if (this.access) return "ready";
    try {
      const req = (navigator as Navigator & { requestMIDIAccess: (o: { sysex: boolean }) => Promise<Access> }).requestMIDIAccess;
      this.access = await req.call(navigator, { sysex: false });
    } catch {
      return "denied";
    }
    this.access.onstatechange = () => this.attach();
    this.attach();
    return "ready";
  }

  private attach() {
    if (!this.access) return;
    const list: MidiDevice[] = [];
    this.access.inputs.forEach((input) => {
      if (input.state === "disconnected") {
        input.onmidimessage = null;
        return;
      }
      const name = [input.manufacturer, input.name].filter(Boolean).join(" ").trim() || "MIDI keyboard";
      list.push({ id: input.id, name });
      input.onmidimessage = (e) => {
        const n = decodeMidi(e.data);
        if (!n) return;
        // MIDI event timestamps are on the performance.now() clock
        const perfTime = e.timeStamp > 0 ? e.timeStamp : performance.now();
        this.onNote?.({ ...n, perfTime, device: name });
      };
    });
    const changed = list.map((d) => d.id).join() !== this.devices.map((d) => d.id).join();
    this.devices = list;
    if (changed) this.onDevices?.(list);
  }

  disconnect() {
    if (!this.access) return;
    this.access.inputs.forEach((i) => (i.onmidimessage = null));
    this.access.onstatechange = null;
    this.access = null;
    this.devices = [];
  }
}
