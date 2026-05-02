import * as fs from "node:fs";
import path from "node:path";
import { app, shell } from "electron";

export interface KnowledgeBaseInfo {
  name: string;
  path: string;
  createdAt: number;
  description?: string;
}

export interface CreateKnowledgeBaseParams {
  name: string;
  description?: string;
}

export interface KnowledgeBaseConfig {
  name: string;
  description?: string;
  createdAt: number;
  aiConfig?: {
    useGlobal: boolean;
  };
}

export function getKnowledgeBaseRoot(): string {
  const rootPath = path.join(app.getPath("userData"), "KnowledgeBases");
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }
  return rootPath;
}

export function listKnowledgeBases(): KnowledgeBaseInfo[] {
  const rootPath = getKnowledgeBaseRoot();
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  const result: KnowledgeBaseInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const kbPath = path.join(rootPath, entry.name);
    const configPath = path.join(kbPath, "config.json");
    let createdAt: number;
    let description: string | undefined;

    if (fs.existsSync(configPath)) {
      try {
        const configContent = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(configContent);
        createdAt = config.createdAt ?? fs.statSync(kbPath).birthtimeMs;
        description = config.description;
      } catch {
        createdAt = fs.statSync(kbPath).birthtimeMs;
      }
    } else {
      createdAt = fs.statSync(kbPath).birthtimeMs;
    }

    result.push({
      name: entry.name,
      path: kbPath,
      createdAt,
      description,
    });
  }

  result.sort((a, b) => b.createdAt - a.createdAt);
  return result;
}

export function createKnowledgeBase(params: CreateKnowledgeBaseParams): KnowledgeBaseInfo | null {
  const rootPath = getKnowledgeBaseRoot();
  const kbPath = path.join(rootPath, params.name);

  if (fs.existsSync(kbPath)) {
    return null;
  }

  fs.mkdirSync(kbPath, { recursive: true });
  fs.mkdirSync(path.join(kbPath, "docs"), { recursive: true });
  fs.mkdirSync(path.join(kbPath, ".index"), { recursive: true });

  const now = Date.now();
  const config: KnowledgeBaseConfig = {
    name: params.name,
    description: params.description,
    createdAt: now,
    aiConfig: { useGlobal: true },
  };
  fs.writeFileSync(path.join(kbPath, "config.json"), JSON.stringify(config, null, 2), "utf-8");

  // 创建默认 README
  const readmeContent = `# ${params.name}

欢迎使用 MarbyMarkdown 知识库！

## 简介

${params.description || "这是一个全新的知识库，等待你的探索。"}

## 使用指南

- 在左侧导航栏查看文件结构
- 点击文件打开进行编辑
- 使用 AI 辅助创作和优化

---

*由 MarbyMarkdown 知识库功能提供支持*
`;
  fs.writeFileSync(path.join(kbPath, "README.md"), readmeContent, "utf-8");

  return {
    name: params.name,
    path: kbPath,
    createdAt: now,
    description: params.description,
  };
}

export function getKnowledgeBaseConfig(kbPath: string): KnowledgeBaseConfig | null {
  const configPath = path.join(kbPath, "config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function updateKnowledgeBaseConfig(kbPath: string, config: Partial<KnowledgeBaseConfig>): boolean {
  const existing = getKnowledgeBaseConfig(kbPath);
  if (!existing) {
    return false;
  }
  const newConfig = { ...existing, ...config };
  try {
    fs.writeFileSync(path.join(kbPath, "config.json"), JSON.stringify(newConfig, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function deleteKnowledgeBase(kbPath: string): boolean {
  if (!fs.existsSync(kbPath)) {
    return false;
  }

  const rootPath = getKnowledgeBaseRoot();
  const normalizedPath = path.resolve(kbPath);
  const normalizedRoot = path.resolve(rootPath);

  if (!normalizedPath.startsWith(normalizedRoot + path.sep) && normalizedPath !== normalizedRoot) {
    return false;
  }

  fs.rmSync(kbPath, { recursive: true, force: true });
  return true;
}

export function openKnowledgeBaseInExplorer(): void {
  const rootPath = getKnowledgeBaseRoot();
  shell.openPath(rootPath);
}
