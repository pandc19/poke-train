import { describe, expect, it } from 'vitest';
import { claudeModels, claudeWebSearchTool, openAiModels } from '@/lib/ai/models';

describe('model settings', () => {
  it('uses the bulk and escalation pair when set', () => {
    expect(claudeModels({ CLAUDE_BULK_MODEL: 'claude-haiku-4-5', CLAUDE_ESCALATION_MODEL: 'claude-sonnet-5-5' })).toEqual({
      bulk: 'claude-haiku-4-5',
      deep: 'claude-sonnet-5-5',
    });
    expect(openAiModels({ OPENAI_BULK_MODEL: 'a', OPENAI_ESCALATION_MODEL: 'b' })).toEqual({ bulk: 'a', deep: 'b' });
  });

  it('falls back to the single-model setting, then to defaults', () => {
    expect(claudeModels({ CLAUDE_MODEL: 'claude-opus-5-5' })).toEqual({ bulk: 'claude-opus-5-5', deep: 'claude-opus-5-5' });
    expect(claudeModels({}).bulk).not.toBe(claudeModels({}).deep);
    expect(openAiModels({ OPENAI_MODEL: 'x' })).toEqual({ bulk: 'x', deep: 'x' });
  });

  it('lets one of the pair be set on its own', () => {
    expect(claudeModels({ CLAUDE_BULK_MODEL: 'claude-haiku-4-5', CLAUDE_MODEL: 'claude-opus-5-5' })).toEqual({
      bulk: 'claude-haiku-4-5',
      deep: 'claude-opus-5-5',
    });
  });
});

describe('web search tool by model', () => {
  it('uses the basic tool for Haiku and older models', () => {
    expect(claudeWebSearchTool('claude-haiku-4-5').type).toBe('web_search_20250305');
    expect(claudeWebSearchTool('claude-haiku-4-5-20251001').type).toBe('web_search_20250305');
    expect(claudeWebSearchTool('claude-sonnet-4-5').type).toBe('web_search_20250305');
  });

  it('uses the newer tool where it is supported', () => {
    for (const model of ['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-5-5', 'claude-sonnet-4-6', 'claude-fable-5-1']) {
      expect(claudeWebSearchTool(model).type).toBe('web_search_20260209');
    }
  });
});
