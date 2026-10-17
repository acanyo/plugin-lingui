import {
  examples,
  resolveDocument,
  serializeSource,
  validateDocument,
} from '../../packages/renderer/dist/lingui-renderer.js'

/** Preserve the saved quiz layout; copy only the corrected submission behavior. */
export function repairQuiz(input) {
  const document = validateDocument(input)
  const { nodes } = resolveDocument(document)
  const fixed = resolveDocument(examples.find((example) => example.id === 'quiz').create()).nodes
  if (
    nodes.submit?.component !== 'Button' ||
    nodes.content?.component !== 'Column' ||
    nodes.choices?.value?.path !== '/answer'
  )
    throw new Error('测验结构已变化，请手动检查后修复')
  nodes.submit.disabled = fixed.submit.disabled
  nodes.submit.action = fixed.submit.action
  nodes.answerHint = fixed.answerHint
  nodes.answerHintText = fixed.answerHintText
  nodes.content.children = nodes.content.children.filter((id) => id !== 'answerHint')
  nodes.content.children.splice(nodes.content.children.indexOf('submit'), 0, 'answerHint')
  return validateDocument({ ...document, source: serializeSource(Object.values(nodes)) })
}
