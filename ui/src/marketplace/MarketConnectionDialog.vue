<script setup lang="ts">
import { ref } from 'vue'
import { reset } from '@formkit/vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import {
  marketService,
  marketSite,
  marketName,
  marketError,
  type MarketConnection,
} from './market-service'
const emit = defineEmits<{ close: []; connected: [connection: MarketConnection] }>()
const busy = ref(false),
  error = ref('')
async function connect(values: { token: string }, node: Parameters<typeof reset>[0]) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    emit('connected', await marketService.connect(values.token.trim()))
  } catch (cause) {
    error.value = marketError(cause)
  } finally {
    reset(node)
    busy.value = false
  }
}
</script>
<template>
  <VModal title="连接市场账号" :width="540" :close-disabled="busy" @close="emit('close')">
    <div class="lingui-studio lu-market-connect">
      <p>
        连接你在 <strong>{{ marketName }}</strong> 的账号，即可从工作台投稿并查看审核结果。
      </p>
      <ol>
        <li>
          <a :href="`${marketSite}/uc`" target="_blank" rel="noopener noreferrer"
            >打开市场用户中心</a
          >，登录你的市场账号。
        </li>
        <li>在个人访问令牌中创建令牌，授予读取个人资料与「提交作品与查看自己的审核结果」权限。</li>
        <li>粘贴令牌完成连接。令牌由当前站点的 Halo Secret 保存，按工作台账号隔离。</li>
      </ol>
      <FormKit type="form" :actions="false" @submit="connect">
        <FormKit
          type="password"
          name="token"
          label="市场个人访问令牌"
          validation="required|length:1,4096"
          autocomplete="off"
          :disabled="busy"
        />
        <p v-if="error" role="alert" class="lu-error">{{ error }}</p>
        <button type="submit" class="lu-button primary" :disabled="busy">
          {{ busy ? '正在验证…' : '连接账号' }}
        </button>
      </FormKit>
      <p class="lu-muted">
        若没有投稿权限，请由市场管理员为你的账号授权。工作台账号和市场账号可以不同。
      </p>
    </div>
    <template #footer
      ><VButton class="lu-button" :disabled="busy" @click="emit('close')">取消</VButton></template
    >
  </VModal>
</template>
