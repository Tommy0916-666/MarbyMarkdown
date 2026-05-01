// 声景模块类型定义

// 天气类型
export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy';

// 白噪音类型
export type WhiteNoiseType = 
  | 'rain'           // 雨声
  | 'stream'         // 溪流
  | 'campfire'       // 篝火
  | 'wind_leaves'    // 风吹树叶
  | 'cafe'           // 咖啡馆背景
  | 'clock'          // 钟表滴答
  | 'fan'            // 风扇转动
  | 'white'          // 白噪
  | 'pink'           // 粉噪
  | 'brown'          // 棕噪
  | 'forest'         // 森林鸟鸣
  | 'ocean'          // 海浪声
  | 'thunder'        // 轻雷声
  | 'cricket';       // 蟋蟀声

// 白噪音项目
export interface WhiteNoiseItem {
  id: WhiteNoiseType;
  name: string;
  description: string;
  emoji: string;
  volume: number; // 0-100
  enabled: boolean;
}

// 背景音乐标签
export type MusicTag = 
  | 'morning'        // 清晨
  | 'afternoon'      // 午后
  | 'dusk'           // 黄昏
  | 'night'          // 深夜
  | 'rain'           // 雨天
  | 'focus'          // 专注
  | 'relax';         // 放松

// 背景音乐来源
export type MusicSource = 'builtin' | 'custom';

// 背景音乐项目
export interface MusicItem {
  id: string;
  name: string;
  artist?: string;
  tags: MusicTag[];
  source: MusicSource;
  path: string;
  duration?: number;
  cover?: string;
  emoji?: string;
}

// 播放模式
export type PlayMode = 'loop' | 'shuffle' | 'single';

// 白噪音配置
export interface WhiteNoiseConfig {
  enabled: boolean;
  items: WhiteNoiseItem[];
  autoRandom: boolean;
  randomInterval: number; // 分钟
  syncWithTheme: boolean;
  masterVolume: number;
}

// 背景音乐配置
export interface MusicConfig {
  enabled: boolean;
  autoMode: boolean;
  builtinMusic: MusicItem[];
  customMusic: MusicItem[];
  playlist: string[];
  currentIndex: number;
  isPlaying: boolean;
  playMode: PlayMode;
  masterVolume: number;
}

// 全局声景配置
export interface SoundscapeConfig {
  enabled: boolean; // 声景主开关
  showInStatusBar: boolean; // 在状态栏显示声景控件
  whiteNoise: WhiteNoiseConfig;
  music: MusicConfig;
  smartVolume: boolean; // 智能音量
  firstRun: boolean;
}

// 环境信息
export interface EnvironmentInfo {
  hour: number;
  weather: WeatherCondition;
  isTyping: boolean;
  isFocusMode: boolean;
}
