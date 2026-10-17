import { section, grid, softCard, column, document, metric, text } from './builders'

export function statisticsExample() {
  return document('数据概览', [
    section(
      'root',
      '把进步看得更清楚',
      '用少量关键数字，回顾一段时间的积累。',
      ['content'],
      '本月阅读记录',
    ),
    column('content', ['metrics', 'note']),
    grid('metrics', ['articles-card', 'minutes-card', 'notes-card'], 3),
    softCard('articles-card', 'articles'),
    softCard('minutes-card', 'minutes'),
    softCard('notes-card', 'notes'),
    metric('articles', '读完文章', '12', '篇'),
    metric('minutes', '专注阅读', '180', '分钟'),
    metric('notes', '留下笔记', '28', '条'),
    text('note', '此处为示例数据，可在编辑器中替换成你的记录。', 'caption'),
  ])
}
