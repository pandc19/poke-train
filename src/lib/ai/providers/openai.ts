import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { AiError, type AiProvider, type GenerateRequest } from '../types';

/**
 * OpenAI model ids churn independently of this project, so the model is
 * overridable via env instead of requiring a code change.
 */
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export class OpenAiProvider implements AiProvider {
  readonly name = 'openai' as const;
  readonly model = MODEL;
  private client = new OpenAI(); // reads OPENAI_API_KEY

  async generate<T>({ system, prompt, schema, schemaName, webSearch }: GenerateRequest<T>): Promise<T> {
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: system,
        input: prompt,
        tools: webSearch ? [{ type: 'web_search' }] : [],
        text: { format: zodTextFormat(schema, schemaName) },
      });
      if (response.output_parsed == null) throw new AiError('OpenAI returned no usable answer. Try again.');
      return response.output_parsed as T;
    } catch (error) {
      if (error instanceof OpenAI.AuthenticationError) throw new AiError('OPENAI_API_KEY was rejected. Check .env.local.');
      if (error instanceof OpenAI.RateLimitError) throw new AiError('OpenAI rate limit or quota reached. Try again later.');
      if (error instanceof OpenAI.APIError) throw new AiError(`OpenAI error ${error.status ?? ''}: ${error.message}`);
      throw error;
    }
  }
}
