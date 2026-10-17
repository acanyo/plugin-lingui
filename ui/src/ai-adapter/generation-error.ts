import { GenerationOutputError, GenerationCheckError } from './output-error'
import { GenerationContractError } from './contract-check'
import { EditScopeError } from '../scoped-edit/model'
/** Read only diagnostic fields from our API; never display headers or raw provider responses. */
export function generationError(error: unknown): { text: string; details: string } {
  if (error instanceof EditScopeError)
    return {
      text: 'AI 修改超出所选范围，自动修正后仍未通过。当前作品已保留；可以重试，或切换为整件作品修改。',
      details: error.message,
    }
  if (error instanceof GenerationCheckError)
    return {
      text: '已尝试自动修复 2 轮，仍有交互问题。当前作品已保留，可查看待修复草稿。',
      details: error.message,
    }
  if (error instanceof GenerationOutputError) return generationError(error.problem)
  if (error instanceof GenerationContractError)
    return {
      text: 'AI 自动修正后仍有配置问题，当前作品已保留。可以调整需求或接口示例后重试。',
      details: error.message,
    }
  const cause = error as
    | {
        message?: string
        code?: string
        response?: { status?: number; data?: Record<string, unknown> }
      }
    | undefined
  const response = cause?.response
  const data = response?.data
  const detail = typeof data?.detail === 'string' ? data.detail : undefined
  const reference = typeof data?.reference === 'string' ? data.reference : undefined
  const providerStatus = typeof data?.providerStatus === 'number' ? data.providerStatus : undefined
  const categories: Record<string, string> = {
    'default-model': '未配置默认模型',
    'model-unavailable': '模型不可用',
    'provider-http': '服务商拒绝或未完成请求',
    timeout: '生成超时',
    'invalid-design': '生成内容未通过作品校验',
    'tool-limit': '模型未在工具轮次内完成设计',
    connection: '服务商连接失败',
    'response-limit': '响应超过接收上限',
    'output-limit': '输出达到模型长度上限',
    unknown: 'AI 调用异常',
  }
  const category = typeof data?.category === 'string' ? categories[data.category] : undefined
  let text = detail || cause?.message || 'AI 调用失败，请稍后重试。'
  if (!response && cause?.code === 'ERR_NETWORK')
    text = '浏览器无法连接 Halo，请检查网络和本地服务是否运行后重试。'
  else if (!response && ['ECONNABORTED', 'ETIMEDOUT'].includes(cause?.code ?? ''))
    text = '等待 Halo 响应超时，请稍后重试；可以根据 Halo 日志确认模型是否完成。'
  else if (response?.status === 403 && !category)
    text = '没有 AI 生成权限，请联系管理员授予 AI 生成权限。'
  else if (response?.status === 401 && !category) text = '登录已失效，请重新登录 Halo 后重试。'
  const invalid =
    !response &&
    /OpenUI|A2UI|JSON|文档|组件.*(?:目录|格式|缺少|字段|循环|安全)|参数.*(?:格式|范围|类型|默认|名称)|数据.*(?:安全|超过|过大)/.test(
      text,
    )
  const details = [
    invalid ? text : undefined,
    category ? `问题类型：${category}` : undefined,
    response?.status ? `工作台接口：HTTP ${response.status}` : undefined,
    providerStatus ? `AI 服务商：HTTP ${providerStatus}` : undefined,
    reference ? `诊断编号：${reference}` : undefined,
    !response && cause?.code ? `连接状态：${cause.code}` : undefined,
  ]
    .filter(Boolean)
    .join('\n')
  return {
    text: invalid ? '这次生成的组件格式不完整。请重试，或把需求拆成更小的步骤。' : text,
    details: details || text,
  }
}
