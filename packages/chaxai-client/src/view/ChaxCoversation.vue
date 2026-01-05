<template>
  <div class="chax-coversation">
    <div class="chax-coversation__scroll-container" ref="scrollContainerRef">
      <div class="chax-coversation__messages">
        <div
          v-for="message in msgList"
          :key="message.msgId"
          class="chax-coversation__message-wrapper"
        >
          <ChaxMessage :option="message" />
        </div>
        <div v-if="isEmpty" class="chax-coversation__empty">
          <div class="chax-coversation__empty-icon">💬</div>
          <div class="chax-coversation__empty-text">开始新的对话</div>
          <div class="chax-coversation__empty-hint">输入消息并发送，AI 将在这里回复</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { IRecChaxCoversation } from './interface'
import ChaxMessage from './ChaxMessage.vue'

const props = defineProps<{option:IRecChaxCoversation}>()

const scrollContainerRef = ref<HTMLElement | null>(null)

const msgList = computed(() => props.option.msgList)

const isEmpty = computed(() => {
  return msgList.value.length === 0
})

function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
  nextTick(() => {
    const container = scrollContainerRef.value
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      })
      // 调用scrollToBottom回调
      if (props.option.onScrollToBottom) {
        props.option.onScrollToBottom()
      }
    }
  })
}

watch(
  () => msgList.value.length,
  () => {
    scrollToBottom()
  }
)

onMounted(() => {
  scrollToBottom('auto')
})
</script>

<style scoped>
.chax-coversation {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chax-coversation__scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
}

.chax-coversation__messages {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.chax-coversation__message-wrapper {
  margin-bottom: 8px;
}

.chax-coversation__message-wrapper:last-child {
  margin-bottom: 0;
}

.chax-coversation__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.chax-coversation__empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.chax-coversation__empty-text {
  font-size: 18px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}

.chax-coversation__empty-hint {
  font-size: 14px;
  color: #9ca3af;
  max-width: 300px;
}

.chax-coversation__scroll-container::-webkit-scrollbar {
  width: 6px;
}

.chax-coversation__scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.chax-coversation__scroll-container::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 3px;
}

.chax-coversation__scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

@media (max-width: 640px) {
  .chax-coversation__messages {
    padding: 16px;
  }

  .chax-coversation__empty {
    padding: 40px 16px;
  }

  .chax-coversation__empty-icon {
    font-size: 36px;
  }

  .chax-coversation__empty-text {
    font-size: 16px;
  }
}
</style>
