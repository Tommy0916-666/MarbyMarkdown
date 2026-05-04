// 声景主控制器
import { reactive, watch } from 'vue';
import { 
  SoundscapeConfig,
  WhiteNoiseType,
  MusicTag,
  WeatherCondition,
  EnvironmentInfo
} from './types';
import { DEFAULT_CONFIG, STORAGE_KEY } from './defaults';
import { getAudioManager } from './AudioManager';

export class SoundscapeController {
  private config: SoundscapeConfig;
  private audioManager = getAudioManager();
  private randomInterval: number | null = null;
  private typingTimeout: number | null = null;
  private isTyping = false;
  private userModifiedWhiteNoise = false; // 用户是否手动修改过白噪音设置
  private listeners: ((config: SoundscapeConfig) => void)[] = [];
  private currentMusicType: string = 'relax';

  // 暂停状态
  private isWhiteNoisePaused = false;
  private isMusicPaused = false;

  constructor() {
    // 加载配置
    this.config = this.loadConfig();
    
    // 初始化音频音量
    this.audioManager.setWhiteNoiseVolume(this.config.whiteNoise.masterVolume);
    this.audioManager.setMusicVolume(this.config.music.masterVolume);

    // 如果是首次运行，播放引导提示
    if (this.config.firstRun) {
      this.config.firstRun = false;
      this.saveConfig();
    }

    // 自动启动（如果 config.enabled 为 true）
    if (this.config.enabled) {
      this.start();
    }

    // 全局监听打字事件（用于智能音量）
    window.addEventListener('keydown', () => {
      this.notifyTypingStart();
    });
  }

  // 声景主开关
  toggleSoundscape(enabled: boolean): void {
    this.config.enabled = enabled;
    this.saveConfig();
    
    if (enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  // 在状态栏显示控件开关
  toggleShowInStatusBar(enabled: boolean): void {
    this.config.showInStatusBar = enabled;
    this.saveConfig();
  }

  // ========== 暂停/继续控制 ==========

  // 暂停白噪音
  pauseWhiteNoise(): void {
    this.isWhiteNoisePaused = true;
    this.audioManager.pauseWhiteNoise();
  }

  // 继续白噪音
  resumeWhiteNoise(): void {
    this.isWhiteNoisePaused = false;
    this.audioManager.resumeWhiteNoise((id) => {
      const item = this.config.whiteNoise.items.find(i => i.id === id);
      if (item && item.enabled && this.config.whiteNoise.enabled) {
        this.audioManager.playWhiteNoise(id, id, item.volume);
      }
    });
  }

  // 暂停音乐
  pauseMusic(): void {
    this.isMusicPaused = true;
    this.audioManager.pauseMusic();
  }

  // 继续音乐
  resumeMusic(): void {
    this.isMusicPaused = false;
    this.audioManager.resumeMusic();
  }

  // 获取暂停状态
  getWhiteNoisePauseState(): boolean {
    return this.isWhiteNoisePaused;
  }

  getMusicPauseState(): boolean {
    return this.isMusicPaused;
  }

  // 加载配置
  private loadConfig(): SoundscapeConfig {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return reactive({
          ...DEFAULT_CONFIG,
          ...parsed,
          whiteNoise: { ...DEFAULT_CONFIG.whiteNoise, ...parsed.whiteNoise },
          music: { 
            ...DEFAULT_CONFIG.music, 
            ...parsed.music,
            // 确保音乐列表是最新的
            builtinMusic: DEFAULT_CONFIG.music.builtinMusic,
            playlist: DEFAULT_CONFIG.music.playlist
          }
        });
      }
    } catch (e) {
      console.warn('加载声景配置失败，使用默认值', e);
    }
    return reactive({ ...DEFAULT_CONFIG });
  }

  // 保存配置
  private saveConfig(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    this.notifyListeners();
  }

