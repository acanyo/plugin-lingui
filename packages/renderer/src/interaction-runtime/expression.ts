import type { Expression, JsonValue, State } from '../protocol/types'
import { readPath } from './pointer'
export function evaluate(expression: Expression, state: State, depth = 0): JsonValue {
  if (depth > 24) throw new Error('计算表达式层级过深')
  if (expression === null || typeof expression !== 'object') return expression
  if ('path' in expression && typeof expression.path === 'string')
    return readPath(state, expression.path) ?? null
  if (!('op' in expression) || !('args' in expression) || !Array.isArray(expression.args))
    throw new Error('计算表达式格式无效')
  const args = expression.args as Expression[]
  if (!args.length || args.length > 8) throw new Error('计算参数数量无效')
  const arity: Record<string, number> = {
    subtract: 2,
    divide: 2,
    mod: 2,
    round: 1,
    eq: 2,
    neq: 2,
    gt: 2,
    gte: 2,
    lt: 2,
    lte: 2,
    not: 1,
    if: 3,
    includes: 2,
  }
  if (arity[String(expression.op)] && args.length !== arity[String(expression.op)])
    throw new Error('计算参数数量无效')
  if (expression.op === 'if') {
    if (args.length !== 3) throw new Error('条件计算需要三个参数')
    return evaluate(args[evaluate(args[0]!, state, depth + 1) ? 1 : 2]!, state, depth + 1)
  }
  const values = args.map((arg) => evaluate(arg, state, depth + 1))
  const [a, b] = values
  const numeric = () => {
    if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v)))
      throw new Error('计算需要有效数字')
    return values as number[]
  }
  let result: JsonValue
  switch (expression.op) {
    case 'add':
      result = numeric().reduce((x, y) => x + y, 0)
      break
    case 'multiply':
      result = numeric().reduce((x, y) => x * y, 1)
      break
    case 'subtract':
      numeric()
      result = Number(a) - Number(b)
      break
    case 'divide':
      numeric()
      if (b === 0) throw new Error('除数不能为零')
      result = Number(a) / Number(b)
      break
    case 'mod':
      numeric()
      if (b === 0) throw new Error('除数不能为零')
      result = Number(a) % Number(b)
      break
    case 'min':
      result = Math.min(...numeric())
      break
    case 'max':
      result = Math.max(...numeric())
      break
    case 'round':
      numeric()
      result = Math.round(Number(a))
      break
    case 'eq':
      result = JSON.stringify(a) === JSON.stringify(b)
      break
    case 'neq':
      result = JSON.stringify(a) !== JSON.stringify(b)
      break
    case 'gt':
      numeric()
      result = Number(a) > Number(b)
      break
    case 'gte':
      numeric()
      result = Number(a) >= Number(b)
      break
    case 'lt':
      numeric()
      result = Number(a) < Number(b)
      break
    case 'lte':
      numeric()
      result = Number(a) <= Number(b)
      break
    case 'and':
      result = values.every(Boolean)
      break
    case 'or':
      result = values.some(Boolean)
      break
    case 'not':
      result = !a
      break
    case 'includes':
      result = Array.isArray(a) ? a.some((v) => JSON.stringify(v) === JSON.stringify(b)) : false
      break
    default:
      throw new Error('不支持的计算运算符')
  }
  if (typeof result === 'number' && !Number.isFinite(result)) throw new Error('计算结果超出范围')
  return result
}
