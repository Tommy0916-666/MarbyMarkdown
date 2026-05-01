// 马卡龙流光主题控制器
export interface MacaronColors {
  bgMain: string;
  bg1: string;
  bg2: string;
  bg3: string;
  codeBg: string;
  quoteBg: string;
  textMain: string;
  primary: string;
  secondary: string;
}

export interface WeatherData {
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'foggy';
  temperature: number;
}

export class MacaronFlowController {
  private isActive: boolean = false;
  private updateInterval: number | null = null;
  private lastWeather: WeatherData = {
    condition: 'sunny',
    temperature: 22,
  };

  private readonly macaronPalettes = {
    // 马卡龙色板 - 粉红色调
    pink: {
      bgMain: '#fef9f3',
      bg1: '#fff7f0',
      bg2: '#fff0e6',
      bg3: '#ffe4d1',
      codeBg: '#fff5f5',
      quoteBg: '#fff0f0',
      textMain: '#5a4a42',
      primary: '#ff9a9e',
      secondary: '#a8edea',
    },
    // 马卡龙色板 - 蓝色调
    blue: {
      bgMain: '#f3f9fe',
      bg1: '#f0f7ff',
      bg2: '#e6f0ff',
      bg3: '#d1e4ff',
      codeBg: '#f5f9ff',
      quoteBg: '#f0f5ff',
      textMain: '#424a5a',
      primary: '#9aceff',
      secondary: '#fad0c4',
    },
    // 马卡龙色板 - 绿色调
    green: {
      bgMain: '#f3fef5',
      bg1: '#f0fff7',
      bg2: '#e6fff0',
      bg3: '#d1ffe4',
      codeBg: '#f5fff9',
      quoteBg: '#f0fff5',
      textMain: '#425a4a',
      primary: '#a8e6cf',
      secondary: '#ffd3b6',
    },
    // 马卡龙色板 - 紫色调
    purple: {
      bgMain: '#f9f3fe',
      bg1: '#f7f0ff',
      bg2: '#f0e6ff',
      bg3: '#e4d1ff',
      codeBg: '#f9f5ff',
      quoteBg: '#f5f0ff',
      textMain: '#4a425a',
      primary: '#d6a4ff',
      secondary: '#ffc3a0',
    },
    // 马卡龙色板 - 橙色调
    orange: {
      bgMain: '#fef7f3',
      bg1: '#fff3f0',
      bg2: '#ffe8e0',
      bg3: '#ffd4c0',
      codeBg: '#fff8f5',
      quoteBg: '#fff3f0',
      textMain: '#5a4842',
      primary: '#ffb199',
      secondary: '#a1c4fd',
    },
  };

  constructor() {}

  // 启动主题
  start(): void {
    if (this.isActive) return;
    this.isActive = true;

    // 立即更新一次
    this.updateColors();

    // 设置定时器，每30秒更新一次（缓慢变化）
    this.updateInterval = window.setInterval(() => {
      if (this.isActive) {
        this.updateColors();
      }
    }, 30000);
  }

