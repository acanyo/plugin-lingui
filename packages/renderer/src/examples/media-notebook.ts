import { softCard, column, document, grid, section } from './builders'
export function mediaNotebookExample() {
  const result = document(
    '多媒体笔记',
    [
      column('root', ['heading', 'cover', 'resources']),
      section(
        'heading',
        '把灵感，放在一起',
        '一张配图、一段讲解、一份声音记录，为文章补上文字之外的细节。',
        [],
        '多媒体笔记',
      ),
      {
        id: 'cover',
        component: 'Image',
        url: { path: '/cover' },
        description: '文章配图',
        variant: 'header',
        fit: 'cover',
      },
      grid('resources', ['video-card', 'audio-card']),
      softCard('video-card', 'video-section'),
      softCard('audio-card', 'audio-section'),
      section('video-section', '看一遍演示', '放入自己的视频，读者可以在文章中直接播放。', [
        'video',
      ]),
      { id: 'video', component: 'Video', url: { path: '/video' }, description: '操作演示' },
      section('audio-section', '听一段讲述', '保留你的声音，也可以添加已有的音频资料。', ['audio']),
      { id: 'audio', component: 'AudioPlayer', url: { path: '/audio' }, description: '声音笔记' },
    ],
    { cover: '', video: '', audio: '' },
  )
  result.parameters = [
    { key: 'cover', label: '配图地址', path: '/cover', type: 'string', default: '' },
    { key: 'video', label: '视频地址', path: '/video', type: 'string', default: '' },
    { key: 'audio', label: '音频地址', path: '/audio', type: 'string', default: '' },
  ]
  return result
}
