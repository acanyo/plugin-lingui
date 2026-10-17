import { readFile, writeFile } from 'node:fs/promises'
import { repairWeather } from './repairs/weather.mjs'
import { repairQuiz } from './repairs/quiz.mjs'

// Produces reviewable revisions from an explicit local export. Does not contact any server.
const [input, output] = process.argv.slice(2)
if (!input || !output)
  throw new Error(
    '用法：node scripts/repair-local-projects.mjs <本地资源导出.json> <修复草稿.json>',
  )
const resources = JSON.parse(await readFile(input, 'utf8'))
const patches = []
for (const [name, repair] of [
  ['component-9c28f032-3f3e-4c87-b6e3-fefb6424e4a7', repairWeather],
  ['lingui-example-quiz', repairQuiz],
]) {
  const resource = resources.find((item) => item.metadata.name === name)
  if (!resource) throw new Error(`未找到本地作品 ${name}`)
  const history = JSON.parse(resource.spec.history)
  const latest = history.at(-1)
  patches.push({
    name,
    expectedHistory: resource.spec.history,
    revision: {
      ...latest,
      version: latest.version + 1,
      createdAt: new Date().toISOString(),
      document: repair(latest.document),
    },
  })
}
await writeFile(output, JSON.stringify(patches, null, 2) + '\n')
console.log(`已生成 ${patches.length} 个本地修复草稿：${output}`)
