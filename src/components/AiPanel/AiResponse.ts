import { createElement, memo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { AiAction } from '../../types/ai.ts';

// Only explicit web/mail URLs are navigable. Relative and protocol-relative
// links must not navigate within the application or inherit a remote host.
export function safeResponseUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

const remarkPlugins = [remarkGfm, remarkMath];
// rehype-katex manages throwOnError internally; failures become inert source
// spans rather than exceptions. Untrusted commands remain disabled.
const rehypePlugins: NonNullable<Parameters<typeof Markdown>[0]['rehypePlugins']> = [
  [rehypeKatex, { trust: false, throwOnError: false, errorColor: '#1f2933', maxExpand: 1000, maxSize: 20 }],
];

const AiResponse = memo(function AiResponse({ action, text, pageNumber }: {
  action: AiAction | 'note'; text: string; pageNumber?: number;
}) {
  if (action === 'translate' || action === 'note') {
    return createElement('div', { className: 'ai-answer ai-answer-plain', 'data-testid': 'ai-answer', 'data-ai-selection-page': pageNumber }, text);
  }
  return createElement('div', { className: 'ai-answer ai-markdown', 'data-testid': 'ai-answer', 'data-ai-selection-page': pageNumber },
    createElement(Markdown, {
      remarkPlugins, rehypePlugins, skipHtml: true,
      disallowedElements: ['img'],
      urlTransform: safeResponseUrl,
      components: {
        a: ({ href, children }) => href
          ? createElement('a', { href, target: '_blank', rel: 'noopener noreferrer' }, children)
          : createElement('span', null, children),
        table: ({ children }) => createElement('div', { className: 'ai-table-scroll', tabIndex: 0, role: 'region', 'aria-label': 'Bảng kết quả AI' },
          createElement('table', null, children)),
      },
      children: text,
    }));
});

export default AiResponse;
