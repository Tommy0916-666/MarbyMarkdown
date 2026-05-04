import type { AIConfig, AIOptimizationStyle } from "@/renderer/hooks/useAIConfig";

export interface APIContext {
  fileTitle?: string;
  sectionTitle?: string;
  subSectionTitle?: string;
  previousContent: string;
}

export interface CompletionResponse {
  continuation: string;
}

const SYSTEM_PROMPT = `你是一个技术文档续写助手。
- **绝对不要重复用户输入的任何内容**
- 只输出接下来要续写的3–35个汉字
严格只输出以下 JSON，**不要有任何前缀、后缀、markdown、换行、解释**：

{"continuation": "接下来只写3–35个汉字的自然衔接内容"}
`;

const OPTIMIZE_PROMPT_BASE = `你是一个文本优化助手，负责优化用户的文本。
严格只输出以下 JSON，**不要有任何前缀、后缀、markdown、换行、解释**：

{"optimizedText": "优化后的文本内容"}
`;

const KNOWLEDGE_BASE_TITLE_PROMPT = `你是一个知识库标题优化助手。
- 将用户输入的标题优化为更吸引人、更专业的知识库标题
- 标题要简洁明了，通常在 4-12 个汉字之间
- 保留原标题的核心含义
- 严格只输出以下 JSON，**不要有任何前缀、后缀、markdown、换行、解释**：

{"optimizedTitle": "优化后的标题"}
`;

const KNOWLEDGE_BASE_DESCRIPTION_PROMPT = `你是一个知识库简介优化助手。
- 将用户输入的简介优化为更流畅、更吸引人的知识库描述
- 简介要清晰说明知识库的用途和内容
- 通常在 20-100 个汉字之间
- 保留原简介的核心信息
- 严格只输出以下 JSON，**不要有任何前缀、后缀、markdown、换行、解释**：

{"optimizedDescription": "优化后的简介"}
`;

function getStyleDescription(style: AIOptimizationStyle, customPrompt: string): string {
  switch (style) {
    case "formal":
      return "请将文本优化为更加正式、专业的风格";
    case "casual":
      return "请将文本优化为更加轻松、口语化的风格";
    case "concise":
      return "请将文本优化为更加简洁、精炼的风格";
    case "custom":
      return customPrompt || "请优化这段文本";
  }
}

const OPTIMIZE_RESPONSE_SCHEMA = {
  type: "json_object",
};

