import { buildAiPrompt } from '../src/ai-prompt.js';

describe('AI prompt instructions', () => {
  test('returns a canonical AGENTS.md prompt with Studio guidance', () => {
    const prompt = buildAiPrompt();

    expect(prompt).toContain('DeckDown');
    expect(prompt).toContain('DeckDown Studio');
    expect(prompt).toContain('deck.md');
    expect(prompt).toContain('AGENTS.md');
  });
});