  // 添加监听器
  addListener(callback: (config: SoundscapeConfig) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const idx = this.listeners.indexOf(callback);
      if (idx > -1) this.listeners.splice(idx, 1);
    };
  }

  // 通知监听器
  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.config));
  }

  // 获取当前配置
  getConfig(): SoundscapeConfig {
    return this.config;
  }

  // ========== 环境信息获取 ==========

  private getEnvironmentInfo(): EnvironmentInfo {
    const hour = new Date().getHours();
    
    // 模拟天气（同马卡龙主题一致）
    let weather: WeatherCondition = 'sunny';
    if (hour >= 6 && hour < 12) {
      weather = 'sunny';
    } else if (hour >= 12 && hour < 18) {
      weather = 'sunny';
    } else if (hour >= 18 && hour < 21) {
      weather = 'cloudy';
    } else {
      weather = 'cloudy';
    }

    return {
      hour,
      weather,
      isTyping: this.isTyping,
      isFocusMode: false // 暂时
    };
  }

  // ========== 打字检测 ==========

  notifyTypingStart(): void {
    this.isTyping = true;
    this.updateSmartVolume();
    
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = window.setTimeout(() => {
      this.isTyping = false;
      this.updateSmartVolume();
    }, 2000);
  }

  private updateSmartVolume(): void {
    if (this.config.smartVolume) {
      this.audioManager.setSmartVolume(true, this.isTyping);
    }
  }

  // ========== 白噪音控制 ==========

  // 启用/禁用白噪音
  toggleWhiteNoise(enabled: boolean): void {
    this.config.whiteNoise.enabled = enabled;
    this.saveConfig();
    
    if (enabled) {
      this.updateWhiteNoisePlayback();
    } else {
      this.audioManager.stopAllWhiteNoises();
      this.stopRandomMode();
    }
  }

  // 更新单个白噪音设置
  updateWhiteNoiseItem(id: WhiteNoiseType, enabled: boolean): void {
    const item = this.config.whiteNoise.items.find(i => i.id === id);
    if (item) {
      item.enabled = enabled;
      this.userModifiedWhiteNoise = true; // 用户手动修改了
      this.saveConfig();
      this.updateWhiteNoisePlayback();
    }
  }

  // 设置白噪音总音量
  setWhiteNoiseMasterVolume(volume: number): void {
    this.config.whiteNoise.masterVolume = volume;
    this.audioManager.setWhiteNoiseVolume(volume);
    this.saveConfig();
  }

  // 切换随机模式
  toggleWhiteNoiseRandom(enabled: boolean): void {
    this.config.whiteNoise.autoRandom = enabled;
    this.saveConfig();
    
    if (enabled) {
      this.startRandomMode();
    } else {
      this.stopRandomMode();
    }
  }

  // 切换与主题同步
  toggleThemeSync(enabled: boolean): void {
    this.config.whiteNoise.syncWithTheme = enabled;
    this.saveConfig();
    if (enabled && !this.userModifiedWhiteNoise) {
      this.syncWithTheme();
    }
  }

  // 更新白噪音播放
  private updateWhiteNoisePlayback(): void {
    if (!this.config.whiteNoise.enabled) return;

    // 停止所有
    this.audioManager.stopAllWhiteNoises();

    // 开始启用的
    this.config.whiteNoise.items.forEach(item => {
      if (item.enabled) {
        this.audioManager.playWhiteNoise(item.id, item.id, item.volume);
      }
    });
  }

  // 随机模式
  private startRandomMode(): void {
    this.stopRandomMode();
    this.randomizeWhiteNoises();
    
    this.randomInterval = window.setInterval(() => {
      this.randomizeWhiteNoises();
    }, this.config.whiteNoise.randomInterval * 60 * 1000);
  }

  private stopRandomMode(): void {
    if (this.randomInterval) {
      clearInterval(this.randomInterval);
      this.randomInterval = null;
    }
  }

  // 随机化白噪音组合
  private randomizeWhiteNoises(): void {
    const env = this.getEnvironmentInfo();
    
    this.config.whiteNoise.items.forEach(item => {
      let targetVolume = 0;
      let shouldEnable = Math.random() > 0.5;

      // 如果开启了与主题同步且用户未手动修改过
      if (this.config.whiteNoise.syncWithTheme && !this.userModifiedWhiteNoise) {
        shouldEnable = this.shouldEnableForWeather(item.id, env.weather, env.hour);
        targetVolume = shouldEnable ? 30 + Math.random() * 40 : 0;
      } else if (shouldEnable) {
        targetVolume = 20 + Math.random() * 60;
      }

      item.enabled = shouldEnable;
      item.volume = targetVolume;
    });

    this.saveConfig();
    this.updateWhiteNoisePlayback();
  }

  // 根据天气和时间决定是否启用某类白噪音
  private shouldEnableForWeather(id: WhiteNoiseType, weather: WeatherCondition, hour: number): boolean {
    const rainRelated = ['rain', 'thunder'];
    const sunnyRelated = ['wind_leaves', 'stream', 'forest'];
    const nightRelated = ['cricket', 'campfire'];
    const generic = ['white', 'pink', 'brown', 'fan', 'cafe'];

    if (weather === 'rainy' && rainRelated.includes(id)) {
      return Math.random() > 0.2;
    }
    if (weather === 'sunny' && sunnyRelated.includes(id)) {
      return Math.random() > 0.3;
    }
    if ((hour < 6 || hour > 21) && nightRelated.includes(id)) {
      return Math.random() > 0.4;
    }
    if (generic.includes(id)) {
      return Math.random() > 0.6;
    }
    
    return Math.random() > 0.8;
  }

  // 与马卡龙主题同步
  private syncWithTheme(): void {
    const env = this.getEnvironmentInfo();
    
    this.config.whiteNoise.items.forEach(item => {
      let baseVolume = item.volume;
      
      // 根据天气调整
      if (env.weather === 'rainy') {
        if (['rain', 'thunder'].includes(item.id)) {
          baseVolume = Math.min(100, item.volume + 20);
        }
      } else if (env.weather === 'sunny') {
        if (['wind_leaves', 'forest', 'stream'].includes(item.id)) {
          baseVolume = Math.min(100, item.volume + 15);
        }
      }
      
      if (env.hour > 22 || env.hour < 6) {
        if (['cricket', 'campfire', 'brown'].includes(item.id)) {
          baseVolume = Math.min(100, item.volume + 10);
        }
      }

      item.volume = baseVolume;
    });

    this.updateWhiteNoisePlayback();
  }

  // ========== 背景音乐控制 ==========

  toggleMusic(enabled: boolean): void {
    this.config.music.enabled = enabled;
    this.saveConfig();
    
    if (enabled) {
      if (this.config.music.autoMode) {
        this.updateAutoMusic();
      } else {
        this.audioManager.playMusic(this.currentMusicType);
      }
    } else {
      this.audioManager.stopMusic();
    }
  }

  toggleMusicAutoMode(enabled: boolean): void {
    this.config.music.autoMode = enabled;
    this.saveConfig();
    
    if (enabled && this.config.music.enabled) {
      this.updateAutoMusic();
    }
  }

  setMusicMasterVolume(volume: number): void {
    this.config.music.masterVolume = volume;
    this.audioManager.setMusicVolume(volume);
    this.saveConfig();
  }

  // 选择并播放特定音乐
  selectMusic(musicId: string): void {
    const music = this.config.music.builtinMusic.find(m => m.id === musicId);
    if (music) {
      this.config.music.currentIndex = this.config.music.playlist.indexOf(musicId);
      this.saveConfig();
      
      // 直接用 id 作为 musicType
      this.currentMusicType = musicId;
      this.audioManager.playMusic(musicId);
    }
  }

  // 下一首
  playNextMusic(): void {
    const playlist = this.config.music.playlist;
    const nextIndex = (this.config.music.currentIndex + 1) % playlist.length;
    this.config.music.currentIndex = nextIndex;
    this.saveConfig();
    
    const nextId = playlist[nextIndex];
    this.currentMusicType = nextId;
    this.audioManager.playMusic(nextId);
  }

  // 上一首
  playPrevMusic(): void {
    const playlist = this.config.music.playlist;
    const prevIndex = (this.config.music.currentIndex - 1 + playlist.length) % playlist.length;
    this.config.music.currentIndex = prevIndex;
    this.saveConfig();
    
    const prevId = playlist[prevIndex];
    this.currentMusicType = prevId;
    this.audioManager.playMusic(prevId);
  }

  // 更新自动音乐
  private updateAutoMusic(): void {
    if (!this.config.music.autoMode || !this.config.music.enabled) return;
    
    const env = this.getEnvironmentInfo();
    
    // 根据时间和天气选择标签
    let targetTags: MusicTag[] = [];
    
    if (env.hour >= 5 && env.hour < 10) {
      targetTags.push('morning');
    } else if (env.hour >= 10 && env.hour < 17) {
      targetTags.push('afternoon');
    } else if (env.hour >= 17 && env.hour < 21) {
      targetTags.push('dusk');
    } else {
      targetTags.push('night');
    }
    
    if (env.weather === 'rainy') {
      targetTags.push('rain');
    }
    
    // 查找匹配的音乐
    const matchingMusic = this.config.music.builtinMusic.filter(m => 
      m.tags.some(tag => targetTags.includes(tag))
    );
    
    if (matchingMusic.length > 0) {
      const selected = matchingMusic[Math.floor(Math.random() * matchingMusic.length)];
      this.config.music.currentIndex = this.config.music.playlist.indexOf(selected.id);
      
      // 确定播放类型
      let musicType = 'relax';
      if (selected.tags.includes('morning')) musicType = 'morning';
      else if (selected.tags.includes('afternoon') || selected.tags.includes('focus')) musicType = 'focus';
      else if (selected.tags.includes('dusk')) musicType = 'dusk';
      
      this.currentMusicType = musicType;
      this.audioManager.playMusic(musicType);
    }
  }

  // ========== 智能音量 ==========

  toggleSmartVolume(enabled: boolean): void {
    this.config.smartVolume = enabled;
    this.saveConfig();
    if (!enabled) {
      this.audioManager.setSmartVolume(false, false);
    }
  }

  // ========== 生命周期 ==========

  // 启动
  start(): void {
    if (this.config.whiteNoise.enabled) {
      this.updateWhiteNoisePlayback();
      if (this.config.whiteNoise.autoRandom) {
        this.startRandomMode();
      }
    }
    if (this.config.music.enabled) {
      if (this.config.music.autoMode) {
        this.updateAutoMusic();
      } else {
        this.audioManager.playMusic(this.currentMusicType);
      }
    }
  }

  // 停止
  stop(): void {
    this.audioManager.stopAllWhiteNoises();
    this.audioManager.stopMusic();
    this.stopRandomMode();
  }

  // 重置为默认
  resetToDefault(): void {
    this.config = reactive({ ...DEFAULT_CONFIG });
    this.saveConfig();
    this.userModifiedWhiteNoise = false;
    this.stop();
    this.start();
  }
}

// 全局单例
let soundscapeController: SoundscapeController | null = null;

export function getSoundscapeController(): SoundscapeController {
  if (!soundscapeController) {
    soundscapeController = new SoundscapeController();
  }
  return soundscapeController;
}
