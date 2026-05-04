// 声景模块默认配置
import { 
  SoundscapeConfig, 
  WhiteNoiseType,
  MusicTag
} from './types';

// 默认白噪音库
export const DEFAULT_WHITE_NOISES: { id: WhiteNoiseType; name: string; description: string; emoji: string }[] = [
  { id: 'rain', name: '雨声', description: '轻柔的雨声，营造宁静氛围', emoji: '🌧️' },
  { id: 'stream', name: '溪流', description: '潺潺的流水声，亲近自然', emoji: '🏞️' },
  { id: 'campfire', name: '篝火', description: '温暖的篝火劈啪声', emoji: '🔥' },
  { id: 'wind_leaves', name: '风吹树叶', description: '树叶沙沙作响，微风拂面', emoji: '🍃' },
  { id: 'cafe', name: '咖啡馆', description: '背景人声，如同在咖啡馆', emoji: '☕' },
  { id: 'clock', name: '钟表滴答', description: '规律的嘀嗒声，增加专注感', emoji: '🕐' },
  { id: 'fan', name: '风扇转动', description: '平稳的风扇声，助眠好物', emoji: '🌬️' },
  { id: 'white', name: '白噪', description: '经典白噪音，遮蔽干扰', emoji: '⚪' },
  { id: 'pink', name: '粉噪', description: '更柔和的粉噪音', emoji: '🩷' },
  { id: 'brown', name: '棕噪', description: '低沉的棕噪音，非常放松', emoji: '🟤' },
  { id: 'forest', name: '森林鸟鸣', description: '清脆的鸟叫声，清晨的感觉', emoji: '🐦' },
  { id: 'ocean', name: '海浪声', description: '海浪拍岸，无边无际的宁静', emoji: '🌊' },
  { id: 'thunder', name: '轻雷声', description: '远处的闷雷声，安全感', emoji: '⚡' },
  { id: 'cricket', name: '蟋蟀声', description: '夏夜里的虫鸣声', emoji: '🦗' },
];

// 默认内置背景音乐（公共版权）
export const DEFAULT_BUILTIN_MUSIC: { id: string; name: string; artist?: string; tags: MusicTag[]; emoji: string }[] = [
  { id: 'morning', name: '清晨的希望', artist: 'Public Domain', tags: ['morning', 'relax'], emoji: '🌅' },
  { id: 'focus', name: '专注时刻', artist: 'Public Domain', tags: ['focus', 'afternoon'], emoji: '🎯' },
  { id: 'dusk', name: '黄昏的诗', artist: 'Public Domain', tags: ['dusk', 'relax'], emoji: '🌇' },
  { id: 'relax', name: '放松一下', artist: 'Public Domain', tags: ['night', 'relax'], emoji: '🌙' },
];

// 默认配置
export const DEFAULT_CONFIG: SoundscapeConfig = {
  enabled: true,
  showInStatusBar: true, // 默认在状态栏显示
  whiteNoise: {
    enabled: true,
    items: DEFAULT_WHITE_NOISES.map(n => ({
      ...n,
      volume: 50,
      enabled: n.id === 'rain' || n.id === 'wind_leaves' // 默认启用两个
    })),
    autoRandom: false,
    randomInterval: 8, // 8分钟
    syncWithTheme: false,
    masterVolume: 60
  },
  music: {
    enabled: true,
    autoMode: true,
    builtinMusic: DEFAULT_BUILTIN_MUSIC.map(m => ({
      ...m,
      source: 'builtin',
      path: '' // 后面补充实际路径
    })),
    customMusic: [],
    playlist: DEFAULT_BUILTIN_MUSIC.map(m => m.id),
    currentIndex: 0,
    isPlaying: false,
    playMode: 'loop',
    masterVolume: 35
  },
  smartVolume: true,
  firstRun: true
};

// 存储键名
export const STORAGE_KEY = 'soundscape_config';
