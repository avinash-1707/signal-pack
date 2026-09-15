import { z } from "zod";

const providerFailureSchema = z.object({
  code: z.number().int().optional(),
  metadata: z.object({ error_type: z.string().optional() }).optional(),
});

const toolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.enum(["search_public_web", "extract_public_page", "finish_research"]),
    arguments: z.string(),
  }),
});

const completionSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable(),
    message: z.object({
      content: z.string().nullable(),
      tool_calls: z.array(toolCallSchema).optional(),
    }),
    error: providerFailureSchema.optional(),
  })).min(1),
});

export type OpenRouterToolCall = z.infer<typeof toolCallSchema>;

export type OpenRouterMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: OpenRouterToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type OpenRouterCompletion = {
  content: string | null;
  toolCalls: OpenRouterToolCall[];
};

export class OpenRouterError extends Error {
  constructor(readonly status: number, readonly retryable: boolean) {
    super("OpenRouter request failed");
  }
}

export class OpenRouter {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async complete(
    messages: OpenRouterMessage[],
    options: { tools?: unknown[]; responseFormat?: unknown },
  ): Promise<OpenRouterCompletion> {
    const response = await this.request("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        ...(options.tools ? { tools: options.tools, tool_choice: "auto", parallel_tool_calls: false } : {}),
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
        provider: { require_parameters: true },
        stream: false,
      }),
    });
    const payload: unknown = await response.json();

    if (!response.ok) {
      throw new OpenRouterError(response.status, [408, 429, 502, 503, 504].includes(response.status));
    }

    const completion = completionSchema.parse(payload);
    const choice = completion.choices[0]!;
    if (choice.error || choice.finish_reason === "error") {
      throw new OpenRouterError(choice.error?.code ?? 502, true);
    }

    return {
      content: choice.message.content,
      toolCalls: choice.message.tool_calls ?? [],
    };
  }
}
