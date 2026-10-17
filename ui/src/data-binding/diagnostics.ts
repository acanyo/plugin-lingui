import type { ComponentNode } from '@lingui/renderer'
import { sampleValue, type DataSample } from './samples'
export function bindingDiagnostics(node: ComponentNode, samples: DataSample[]) {
  const issues: Array<{ level: 'error' | 'warning'; message: string }> = []
  for (const binding of Object.values(node.bindings ?? {})) {
    const value = sampleValue(samples, binding.path)
    if (value === undefined) {
      const known = samples.find(
        (sample) =>
          sample.origin !== 'initial' &&
          sample.origin !== undefined &&
          (binding.path === sample.path || binding.path.startsWith(`${sample.path}/`)) &&
          sample.value &&
          typeof sample.value === 'object' &&
          Object.keys(sample.value).length,
      )
      issues.push(
        known
          ? { level: 'error', message: `数据路径 ${binding.path} 不存在于${known.label}中。` }
          : {
              level: 'warning',
              message: `数据路径 ${binding.path} 暂无初始值或接口返回示例，需运行验证。`,
            },
      )
    } else if (binding.map && (value === null || (Array.isArray(value) && !value.length))) {
      issues.push({
        level: 'warning',
        message: `数据路径 ${binding.path} 的示例为空，字段映射需用实际记录验证。`,
      })
    }
  }
  return issues
}
