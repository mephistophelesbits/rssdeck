export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'minimax' | 'kimi';

export interface AIResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface AIChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIRequestOptions {
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
}

export async function generateText(
    provider: AIProvider,
    prompt: string,
    options: AIRequestOptions
): Promise<AIResponse> {
    switch (provider) {
        case 'openai':
            return await generateOpenAI(prompt, options);
        case 'ollama':
            return await generateOllama(prompt, options);
        case 'anthropic':
            return await generateAnthropic(prompt, options);
        case 'gemini':
            return await generateGemini(prompt, options);
        case 'minimax':
            return await generateMinimax(prompt, options);
        case 'kimi':
            return await generateKimi(prompt, options);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

async function generateOllama(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    const baseUrl = options.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: options.model,
            prompt: prompt,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
                num_predict: options.maxTokens,
            }
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${error}`);
    }

    const data = await response.json();
    return { text: data.response };
}

async function generateOpenAI(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('OpenAI API key is required');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'gpt-4.1',
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
        }
    };
}

async function generateAnthropic(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Anthropic API key is required');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: options.model || 'claude-sonnet-4-6',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.7,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.content[0].text,
        usage: {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
    };
}

async function generateGemini(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Gemini API key is required');

    const model = options.model || 'gemini-3-pro-preview';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
            }
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.candidates[0].content.parts[0].text,
    };
}

async function generateMinimax(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Minimax API key is required');

    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'MiniMax-M2.5',
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Minimax error: ${error.base_resp?.status_msg || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
        }
    };
}

async function generateKimi(prompt: string, options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Kimi API key is required');

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'kimi-k2.5',
            messages: [{ role: 'user', content: prompt }],
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Kimi error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
        }
    };
}

export async function generateChat(
    provider: AIProvider,
    messages: AIChatMessage[],
    options: AIRequestOptions
): Promise<AIResponse> {
    switch (provider) {
        case 'openai':
            return await generateChatOpenAI(messages, options);
        case 'ollama':
            // For Ollama, we'll convert messages to a prompt since its /api/generate takes a prompt
            // Alternatively, we could use /api/chat but let's keep it simple for now
            return await generateChatOllama(messages, options);
        case 'anthropic':
            return await generateChatAnthropic(messages, options);
        case 'gemini':
            return await generateChatGemini(messages, options);
        case 'minimax':
            return await generateChatMinimax(messages, options);
        case 'kimi':
            return await generateChatKimi(messages, options);
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}

async function generateChatOpenAI(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('OpenAI API key is required');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'gpt-4.1',
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
        }
    };
}

async function generateChatOllama(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    const baseUrl = options.baseUrl || 'http://localhost:11434';
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: options.model,
            messages: messages,
            stream: false,
            options: {
                temperature: options.temperature ?? 0.7,
            }
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${error}`);
    }

    const data = await response.json();
    return { text: data.message.content };
}

async function generateChatAnthropic(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Anthropic API key is required');

    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': options.apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: options.model || 'claude-sonnet-4-6',
            system: systemMessage,
            messages: chatMessages,
            max_tokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.7,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.content[0].text,
        usage: {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        }
    };
}

async function generateChatGemini(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Gemini API key is required');

    const model = options.model || 'gemini-3-pro-preview';

    // Convert OpenAI-style messages to Gemini style
    const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const systemInstruction = messages.find(m => m.role === 'system')?.content;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${options.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens,
            }
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.candidates[0].content.parts[0].text,
    };
}

async function generateChatMinimax(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Minimax API key is required');

    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'MiniMax-M2.5',
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Minimax error: ${error.base_resp?.status_msg || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
        }
    };
}

async function generateChatKimi(messages: AIChatMessage[], options: AIRequestOptions): Promise<AIResponse> {
    if (!options.apiKey) throw new Error('Kimi API key is required');

    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
            model: options.model || 'kimi-k2.5',
            messages,
            temperature: options.temperature ?? 0.6,
            max_tokens: options.maxTokens,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Kimi error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
        text: data.choices[0].message.content,
        usage: {
            promptTokens: data.usage?.prompt_tokens ?? 0,
            completionTokens: data.usage?.completion_tokens ?? 0,
            totalTokens: data.usage?.total_tokens ?? 0,
        }
    };
}