  // 停止主题
  stop(): void {
    this.isActive = false;
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // 获取天气数据（隐私友好，不请求定位）
  private async fetchWeatherData(): Promise<WeatherData> {
    try {
      // 简单的基于时间的模拟（不请求外部API）
      const hour = new Date().getHours();
      
      // 根据时间段模拟天气
      let condition: WeatherData['condition'] = 'sunny';
      
      if (hour >= 6 && hour < 12) {
        condition = 'sunny'; // 早上晴天
      } else if (hour >= 12 && hour < 18) {
        condition = 'sunny'; // 下午晴天
      } else if (hour >= 18 && hour < 21) {
        condition = 'cloudy'; // 傍晚多云
      } else {
        condition = 'cloudy'; // 夜间多云
      }

      // 模拟温度（20-26度之间）
      const baseTemp = 22;
      const tempVariation = Math.sin(hour * Math.PI / 12) * 4;
      const temperature = Math.round(baseTemp + tempVariation);

      return { condition, temperature };
    } catch (error) {
      console.warn('获取天气数据失败，使用默认天气', error);
      return { condition: 'sunny', temperature: 22 };
    }
  }

  // 根据时间和天气计算颜色
  private calculateColors(time: Date, weather: WeatherData): MacaronColors {
    const hour = time.getHours();
    const minute = time.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // 一天中的进度（0-1）
    const dayProgress = totalMinutes / 1440;

    // 根据时间段选择基础色板
    let paletteKey: keyof typeof this.macaronPalettes;
    if (hour >= 5 && hour < 10) {
      paletteKey = weather.condition === 'sunny' ? 'orange' : 'blue';
    } else if (hour >= 10 && hour < 15) {
      paletteKey = weather.condition === 'sunny' ? 'green' : 'blue';
    } else if (hour >= 15 && hour < 19) {
      paletteKey = weather.condition === 'sunny' ? 'pink' : 'purple';
    } else {
      paletteKey = 'blue';
    }

    const basePalette = this.macaronPalettes[paletteKey];

    // 缓慢的色相偏移（使用正弦波）
    const colorPhase = (dayProgress * Math.PI * 2);
    const hueShift = Math.sin(colorPhase) * 10; // 10度的偏移

    // 应用偏移到颜色
    return {
      bgMain: this.shiftHue(basePalette.bgMain, hueShift),
      bg1: this.shiftHue(basePalette.bg1, hueShift * 0.8),
      bg2: this.shiftHue(basePalette.bg2, hueShift * 0.6),
      bg3: this.shiftHue(basePalette.bg3, hueShift * 0.4),
      codeBg: this.shiftHue(basePalette.codeBg, hueShift * 0.5),
      quoteBg: this.shiftHue(basePalette.quoteBg, hueShift * 0.3),
      textMain: basePalette.textMain, // 文字保持稳定
      primary: this.shiftHue(basePalette.primary, hueShift * 1.2),
      secondary: this.shiftHue(basePalette.secondary, hueShift * 0.9),
    };
  }

  // 色相偏移工具函数
  private shiftHue(color: string, degrees: number): string {
    // 将颜色转为RGB
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    // RGB转HSL
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);

    // 偏移色相（确保在0-360范围内）
    let newHue = (hsl.h + degrees) % 360;
    if (newHue < 0) newHue += 360;

    // HSL转回RGB
    const newRgb = this.hslToRgb(newHue, hsl.s, hsl.l);

    // RGB转回HEX
    return this.rgbToHex(newRgb.r, newRgb.g, newRgb.b);
  }

  // 简单的颜色转换函数
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('');
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return { h: h * 360, s, l };
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: r * 255,
      g: g * 255,
      b: b * 255,
    };
  }

  // 应用颜色到DOM
  private applyColors(colors: MacaronColors): void {
    const html = document.documentElement;

    // 使用CSS变量平滑过渡
    html.style.setProperty('--background-color', colors.bgMain);
    html.style.setProperty('--background-color-1', colors.bg1);
    html.style.setProperty('--background-color-2', colors.bg2);
    html.style.setProperty('--background-color-3', colors.bg3);
    html.style.setProperty('--primary-color', colors.primary);
    html.style.setProperty('--secondary-color', colors.secondary);
    html.style.setProperty('--text-color', colors.textMain);
    html.style.setProperty('--text-color-1', this.adjustBrightness(colors.textMain, -10));
    html.style.setProperty('--text-color-2', this.adjustBrightness(colors.textMain, 10));
    html.style.setProperty('--text-color-3', this.adjustBrightness(colors.textMain, 30));

    // 编辑器颜色
    html.style.setProperty('--crepe-color-background', colors.bgMain);
    html.style.setProperty('--crepe-color-on-background', colors.textMain);
    html.style.setProperty('--crepe-color-surface', colors.bg1);
    html.style.setProperty('--crepe-color-surface-low', colors.bg2);
    html.style.setProperty('--crepe-color-primary', colors.primary);
    html.style.setProperty('--crepe-color-secondary', colors.secondary);
    html.style.setProperty('--crepe-color-inline-code', colors.codeBg);
  }

  private adjustBrightness(color: string, amount: number): string {
    const rgb = this.hexToRgb(color);
    if (!rgb) return color;

    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    return this.rgbToHex(
      clamp(rgb.r + amount),
      clamp(rgb.g + amount),
      clamp(rgb.b + amount)
    );
  }

  // 更新颜色（主函数）
  private async updateColors(): Promise<void> {
    if (!this.isActive) return;

    try {
      const now = new Date();
      const weather = await this.fetchWeatherData();
      this.lastWeather = weather;

      const colors = this.calculateColors(now, weather);
      this.applyColors(colors);
    } catch (error) {
      console.error('更新马卡龙流光颜色失败', error);
    }
  }

  // 获取当前是否激活状态
  getIsActive(): boolean {
    return this.isActive;
  }
}

// 全局单例
let macaronFlowInstance: MacaronFlowController | null = null;

export function getMacaronFlowController(): MacaronFlowController {
  if (!macaronFlowInstance) {
    macaronFlowInstance = new MacaronFlowController();
  }
  return macaronFlowInstance;
}