const RESPONSE_SCHEMA = {
  type: "json_object",
};

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatSession {
  id: string;
  filePath: string;
  fileName: string;
  title: string; // 会话标题，由AI生成
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export class AIService {
  private static async request(url: string, options: RequestInit): Promise<any> {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMsg += ` - ${JSON.stringify(errorBody)}`;
        } catch {
          errorMsg += ` - ${await response.text()}`;
        }
        throw new Error(errorMsg);
      }
      return await response.json();
    } catch (error: any) {
      console.error("[AI Service] Request failed:", error);
      throw error;
    }
  }

  static async chat(
    config: any,
    messages: ChatMessage[],
    documentContent?: string
  ): Promise<string> {
    console.log("[AI Service] chat called with config:", JSON.stringify(config, null, 2));

    let fullMessages: ChatMessage[] = [...messages];
    
    // 如果有文档内容，添加到 system prompt
    if (documentContent) {
      const systemPrompt = `你是一个文档助手。你正在帮助用户处理以下文档：

${documentContent}

请基于上述文档内容回答用户的问题。如果用户的问题与文档无关，请礼貌地告知用户。`;
      
      // 检查是否已有 system 消息，如果有就替换，没有就添加到开头
      const systemIndex = fullMessages.findIndex(m => m.role === "system");
      if (systemIndex >= 0) {
        fullMessages[systemIndex] = { role: "system", content: systemPrompt };
      } else {
        fullMessages.unshift({ role: "system", content: systemPrompt });
      }
    }

    let url = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    switch (config.provider) {
      case "openai":
      case "custom":
        url = `${config.baseUrl}/chat/completions`;
        console.log("[AI Service] Chat - Using URL:", url, "Provider:", config.provider, "Model:", config.model);
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages: fullMessages,
          temperature: config.temperature,
          stream: false,
        };
        break;

      case "anthropic":
        url = `${config.baseUrl}/v1/messages`;
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        
        // 提取 system 消息（如果有）
        let systemContent = "";
        let userMessages = fullMessages;
        const systemMessage = fullMessages.find(m => m.role === "system");
        if (systemMessage) {
          systemContent = systemMessage.content;
          userMessages = fullMessages.filter(m => m.role !== "system");
        }
        
        body = {
          model: config.model,
          system: systemContent || undefined,
          messages: userMessages,
          max_tokens: 2048,
          stream: false,
        };
        break;

      case "gemini":
        url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        // 转换消息格式
        const geminiContents = fullMessages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        body = {
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: config.temperature,
          },
        };
        break;

      case "ollama":
        url = `${config.baseUrl}/api/chat`;
        body = {
          model: config.model,
          messages: fullMessages,
          stream: false,
          options: {
            temperature: config.temperature,
          },
        };
        break;
    }

    const response = await this.request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let content = "";

    if (config.provider === "openai" || config.provider === "custom") {
      content = response.choices?.[0]?.message?.content || "";
    } else if (config.provider === "anthropic") {
      content = response.content?.find((c: any) => c.type === "text")?.text || "";
    } else if (config.provider === "gemini") {
      content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (config.provider === "ollama") {
      content = response.message?.content || "";
    }

    return content;
  }

  // 从AI回复中解析用户看到的内容和标题
  static parseChatResponse(fullContent: string): { content: string; title?: string } {
    // 更灵活的匹配，支持各种可能的格式
    const jsonMatch = fullContent.match(/\{[^{}]*"title"[^{}]*:[^{}]*"([^"]+)"[^{}]*\}\s*$/);
    if (jsonMatch) {
      const contentPart = fullContent.substring(0, fullContent.length - jsonMatch[0].length).trim();
      let title = jsonMatch[1].trim();
      
      // 确保标题在7-15字之间
      if (title.length < 2) {
        title = "新对话";
      } else if (title.length > 30) { // 放宽一点，可能包含标点
        title = title.substring(0, 15) + "...";
      }
      
      return { content: contentPart, title };
    }
    
    // 找不到 JSON 就把所有内容给用户，没有标题
    return { content: fullContent };
  }

  // 流式输出版本
  static async chatStream(
    config: any,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete: (title?: string) => void,
    onError: (error: any) => void,
    documentContent?: string
  ): Promise<void> {
    console.log("[AI Service] chatStream called with config:", JSON.stringify(config, null, 2));

    let fullMessages: ChatMessage[] = [...messages];
    
    // 构建系统提示词
    let systemPromptContent = "";
    if (documentContent) {
      systemPromptContent = `你是一个文档助手。你正在帮助用户处理以下文档：

${documentContent}

请基于上述文档内容回答用户的问题。如果用户的问题与文档无关，请礼貌地告知用户。`;
    } else {
      systemPromptContent = "你是一个文档助手，帮助用户处理各种文档相关问题。";
    }
    
    // 添加标题生成要求（非常明确和具体）
    systemPromptContent += `

【重要要求 - 必须严格遵守】
1. 优先完整回答用户的问题，确保回答质量
2. 在回答的最后，必须单独起一行，添加一个JSON格式的标题
3. JSON格式必须是：{"title": "这里是标题内容"}
4. 标题要求：
   - 7-15个汉字（不含标点符号）
   - 准确概括本次对话的核心内容
   - 不要太泛泛（如不要用"文档对话"、"聊天记录"这种）
   - 要具体体现对话主题
5. 这个JSON只放在最后一行，不要出现在回答的其他地方
6. 确保JSON格式正确，没有语法错误`;

    // 添加或替换系统消息
    const systemIndex = fullMessages.findIndex(m => m.role === "system");
    if (systemIndex >= 0) {
      fullMessages[systemIndex] = { role: "system", content: systemPromptContent };
    } else {
      fullMessages.unshift({ role: "system", content: systemPromptContent });
    }

    let url = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    switch (config.provider) {
      case "openai":
      case "custom":
        url = `${config.baseUrl}/chat/completions`;
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages: fullMessages,
          temperature: config.temperature,
          stream: true,
        };
        break;

      case "anthropic":
        url = `${config.baseUrl}/v1/messages`;
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        
        let systemContent = "";
        let userMessages = fullMessages;
        const systemMessage = fullMessages.find(m => m.role === "system");
        if (systemMessage) {
          systemContent = systemMessage.content;
          userMessages = fullMessages.filter(m => m.role !== "system");
        }
        
        body = {
          model: config.model,
          system: systemContent || undefined,
          messages: userMessages,
          max_tokens: 2048,
          stream: true,
        };
        break;

      case "ollama":
        url = `${config.baseUrl}/api/chat`;
        body = {
          model: config.model,
          messages: fullMessages,
          stream: true,
          options: {
            temperature: config.temperature,
          },
        };
        break;

      case "gemini":
        // Gemini streaming uses different endpoint format
        url = `${config.baseUrl}/v1beta/models/${config.model}:streamGenerateContent?key=${config.apiKey}`;
        const geminiContents = fullMessages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
        body = {
          contents: geminiContents,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: config.temperature,
          },
        };
        break;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
        try {
          const errorBody = await response.json();
          errorMsg += ` - ${JSON.stringify(errorBody)}`;
        } catch {
          errorMsg += ` - ${await response.text()}`;
        }
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // 保留最后一行不完整的数据

        for (const line of lines) {
          if (!line.trim()) continue;

          if (config.provider === "openai" || config.provider === "custom") {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const data = JSON.parse(dataStr);
                const delta = data.choices?.[0]?.delta?.content;
                if (delta) {
                  onChunk(delta);
                }
              } catch {
                // 忽略解析错误
              }
            }
          } else if (config.provider === "ollama") {
            try {
              const data = JSON.parse(line);
              const delta = data.message?.content;
              if (delta) {
                onChunk(delta);
              }
            } catch {
              // 忽略解析错误
            }
          } else if (config.provider === "anthropic") {
            if (line.startsWith("data: ")) {
              const dataStr = line.substring(6).trim();
              try {
                const data = JSON.parse(dataStr);
                if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
                  const delta = data.delta?.text;
                  if (delta) {
                    onChunk(delta);
                  }
                }
              } catch {
                // 忽略解析错误
              }
            }
          } else if (config.provider === "gemini") {
            try {
              // Gemini streams JSON arrays sometimes, need to handle carefully
              const data = JSON.parse(line);
              if (Array.isArray(data)) {
                for (const item of data) {
                  const delta = item.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (delta) {
                    onChunk(delta);
                  }
                }
              } else {
                const delta = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (delta) {
                  onChunk(delta);
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // 流式输出结束后，解析完整内容并提取标题
      const parsed = AIService.parseChatResponse(buffer);
      onComplete(parsed.title);
    } catch (error) {
      onError(error);
    }
  }

  private static buildPrompt(context: APIContext): string {
    return `上下文：
文章标题：${context.fileTitle || "未知"}
大标题：${context.sectionTitle || "未知"}
本小节标题：${context.subSectionTitle || "未知"}
前面内容（请紧密衔接）：${context.previousContent}`;
  }

  private static parseResponse(text: string): CompletionResponse {
    try {
      // 1. Try generic JSON parsing
      // Remove generic markdown code block if present
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      const json = JSON.parse(cleanText);
      if (json.continuation) {
        return { continuation: json.continuation };
      }
    } catch (e) {
      console.warn("[AI Service] JSON parse failed, trying regex extraction", e);
    }

    // 2. Regex fallback
    const match = text.match(/"continuation"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return { continuation: match[1] };
    }

    // 3. Last resort fallback (if AI just returned text)
    if (text.length < 50 && !text.includes("{")) {
      return { continuation: text.trim() };
    }

    throw new Error("Failed to parse AI response");
  }

  private static parseOptimizationResponse(text: string): string {
    try {
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      const json = JSON.parse(cleanText);
      if (json.optimizedText) {
        return json.optimizedText;
      }
    } catch (e) {
      console.warn("[AI Service] JSON parse failed for optimization, trying regex extraction", e);
    }

    const match = text.match(/"optimizedText"\s*:\s*"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }

    if (text.length < 1000 && !text.includes("{")) {
      return text.trim();
    }

    throw new Error("Failed to parse optimization response");
  }

  static async optimize(
    config: AIConfig,
    originalText: string,
    style: AIOptimizationStyle,
    customPrompt: string
  ): Promise<string | null> {
    console.log("[AI Service] optimize called with config:", JSON.stringify(config, null, 2));
    const styleInstruction = getStyleDescription(style, customPrompt);
    const userMessage = `${styleInstruction}\n\n原始文本：\n${originalText}`;

    let url = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    switch (config.provider) {
      case "openai":
      case "custom":
        url = `${config.baseUrl}/chat/completions`;
        console.log("[AI Service] Optimize - Using URL:", url, "Provider:", config.provider, "Model:", config.model);
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: OPTIMIZE_PROMPT_BASE },
            { role: "user", content: userMessage },
          ],
          temperature: config.temperature,
          stream: false,
          response_format: OPTIMIZE_RESPONSE_SCHEMA,
        };
        break;

      case "anthropic":
        url = `${config.baseUrl}/v1/messages`;
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";

        const toolSchema = {
          name: "print_optimized_text",
          description: "Print the optimized text",
          input_schema: {
            type: "object",
            properties: {
              optimizedText: {
                type: "string",
                description: "优化后的文本",
              },
            },
            required: ["optimizedText"],
          },
        };

        body = {
          model: config.model,
          system: OPTIMIZE_PROMPT_BASE,
          messages: [{ role: "user", content: userMessage }],
          max_tokens: 1024,
          stream: false,
          tools: [toolSchema],
          tool_choice: { type: "tool", name: "print_optimized_text" },
        };
        break;

      case "gemini":
        url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        body = {
          contents: [
            {
              parts: [{ text: OPTIMIZE_PROMPT_BASE + "\n" + userMessage }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                optimizedText: { type: "STRING" },
              },
              required: ["optimizedText"],
            },
            maxOutputTokens: 1024,
          },
        };
        break;

      case "ollama":
        url = `${config.baseUrl}/api/chat`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: OPTIMIZE_PROMPT_BASE },
            { role: "user", content: userMessage },
          ],
          format: "json",
          stream: false,
          options: {
            temperature: config.temperature,
          },
        };
        break;
    }

    const response = await this.request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let content = "";

    if (config.provider === "openai" || config.provider === "custom") {
      content = response.choices?.[0]?.message?.content || "";
    } else if (config.provider === "anthropic") {
      if (response.content) {
        const toolUse = response.content.find((c: any) => c.type === "tool_use");
        if (toolUse && toolUse.input) {
          if (toolUse.input.optimizedText) {
            return toolUse.input.optimizedText;
          }
        }
        content = response.content.find((c: any) => c.type === "text")?.text || "";
      }
    } else if (config.provider === "gemini") {
      content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (config.provider === "ollama") {
      content = response.message?.content || "";
    }

    return this.parseOptimizationResponse(content);
  }

  static async optimizeKnowledgeBaseTitle(
    config: AIConfig,
    originalTitle: string
  ): Promise<string> {
    console.log("[AI Service] optimizeKnowledgeBaseTitle called");
    const userMessage = `请优化以下知识库标题：\n${originalTitle}`;
    const response = await this._callKnowledgeBaseAI(
      config,
      KNOWLEDGE_BASE_TITLE_PROMPT,
      userMessage,
      "optimizedTitle"
    );
    return response;
  }

  static async optimizeKnowledgeBaseDescription(
    config: AIConfig,
    originalDescription: string
  ): Promise<string> {
    console.log("[AI Service] optimizeKnowledgeBaseDescription called");
    const userMessage = `请优化以下知识库简介：\n${originalDescription}`;
    const response = await this._callKnowledgeBaseAI(
      config,
      KNOWLEDGE_BASE_DESCRIPTION_PROMPT,
      userMessage,
      "optimizedDescription"
    );
    return response;
  }

  private static async _callKnowledgeBaseAI(
    config: AIConfig,
    systemPrompt: string,
    userMessage: string,
    responseKey: string
  ): Promise<string> {
    let url = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    switch (config.provider) {
      case "openai":
      case "custom":
        url = `${config.baseUrl}/chat/completions`;
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          temperature: 0.7,
          stream: false,
        };
        break;

      case "anthropic":
        url = `${config.baseUrl}/v1/messages`;
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        const anthropicToolSchema = {
          name: "print_result",
          description: "Print the result",
          input_schema: {
            type: "object",
            properties: {
              [responseKey]: { type: "string" },
            },
            required: [responseKey],
          },
        };
        body = {
          model: config.model,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
          max_tokens: 512,
          stream: false,
          tools: [anthropicToolSchema],
          tool_choice: { type: "tool", name: "print_result" },
        };
        break;

      case "gemini":
        url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        body = {
          contents: [{ parts: [{ text: systemPrompt + "\n" + userMessage }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { [responseKey]: { type: "STRING" } },
              required: [responseKey],
            },
            maxOutputTokens: 512,
          },
        };
        break;

      case "ollama":
        url = `${config.baseUrl}/api/chat`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          format: "json",
          stream: false,
          options: { temperature: 0.7 },
        };
        break;
    }

    const response = await this.request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let content = "";
    if (config.provider === "openai" || config.provider === "custom") {
      content = response.choices?.[0]?.message?.content || "";
    } else if (config.provider === "anthropic") {
      if (response.content) {
        const toolUse = response.content.find((c: any) => c.type === "tool_use");
        if (toolUse && toolUse.input && toolUse.input[responseKey]) {
          return toolUse.input[responseKey];
        }
        content = response.content.find((c: any) => c.type === "text")?.text || "";
      }
    } else if (config.provider === "gemini") {
      content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (config.provider === "ollama") {
      content = response.message?.content || "";
    }

    try {
      const cleanText = content.replace(/```json\n?|\n?```/g, "").trim();
      const json = JSON.parse(cleanText);
      if (json[responseKey]) {
        return json[responseKey];
      }
    } catch (e) {
      const match = content.match(new RegExp(`"${responseKey}"\\s*:\\s*"([^"]+)"`));
      if (match && match[1]) {
        return match[1];
      }
    }
    return content.trim();
  }

  static async testConnection(config: AIConfig): Promise<boolean> {
    if (!config.baseUrl) throw new Error("Base URL is required");

    // Non-Ollama providers require API Key
    if (config.provider !== "ollama" && !config.apiKey) {
      throw new Error("API Key is required");
    }

    switch (config.provider) {
      case "ollama":
        try {
          // Check tags for Ollama
          await this.request(`${config.baseUrl}/api/tags`, { method: "GET" });
          return true;
        } catch {
          return false;
        }
      case "openai":
      case "custom":
        try {
          // 使用简单的聊天请求测试，而不是 /models 端点，提高兼容性
          await this.request(`${config.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: "Hi" }],
              max_tokens: 1,
              stream: false,
            }),
          });
          return true;
        } catch (error) {
          console.error("[AI Service] OpenAI/Custom connection test failed:", error);
          return false;
        }
      case "anthropic":
        try {
          // Try a simple messages request with max_tokens 1 to test connection
          await this.request(`${config.baseUrl}/v1/messages`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": config.apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: "user", content: "Hi" }],
              max_tokens: 1,
            }),
          });
          return true;
        } catch {
          return false;
        }
      case "gemini":
        try {
          // Try a simple generateContent request
          await this.request(
            `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "Hi" }] }],
                generationConfig: { maxOutputTokens: 1 },
              }),
            }
          );
          return true;
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  static async getModels(config: AIConfig): Promise<string[]> {
    if (config.provider === "ollama") {
      try {
        const res = await this.request(`${config.baseUrl}/api/tags`, { method: "GET" });
        return res.models?.map((m: any) => m.name) || [];
      } catch (e) {
        console.error("Failed to fetch Ollama models", e);
        return [];
      }
    }
    return [];
  }

  static async complete(config: AIConfig, context: APIContext): Promise<CompletionResponse> {
    console.log("[AI Service] complete called with config:", JSON.stringify(config, null, 2));
    const userMessage = this.buildPrompt(context);

    let url = "";
    let headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let body: any = {};

    switch (config.provider) {
      case "openai":
      case "custom":
        url = `${config.baseUrl}/chat/completions`;
        console.log("[AI Service] Complete - Using URL:", url, "Provider:", config.provider, "Model:", config.model);
        headers["Authorization"] = `Bearer ${config.apiKey}`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: config.temperature,
          stream: false,
          // OpenAI Structured Outputs
          response_format: RESPONSE_SCHEMA,
        };
        break;

      case "anthropic":
        url = `${config.baseUrl}/v1/messages`;
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        // Anthropic doesn't have "response_format" in the same way, but we can stick to prompt engineering
        // OR use tool use if we wanted strict enforcement, but for simple completion, prompt is often enough.
        // However, user asked to use API level restrictions if available.
        // Anthropic specific: prefill assistant message to force JSON, or use tools.
        // Let's use the tool constraint approach which is the "Standard" way for structured output in Claude now.

        const toolSchema = {
          name: "print_continuation",
          description: "Print the continuation text",
          input_schema: {
            type: "object",
            properties: {
              continuation: {
                type: "string",
                description: "3–35 个汉字的续写",
              },
            },
            required: ["continuation"],
          },
        };

        body = {
          model: config.model,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
          max_tokens: 1024,
          stream: false,
          tools: [toolSchema],
          tool_choice: { type: "tool", name: "print_continuation" },
        };
        break;

      case "gemini":
        // Gemini API Structured Output
        url = `${config.baseUrl}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
        body = {
          contents: [
            {
              parts: [{ text: SYSTEM_PROMPT + "\n" + userMessage }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                continuation: { type: "STRING" },
              },
              required: ["continuation"],
            },
            maxOutputTokens: 1024,
          },
        };
        break;

      case "ollama":
        url = `${config.baseUrl}/api/chat`;
        body = {
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          format: "json",
          stream: false,
          options: {
            temperature: config.temperature,
          },
        };
        break;
    }

    const response = await this.request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    let content = "";

    if (config.provider === "openai" || config.provider === "custom") {
      content = response.choices?.[0]?.message?.content || "";
    } else if (config.provider === "anthropic") {
      // Handle tool use response
      if (response.content) {
        const toolUse = response.content.find((c: any) => c.type === "tool_use");
        if (toolUse && toolUse.input) {
          // Directly return parsed input as it is already JSON object
          if (toolUse.input.continuation) {
            return { continuation: toolUse.input.continuation };
          }
        }
        // Fallback to text if tool wasn't used properly (unlikely with tool_choice forced)
        content = response.content.find((c: any) => c.type === "text")?.text || "";
      }
    } else if (config.provider === "gemini") {
      content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } else if (config.provider === "ollama") {
      content = response.message?.content || "";
    }

    return this.parseResponse(content);
  }
}
