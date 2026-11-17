declare module "signalsmith-stretch" {
  export type StretchSchedule = {
    output?: number;
    active?: boolean;
    input?: number;
    rate?: number;
    semitones?: number;
    tonalityHz?: number;
    formantSemitones?: number;
    formantCompensation?: boolean;
  };
  export interface StretchNode extends AudioWorkletNode {
    inputTime: number;
    schedule(s: StretchSchedule): Promise<unknown>;
    start(when?: number): Promise<unknown>;
    stop(when?: number): Promise<unknown>;
    addBuffers(buffers: Float32Array[]): Promise<number>;
    dropBuffers(toSeconds?: number): Promise<unknown>;
    latency(): Promise<number>;
    configure(c: { blockMs?: number; intervalMs?: number; splitComputation?: boolean; preset?: string }): Promise<unknown>;
  }
  export default function SignalsmithStretch(ctx: BaseAudioContext, options?: AudioWorkletNodeOptions): Promise<StretchNode>;
}
