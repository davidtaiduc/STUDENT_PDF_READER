import {scopeLabel} from '../../../shared/ai/contextScope.ts';
import { createElement, memo } from 'react';
import type { PdfSelection } from '../../types/selection.ts';

/** Keep the exact excerpt visible while the native PDF highlight loses focus. */
const ChatExcerptPreview = memo(function ChatExcerptPreview({ selection, onClose }: {
  selection: Pick<PdfSelection, 'pageNumber' | 'cleanedText' | 'source' | 'scope'> | null;
  onClose?: () => void;
}) {
  if (!selection) return createElement('p', { className: 'chat-excerpt-empty' }, 'Tô đen một đoạn trong PDF bên trái để hỏi AI về đoạn đó.');
  return createElement('div', { className: 'chat-excerpt-preview', 'data-testid': 'chat-excerpt-preview' },
    onClose && createElement('button', { type: 'button', className: 'chat-excerpt-close', 'aria-label': 'Bỏ đoạn đã chọn', title: 'Bỏ đoạn đã chọn khỏi câu hỏi', onClick: onClose }, '×'),
    createElement('strong', null, `${selection.scope&&selection.scope.kind!=='selection'?scopeLabel(selection.scope,selection.pageNumber):`Đoạn đã chọn ${selection.source==='ai'?'từ kết quả AI':'trong PDF'} · Trang ${selection.pageNumber}`} · ${selection.cleanedText.length.toLocaleString('vi-VN')} ký tự`),
    createElement('blockquote', { 'data-testid': 'chat-selected-text' }, selection.cleanedText));
});
export default ChatExcerptPreview;
