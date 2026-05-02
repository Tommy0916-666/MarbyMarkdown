/**
 * 音频管理器 - 使用 Web Audio API 生成和管理音效
 */
import type { WhiteNoiseType } from "./types";

interface ActiveNoise {
  source: AudioNode;
  gain: GainNode;
  type: WhiteNoiseType;
  buffer?: AudioBuffer;
  intervalIds?: number[];
  oscillators?: OscillatorNode[];
}

interface ActiveMusic {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterGain: GainNode;
  type: string;
  currentChordIndex: number;
  chordProgression: number[][];
  melodyInterval?: number;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private whiteNoiseGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private activeNoises: Map<WhiteNoiseType, ActiveNoise> = new Map();
  private activeMusic: ActiveMusic | null = null;
  private isInitialized = false;
  private currentVolume = { whiteNoise: 0.6, music: 0.5, master: 1 };
  private musicInterval: number | null = null;

  // 暂停状态
  private isWhiteNoisePaused = false;
  private isMusicPaused = false;
  // 保存暂停前的状态
  private whiteNoiseStateBeforePause: Map<WhiteNoiseType, boolean> = new Map();

  // 记录是否真正有声音在播放，防止底噪
  private whiteNoiseActuallyPlaying = false;
  private musicActuallyPlaying = false;

  constructor() {}

  /**
   * 初始化音频上下文
   */
  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();

      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = this.currentVolume.master;
      this.masterGain.connect(this.audioContext.destination);

      // 白噪音 gain 先设为 0，避免意外底噪
      this.whiteNoiseGain = this.audioContext.createGain();
      this.whiteNoiseGain.gain.value = 0;
      this.whiteNoiseGain.connect(this.masterGain);

