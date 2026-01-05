<template>
  <div class="chax">
    <div class="chax__history-panel" :class="{ 'chax__history-panel--mobile-open': history.isOpen }">
      <ChaxHistory
        :option="history"
      />
    </div>
    <div class="chax__main">
      <div class="chax__header">
        <button
          class="chax__menu-btn"
          @click="history.open"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div class="chax__header-title">
          {{ currentTitle }}
        </div>
        <div class="chax__header-actions">
          <div v-if="hasSSE" class="chax__sse-badge">
            <span class="chax__sse-dot"></span>
            AI 思考中
          </div>
        </div>
      </div>
      <div class="chax__content">
        <ChaxCoversation
          v-if="current"
          :option="current"
        />
        <div v-else class="chax__no-conversation">
          <div class="chax__no-conversation-icon">💬</div>
          <div class="chax__no-conversation-text">选择或开始新对话</div>
          <button class="chax__start-btn" @click="history.onNewChat?.()">
            开始新对话
          </button>
        </div>
      </div>
      <div class="chax__footer">
        <ChaxInput
          :option="input"
        />
      </div>
    </div>
    <div
      v-if="history.isOpen"
      class="chax__overlay"
      @click="history.close"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IRecChax } from './interface'
import ChaxHistory from './ChaxHistory.vue'
import ChaxCoversation from './ChaxCoversation.vue'
import ChaxInput from './ChaxInput.vue'

const props = defineProps<{option:IRecChax}>()

const current = computed(() => props.option.current)
const history = computed(() => props.option.history)
const input = computed(() => props.option.input)
const hasSSE = computed(() => props.option.hasSSE)

const currentTitle = computed(() => {
  if (current.value) {
    // 优先使用current对象的title属性
    return current.value.title || '未命名对话'
  }
  return '新对话'
})
</script>

<style scoped>
.chax {
  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background-color: #ffffff;
}

.chax__history-panel {
  width: 280px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.chax__history-panel--mobile-open {
  display: block;
}

.chax__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.chax__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #ffffff;
}

.chax__menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background-color: transparent;
  color: #374151;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.chax__menu-btn:hover {
  background-color: #f3f4f6;
}

.chax__menu-btn svg {
  width: 20px;
  height: 20px;
}

.chax__header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chax__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chax__sse-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background-color: #ecfdf5;
  border-radius: 20px;
  font-size: 12px;
  color: #059669;
}

.chax__sse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
  animation: chax-pulse 2s infinite;
}

@keyframes chax-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

.chax__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chax__no-conversation {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.chax__no-conversation-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
}

.chax__no-conversation-text {
  font-size: 18px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 16px;
}

.chax__start-btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  background-color: #3b82f6;
  color: white;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.chax__start-btn:hover {
  background-color: #2563eb;
}

.chax__start-btn:active {
  transform: scale(0.98);
}

.chax__footer {
  flex-shrink: 0;
}

.chax__overlay {
  display: none;
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 50;
}

@media (max-width: 768px) {
  .chax__menu-btn {
    display: flex;
  }

  .chax__history-panel {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
  }

  .chax__history-panel--mobile-open {
    transform: translateX(0);
  }

  .chax__overlay {
    display: block;
  }

  .chax__header {
    padding: 12px 16px;
  }

  .chax__header-title {
    font-size: 15px;
  }
}

@media (max-width: 640px) {
  .chax__header {
    padding: 10px 12px;
  }

  .chax__header-title {
    font-size: 14px;
  }

  .chax__no-conversation {
    padding: 30px 16px;
  }

  .chax__no-conversation-icon {
    font-size: 36px;
  }

  .chax__no-conversation-text {
    font-size: 16px;
  }
}
</style>
