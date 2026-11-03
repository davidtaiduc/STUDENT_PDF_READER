import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChatExcerptPreview from '../src/components/AiPanel/ChatExcerptPreview.ts';

test('chat displays the exact PDF excerpt as text, not just its page number', () => {
  const source = '# Selected PDF\n- **Original**\nE = mc^2\nTiếng Việt';
  const html = renderToStaticMarkup(createElement(ChatExcerptPreview, { selection: {pageNumber:3,cleanedText:source} }));
  assert.match(html,/Đoạn đã chọn trong PDF · Trang 3/);
  assert.ok(html.includes(source));
  assert.match(html,/data-testid="chat-selected-text"/);
  assert.doesNotMatch(html,/<h1>|<strong>Original/);
});
test('missing excerpt gives clear PDF selection guidance, while AI source is labelled separately', () => {
  assert.match(renderToStaticMarkup(createElement(ChatExcerptPreview,{selection:null})),/Tô đen một đoạn trong PDF/);
  assert.match(renderToStaticMarkup(createElement(ChatExcerptPreview,{selection:{pageNumber:1,cleanedText:'AI text',source:'ai'}})),/từ kết quả AI/);
});
