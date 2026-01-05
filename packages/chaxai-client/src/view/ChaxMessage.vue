<template>
  <div
    class="chax-message"
    :class="[
      `chax-message--${type}`,
      `chax-message--${status}`
    ]"
  >
    <div class="chax-message__avatar">
      <span class="chax-message__avatar-icon">{{ type === 'user' ? '我' : 'AI' }}</span>
    </div>
    <div class="chax-message__content">
      <div
        class="chax-message__content-inner"
        v-html="renderedContent"
      ></div>
      <div v-if="status === 'streaming'" class="chax-message__typing">
        <span class="chax-message__typing-dot"></span>
        <span class="chax-message__typing-dot"></span>
        <span class="chax-message__typing-dot"></span>
      </div>
      <div v-else-if="status === 'error'" class="chax-message__error">
        消息发送失败
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import type { IRecChaxMessage } from './interface'

const props = defineProps<{option:IRecChaxMessage}>()

const type = computed(() => props.option.type)

type MessageStatus = 'normal' | 'streaming' | 'error'

const status = computed<MessageStatus>(() => {
  if (props.option.error) {
    return 'error'
  }
  if (props.option.unfinished) {
    return 'streaming'
  }
  return 'normal'
})

const renderedContent = computed(() => {
  if (!props.option.content) {
    return ''
  }
  
  return escapeHtml(props.option.content)
})

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

watch(
  () => [props.option.content, props.option.unfinished, props.option.error],
  () => {
    if (props.option.onUpdate) {
      props.option.onUpdate(props.option)
    }
  },
  { deep: true }
)

onMounted(() => {
  if (props.option.onUpdate) {
    props.option.onUpdate(props.option)
  }
})
</script>

<style scoped>
.chax-message {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background-color 0.2s ease;
}

.chax-message:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.chax-message--user {
  flex-direction: row;
}

.chax-message--assistant {
  flex-direction: row;
}

.chax-message__avatar {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  user-select: none;
}

.chax-message--user .chax-message__avatar {
  background-color: #3b82f6;
  color: white;
}

.chax-message--assistant .chax-message__avatar {
  background-color: #10b981;
  color: white;
}

.chax-message__avatar-icon {
  line-height: 1;
}

.chax-message__content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.chax-message__content-inner {
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
  font-size: 14px;
  color: #1f2937;
}

.chax-message--user .chax-message__content-inner {
  color: #1f2937;
}

.chax-message--assistant .chax-message__content-inner {
  color: #374151;
}

.chax-message__content-inner :deep(pre) {
  background-color: #1f2937;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.chax-message__content-inner :deep(code) {
  font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
  font-size: 13px;
}

.chax-message__content-inner :deep(p) {
  margin: 8px 0;
}

.chax-message__content-inner :deep(ul),
.chax-message__content-inner :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.chax-message__content-inner :deep(li) {
  margin: 4px 0;
}

.chax-message__content-inner :deep(blockquote) {
  border-left: 3px solid #3b82f6;
  padding-left: 12px;
  margin: 8px 0;
  color: #6b7280;
}

.chax-message__typing {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.chax-message__typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #9ca3af;
  animation: chax-message-typing-bounce 1.4s infinite ease-in-out both;
}

.chax-message__typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.chax-message__typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes chax-message-typing-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.chax-message__error {
  color: #ef4444;
  font-size: 13px;
  padding: 4px 0;
}

.chax-message--streaming .chax-message__content-inner {
  position: relative;
}

.chax-message--error {
  background-color: #fef2f2;
}

@media (max-width: 640px) {
  .chax-message {
    padding: 12px;
  }

  .chax-message__avatar {
    width: 32px;
    height: 32px;
    font-size: 12px;
  }

  .chax-message__content-inner {
    font-size: 14px;
  }
}
</style>