      // 音乐 gain 先设为 0
      this.musicGain = this.audioContext.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.masterGain);

      this.isInitialized = true;
      console.log("🎵 AudioManager initialized (silent)");
    } catch (error) {
      console.error("❌ Audio initialization failed:", error);
    }
  }

  /**
   * 确保音频上下文处于运行状态
   */
  private async ensureAudioContext(): Promise<void> {
    await this.init();
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * 设置白噪音总音量
   */
  setWhiteNoiseVolume(volume: number): void {
    this.currentVolume.whiteNoise = Math.max(0, Math.min(1, volume / 100));
    if (this.whiteNoiseGain && this.whiteNoiseActuallyPlaying) {
      this.whiteNoiseGain.gain.setTargetAtTime(
        this.currentVolume.whiteNoise,
        this.audioContext!.currentTime,
        0.1
      );
    }
  }

  /**
   * 设置音乐总音量
   */
  setMusicVolume(volume: number): void {
    this.currentVolume.music = Math.max(0, Math.min(1, volume / 100));
    if (this.musicGain && this.musicActuallyPlaying) {
      this.musicGain.gain.setTargetAtTime(
        this.currentVolume.music,
        this.audioContext!.currentTime,
        0.1
      );
    }
  }

  /**
   * 智能音量调整
   */
  setSmartVolume(enabled: boolean, isTyping: boolean): void {
    if (!this.masterGain) return;
    const targetVolume = enabled && isTyping ? 0.7 : 1;
    this.masterGain.gain.setTargetAtTime(targetVolume, this.audioContext!.currentTime, 0.5);
  }

  // ==================== 白噪音生成 ====================

  /**
   * 生成基础噪音缓冲区
   */
  private generateNoiseBuffer(type: "white" | "pink" | "brown", duration: number = 2): AudioBuffer {
    if (!this.audioContext) throw new Error("Audio context not initialized");

    const buffer = this.audioContext.createBuffer(
      1,
      this.audioContext.sampleRate * duration,
      this.audioContext.sampleRate
    );
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < buffer.length; i++) {
      const white = Math.random() * 2 - 1;

      switch (type) {
        case "white":
          data[i] = white * 0.5;
          break;
        case "pink":
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.153852;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
          break;
        case "brown":
          b0 = b0 * 0.998 + white * 0.002;
          data[i] = b0 * 0.8;
          break;
      }
    }

    return buffer;
  }

  /**
   * 播放白噪音
   */
  async playWhiteNoise(id: WhiteNoiseType, type: WhiteNoiseType, volume: number): Promise<void> {
    await this.ensureAudioContext();

    if (this.isWhiteNoisePaused) {
      console.log("⏸️ White noise is paused, not playing:", id);
      return;
    }

    // 先停止已有的同类型噪音
    this.stopWhiteNoise(id);

    const noise = this.playNoiseType(type, volume);
    if (noise) {
      this.activeNoises.set(id, noise);
      this.whiteNoiseActuallyPlaying = true;
      this.whiteNoiseGain!.gain.setTargetAtTime(
        this.currentVolume.whiteNoise,
        this.audioContext!.currentTime,
        0.3
      );
    }
  }

  private playNoiseType(type: WhiteNoiseType, volume: number): ActiveNoise | null {
    if (!this.audioContext || !this.whiteNoiseGain) return null;

    try {
      let gain = this.audioContext.createGain();
      gain.gain.value = 0;
      gain.connect(this.whiteNoiseGain);

      gain.gain.setTargetAtTime(volume / 100, this.audioContext.currentTime, 0.5);

      let source: AudioNode;
      const intervalIds: number[] = [];
      const oscillators: OscillatorNode[] = [];

      switch (type) {
        case "white":
        case "pink":
        case "brown":
          const buffer = this.generateNoiseBuffer(type, 2);
          const bufferSource = this.audioContext.createBufferSource();
          bufferSource.buffer = buffer;
          bufferSource.loop = true;
          bufferSource.connect(gain);
          bufferSource.start();
          source = bufferSource;
          break;
        case "rain":
          source = this.createRainSound(gain, intervalIds);
          break;
        case "stream":
          source = this.createStreamSound(gain);
          break;
        case "campfire":
          source = this.createCampfireSound(gain, intervalIds);
          break;
        case "wind_leaves":
          source = this.createWindLeavesSound(gain);
          break;
        case "cafe":
          source = this.createCafeSound(gain, intervalIds);
          break;
        case "clock":
          source = this.createClockSound(gain, intervalIds);
          break;
        case "fan":
          source = this.createFanSound(gain);
          break;
        case "forest":
          source = this.createForestSound(gain, intervalIds, oscillators);
          break;
        case "ocean":
          source = this.createOceanSound(gain);
          break;
        case "thunder":
          source = this.createThunderSound(gain, intervalIds);
          break;
        case "cricket":
          source = this.createCricketSound(gain, intervalIds, oscillators);
          break;
        default:
          const defaultBuffer = this.generateNoiseBuffer("white", 2);
          const defaultBufferSource = this.audioContext.createBufferSource();
          defaultBufferSource.buffer = defaultBuffer;
          defaultBufferSource.loop = true;
          defaultBufferSource.connect(gain);
          defaultBufferSource.start();
          source = defaultBufferSource;
      }

      console.log("🔊 White noise playing:", type);
      return { source, gain, type, intervalIds, oscillators };
    } catch (error) {
      console.error("❌ Failed to play noise:", type, error);
      return null;
    }
  }

  /**
   * 停止特定白噪音
   */
  stopWhiteNoise(id: WhiteNoiseType): void {
    const noise = this.activeNoises.get(id);
    if (noise) {
      noise.gain.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.3);

      if (noise.intervalIds) {
        noise.intervalIds.forEach(intervalId => clearInterval(intervalId));
      }

      if (noise.oscillators) {
        noise.oscillators.forEach(osc => {
          try { osc.stop(); } catch {}
        });
      }

      setTimeout(() => {
        try {
          if ("stop" in noise.source) {
            (noise.source as AudioBufferSourceNode).stop();
          }
        } catch {}
      }, 600);

      this.activeNoises.delete(id);

      if (this.activeNoises.size === 0) {
        this.whiteNoiseActuallyPlaying = false;
        this.whiteNoiseGain!.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.3);
      }
    }
  }

  stopAllWhiteNoises(): void {
    const keys = Array.from(this.activeNoises.keys());
    keys.forEach(id => this.stopWhiteNoise(id));
  }

  // ==================== 暂停/继续 ====================

  /**
   * 暂停白噪音
   */
  pauseWhiteNoise(): void {
    this.isWhiteNoisePaused = true;
    this.whiteNoiseStateBeforePause.clear();
    this.activeNoises.forEach((_, id) => {
      this.whiteNoiseStateBeforePause.set(id, true);
    });
    this.whiteNoiseGain!.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.5);
    this.whiteNoiseActuallyPlaying = false;
  }

  /**
   * 继续白噪音
   */
  resumeWhiteNoise(callback?: (id: WhiteNoiseType) => Promise<void>): void {
    this.isWhiteNoisePaused = false;
    if (callback && this.whiteNoiseStateBeforePause.size > 0) {
      this.whiteNoiseStateBeforePause.forEach((_, id) => {
        callback(id);
      });
    }
  }

  /**
   * 暂停音乐
   */
  pauseMusic(): void {
    this.isMusicPaused = true;
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.6);
    }
  }

  /**
   * 继续音乐
   */
  resumeMusic(): void {
    this.isMusicPaused = false;
    if (this.musicGain && this.musicActuallyPlaying) {
      this.musicGain.gain.setTargetAtTime(this.currentVolume.music, this.audioContext!.currentTime, 0.6);
    }
  }

  isWhiteNoisePausedState(): boolean { return this.isWhiteNoisePaused; }
  isMusicPausedState(): boolean { return this.isMusicPaused; }

  // ==================== 背景音乐生成 - 带真正旋律! ====================

  async playMusic(type: string = "relax"): Promise<void> {
    console.log("🎵 Playing beautiful music:", type);
    await this.ensureAudioContext();
    this.stopMusic();

    if (!this.audioContext || !this.musicGain) {
      console.error("❌ Audio not ready");
      return;
    }

    const masterGain = this.audioContext.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.musicGain);
    masterGain.gain.setTargetAtTime(1, this.audioContext.currentTime, 1.5);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    let chordProgression: number[][];
    let baseOctave: number;
    let chordDuration: number;
    let melodySequence: number[];

    switch (type) {
      case "morning":
        chordProgression = [
          [0, 4, 7],
          [5, 9, 12],
          [9, 12, 16],
          [7, 11, 14]
        ];
        baseOctave = 4;
        chordDuration = 3500;
        melodySequence = [0, 2, 4, 5, 7, 9, 11, 12]; // C major scale
        break;
      case "focus":
        chordProgression = [
          [-12, -8, -5],
          [-10, -7, -3],
          [-13, -9, -6],
          [-15, -11, -8]
        ];
        baseOctave = 3;
        chordDuration = 5000;
        melodySequence = [0, 3, 5, 7, 8, 10, 12]; // C minor scale, calmer
        break;
      case "dusk":
        chordProgression = [
          [0, 3, 7],
          [5, 8, 12],
          [9, 12, 16],
          [7, 10, 14]
        ];
        baseOctave = 3;
        chordDuration = 4500;
        melodySequence = [0, 2, 3, 5, 7, 8, 10, 12]; // Dorian mode
        break;
      case "relax":
      default:
        chordProgression = [
          [0, 4, 7],
          [7, 11, 14],
          [9, 12, 16],
          [5, 9, 12]
        ];
        baseOctave = 4;
        chordDuration = 4000;
        melodySequence = [0, 4, 5, 7, 9, 12, 11, 9, 7, 5, 4, 0];
        break;
    }

    this.activeMusic = {
      oscillators,
      gains,
      masterGain,
      type,
      currentChordIndex: 0,
      chordProgression
    };

    // 开始播放!
    this.startBeautifulMusic(
      oscillators,
      gains,
      masterGain,
      chordProgression,
      baseOctave,
      chordDuration,
      melodySequence,
      type
    );

    this.musicActuallyPlaying = true;
    this.musicGain!.gain.setTargetAtTime(this.currentVolume.music, this.audioContext.currentTime, 1.0);
  }

  private startBeautifulMusic(
    oscillators: OscillatorNode[],
    gains: GainNode[],
    masterGain: GainNode,
    chordProgression: number[][],
    baseOctave: number,
    chordDuration: number,
    melodySequence: number[],
    type: string
  ): void {
    if (!this.audioContext) return;

    // 1. 先播放和弦背景
    this.playBeautifulChord(
      chordProgression[0],
      oscillators,
      gains,
      masterGain,
      baseOctave,
      type
    );

    // 2. 同时开始播放旋律!
    this.playMelody(melodySequence, chordProgression, baseOctave, masterGain, oscillators, gains);

    // 3. 和弦进行定时器
    let index = 1;
    this.musicInterval = window.setInterval(() => {
      if (!this.audioContext || !this.activeMusic) {
        clearInterval(this.musicInterval);
        return;
      }

      const chordIndex = index % chordProgression.length;
      this.activeMusic.currentChordIndex = chordIndex;

      gains.forEach(gain => {
        gain.gain.setTargetAtTime(0, this.audioContext!.currentTime, 1.0);
      });

      setTimeout(() => {
        oscillators.forEach(osc => {
          try { osc.stop(); } catch {}
        });
        oscillators.length = 0;
        gains.length = 0;

        if (this.audioContext && this.activeMusic) {
          this.playBeautifulChord(
            chordProgression[chordIndex],
            oscillators,
            gains,
            masterGain,
            baseOctave,
            type
          );
        }
      }, 1200);

      index++;
    }, chordDuration);
  }

  /**
   * 播放旋律
   */
  private playMelody(
    melodySequence: number[],
    chordProgression: number[][],
    baseOctave: number,
    masterGain: GainNode,
    oscillators: OscillatorNode[],
    gains: GainNode[]
  ): void {
    if (!this.audioContext) return;

    let noteIndex = 0;
    const noteDuration = 600;

    const melodyInterval = window.setInterval(() => {
      if (!this.audioContext || !this.activeMusic) {
        clearInterval(melodyInterval);
        return;
      }

      if (this.isMusicPaused) return;

      const chordIndex = this.activeMusic.currentChordIndex;
      const currentChord = chordProgression[chordIndex];
      const noteOffset = melodySequence[noteIndex % melodySequence.length];

      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      const filter = this.audioContext.createBiquadFilter();

      const baseFreq = 261.63;
      const freq = baseFreq * Math.pow(2, (noteOffset + (baseOctave + 1) * 12) / 12);

      osc.type = "sine";
      osc.frequency.value = freq;

      filter.type = "lowpass";
      filter.frequency.value = 1200;

      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, this.audioContext.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + noteDuration / 1000);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start();
      osc.stop(this.audioContext.currentTime + noteDuration / 1000);

      oscillators.push(osc);
      gains.push(gain);

      noteIndex++;
    }, noteDuration);

    if (this.activeMusic) {
      this.activeMusic.melodyInterval = melodyInterval;
    }
  }

  /**
   * 演奏更美的和弦
   */
  private playBeautifulChord(
    chordNotes: number[],
    oscillators: OscillatorNode[],
    gains: GainNode[],
    masterGain: GainNode,
    baseOctave: number,
    type: string
  ): void {
    if (!this.audioContext) return;

    const baseFreq = 261.63;

    chordNotes.forEach((noteOffset, i) => {
      setTimeout(() => {
        if (!this.audioContext) return;

        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        const freq = baseFreq * Math.pow(2, (noteOffset + (baseOctave - 4) * 12) / 12);
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004);

        filter.type = "lowpass";
        filter.frequency.value = type === "focus" ? 800 : 950;

        const volume = type === "focus" ? 0.15 : 0.16;
        gain.gain.value = Math.max(0.05, volume - i * 0.03);

        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(gain.gain.value, this.audioContext.currentTime + 1.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start();
        oscillators.push(osc);
        gains.push(gain);
      }, i * 300);
    });

    setTimeout(() => {
      if (!this.audioContext) return;

      const bassOsc = this.audioContext.createOscillator();
      const bassGain = this.audioContext.createGain();
      const bassFreq = baseFreq * Math.pow(2, (chordNotes[0] + (baseOctave - 4) * 12) / 12) / 2;

      bassOsc.type = "sine";
      bassOsc.frequency.value = bassFreq;
      bassGain.gain.value = 0.13;

      bassGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      bassGain.gain.linearRampToValueAtTime(0.13, this.audioContext.currentTime + 1.5);

      bassOsc.connect(bassGain);
      bassGain.connect(masterGain);
      bassOsc.start();
      oscillators.push(bassOsc);
      gains.push(bassGain);
    }, 450);
  }

  /**
   * 停止背景音乐
   */
  stopMusic(): void {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }

    if (this.activeMusic) {
      if (this.activeMusic.melodyInterval) {
        clearInterval(this.activeMusic.melodyInterval);
      }

      this.activeMusic.masterGain.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.8);

      setTimeout(() => {
        this.activeMusic?.oscillators.forEach(osc => {
          try { osc.stop(); } catch {}
        });
        this.activeMusic = null;
        this.musicActuallyPlaying = false;
      }, 1000);
    }
  }

  // ==================== 环境音效 ====================

  private createRainSound(gain: GainNode, intervalIds: number[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(gain);

    const pinkNoise = this.generateNoiseBuffer("pink", 2);
    const bgSource = ctx.createBufferSource();
    bgSource.buffer = pinkNoise;
    bgSource.loop = true;
    const bgGain = ctx.createGain();
    bgGain.gain.value = 0.4;
    const bgFilter = ctx.createBiquadFilter();
    bgFilter.type = "lowpass";
    bgFilter.frequency.value = 800;
    bgSource.connect(bgFilter);
    bgFilter.connect(bgGain);
    bgGain.connect(master);
    bgSource.start();

    const dropInterval = setInterval(() => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.value = 400 + Math.random() * 600;
      oscGain.gain.value = 0;

      const time = ctx.currentTime;
      oscGain.gain.setValueAtTime(0, time);
      oscGain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.05, time + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

      filter.type = "highpass";
      filter.frequency.value = 300;

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(master);

      osc.start(time);
      osc.stop(time + 0.15);
    }, 80 + Math.random() * 100);

    intervalIds.push(dropInterval);
    return master;
  }

  private createStreamSound(gain: GainNode): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(gain);

    const pinkNoise = this.generateNoiseBuffer("pink", 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = pinkNoise;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = 100;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    return master;
  }

  private createCampfireSound(gain: GainNode, intervalIds: number[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(gain);

    const brownNoise = this.generateNoiseBuffer("brown", 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = brownNoise;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.6;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();

    const crackInterval = setInterval(() => {
      if (!ctx) return;
      if (Math.random() > 0.3) {
        const crackBuffer = this.generateNoiseBuffer("white", 0.1);
        const crackSource = ctx.createBufferSource();
        crackSource.buffer = crackBuffer;

        const crackGain = ctx.createGain();
        crackGain.gain.value = 0.1 + Math.random() * 0.15;

        const crackFilter = ctx.createBiquadFilter();
        crackFilter.type = "highpass";
        crackFilter.frequency.value = 1500;

        crackSource.connect(crackFilter);
        crackFilter.connect(crackGain);
        crackGain.connect(master);
        crackSource.start();
      }
    }, 200 + Math.random() * 600);

    intervalIds.push(crackInterval);
    return master;
  }

  private createWindLeavesSound(gain: GainNode): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(gain);

    const pinkNoise = this.generateNoiseBuffer("pink", 2);
    const windSource = ctx.createBufferSource();
    windSource.buffer = pinkNoise;
    windSource.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 400;

    const windGain = ctx.createGain();
    windGain.gain.value = 0.5;

    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSource.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    const lfo2 = ctx.createOscillator();
    const lfo2Gain = ctx.createGain();
    lfo2.type = "sine";
    lfo2.frequency.value = 0.08;
    lfo2Gain.gain.value = 0.15;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(windGain.gain);
    lfo2.start();

    return master;
  }

  private createCafeSound(gain: GainNode, intervalIds: number[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(gain);

    const pinkNoise = this.generateNoiseBuffer("pink", 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = pinkNoise;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();

    const chatterInterval = setInterval(() => {
      if (!ctx) return;
      if (Math.random() > 0.7) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = 120 + Math.random() * 200;
        oscGain.gain.value = 0;

        const time = ctx.currentTime;
        const duration = 0.3 + Math.random() * 0.5;
        oscGain.gain.setValueAtTime(0, time);
        oscGain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, time + 0.1);
        oscGain.gain.linearRampToValueAtTime(0, time + duration);

        osc.connect(oscGain);
        oscGain.connect(master);
        osc.start(time);
        osc.stop(time + duration);
      }
    }, 500 + Math.random() * 1000);

    intervalIds.push(chatterInterval);
    return master;
  }

  private createClockSound(gain: GainNode, intervalIds: number[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(gain);

    let isTick = true;
    const clockInterval = setInterval(() => {
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.value = isTick ? 1200 : 900;
      isTick = !isTick;

      const time = ctx.currentTime;
      oscGain.gain.setValueAtTime(0, time);
      oscGain.gain.linearRampToValueAtTime(0.08, time + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

      filter.type = "lowpass";
      filter.frequency.value = 2000;

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(master);

      osc.start(time);
      osc.stop(time + 0.2);
    }, 1000);

    intervalIds.push(clockInterval);
    return master;
  }

  private createFanSound(gain: GainNode): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(gain);

    const brownNoise = this.generateNoiseBuffer("brown", 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = brownNoise;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.6;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();

    const humOsc = ctx.createOscillator();
    const humGain = ctx.createGain();
    humOsc.type = "sine";
    humOsc.frequency.value = 60;
    humGain.gain.value = 0.05;
    humOsc.connect(humGain);
    humGain.connect(master);
    humOsc.start();

    return master;
  }

  private createForestSound(gain: GainNode, intervalIds: number[], oscillators: OscillatorNode[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(gain);

    const windSound = this.createWindLeavesSound(master);

    const birdInterval = setInterval(() => {
      if (!ctx) return;
      if (Math.random() > 0.8) {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();

        osc.type = "sine";
        const baseFreq = 1500 + Math.random() * 1000;
        osc.frequency.value = baseFreq;

        const time = ctx.currentTime;
        const duration = 0.15 + Math.random() * 0.2;

        oscGain.gain.setValueAtTime(0, time);
        oscGain.gain.linearRampToValueAtTime(0.05, time + 0.02);
        oscGain.gain.linearRampToValueAtTime(0, time + duration);

        osc.frequency.setValueAtTime(baseFreq, time);
        osc.frequency.linearRampToValueAtTime(baseFreq + 200, time + duration / 2);
        osc.frequency.linearRampToValueAtTime(baseFreq - 100, time + duration);

        osc.connect(oscGain);
        oscGain.connect(master);
        osc.start(time);
        osc.stop(time + duration);
        oscillators.push(osc);
      }
    }, 2000 + Math.random() * 3000);

    intervalIds.push(birdInterval);
    return master;
  }

  private createOceanSound(gain: GainNode): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(gain);

    const pinkNoise = this.generateNoiseBuffer("pink", 2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = pinkNoise;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.frequency.value = 700;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 0.4;
    lfo.connect(lfoGain);
    lfoGain.connect(noiseGain.gain);
    lfo.start();

    const lfo2 = ctx.createOscillator();
    const lfo2Gain = ctx.createGain();
    lfo2.type = "sine";
    lfo2.frequency.value = 0.12;
    lfo2Gain.gain.value = 100;
    lfo2.connect(lfo2Gain);
    lfo2Gain.connect(filter.frequency);
    lfo2.start();

    return master;
  }

  private createThunderSound(gain: GainNode, intervalIds: number[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(gain);

    const thunderInterval = setInterval(() => {
      if (!ctx) return;
      if (Math.random() > 0.92) {
        const buffer = this.generateNoiseBuffer("brown", 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const thunderGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = "lowpass";
        filter.frequency.value = 300;

        const time = ctx.currentTime;
        thunderGain.gain.setValueAtTime(0, time);
        thunderGain.gain.linearRampToValueAtTime(0.3, time + 0.1);
        thunderGain.gain.exponentialRampToValueAtTime(0.001, time + 2);

        source.connect(filter);
        filter.connect(thunderGain);
        thunderGain.connect(master);
        source.start(time);
      }
    }, 5000 + Math.random() * 8000);

    intervalIds.push(thunderInterval);
    return master;
  }

  private createCricketSound(gain: GainNode, intervalIds: number[], oscillators: OscillatorNode[]): AudioNode {
    const ctx = this.audioContext!;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(gain);

    const cricketInterval = setInterval(() => {
      if (!ctx) return;
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 20 && Math.random() > 0.3) return;

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = "square";
      osc.frequency.value = 4500 + Math.random() * 500;

      const time = ctx.currentTime;
      const chirpCount = 2 + Math.floor(Math.random() * 4);

      for (let i = 0; i < chirpCount; i++) {
        const chirpStart = time + i * 0.12;
        oscGain.gain.setValueAtTime(0, chirpStart);
        oscGain.gain.linearRampToValueAtTime(0.04, chirpStart + 0.02);
        oscGain.gain.linearRampToValueAtTime(0, chirpStart + 0.08);
      }

      osc.connect(oscGain);
      oscGain.connect(master);
      osc.start(time);
      osc.stop(time + chirpCount * 0.12 + 0.1);
      oscillators.push(osc);
    }, 800 + Math.random() * 1500);

    intervalIds.push(cricketInterval);
    return master;
  }
}

let audioManager: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManager) {
    audioManager = new AudioManager();
  }
  return audioManager;
}
