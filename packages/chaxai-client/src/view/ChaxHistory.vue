<template>
  <div class="chax-history">
    <div class="chax-history__header">
      <h2 class="chax-history__title">对话历史</h2>
      <button
        class="chax-history__new-btn"
        title="新建对话"
        @click="handleNewChat"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
    <div class="chax-history__list">
      <div
        v-for="item in list"
        :key="item.conversationId"
        class="chax-history__item"
        :class="{ 'chax-history__item--active': item.conversationId === active }"
        @click="handleSelect(item.conversationId)"
      >
        <div class="chax-history__item-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <div class="chax-history__item-content">
          <div class="chax-history__item-title">{{ item.title || '未命名对话' }}</div>
          <div class="chax-history__item-date">{{ formatDate(item.updateTime) }}</div>
        </div>
        <button
          v-if="item.conversationId === active"
          class="chax-history__item-delete"
          title="删除对话"
          @click.stop="handleDelete(item.conversationId)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div v-if="list.length === 0" class="chax-history__empty">
        <div class="chax-history__empty-icon">📋</div>
        <div class="chax-history__empty-text">暂无历史对话</div>
        <div class="chax-history__empty-hint">开始新对话以创建记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IRecChaxHistory } from './interface'

const props = defineProps<{option:IRecChaxHistory}>()

const list = computed(() => props.option.list)
const active = computed(() => props.option.active)

function handleSelect(id: string) {
  if (props.option.onSelect) {
    props.option.onSelect(id)
  }
}

function handleNewChat() {
  if (props.option.onNewChat) {
    props.option.onNewChat()
  }
}

function handleDelete(id: string) {
  if (props.option.onDelete) {
    props.option.onDelete(id)
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return '今天'
  } else if (days === 1) {
    return '昨天'
  } else if (days < 7) {
    return `${days} 天前`
  } else if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} 周前`
  } else {
    const months = Math.floor(days / 30)
    return `${months} 个月前`
  }
}
</script>

<style scoped>
.chax-history {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f9fafb;
  border-right: 1px solid #e5e7eb;
}

.chax-history__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.chax-history__title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.chax-history__new-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.chax-history__new-btn:hover {
  background-color: #2563eb;
}

.chax-history__new-btn:active {
  transform: scale(0.95);
}

.chax-history__new-btn svg {
  width: 16px;
  height: 16px;
}

.chax-history__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.chax-history__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.chax-history__item:hover {
  background-color: #e5e7eb;
}

.chax-history__item--active {
  background-color: #dbeafe;
}

.chax-history__item--active:hover {
  background-color: #bfdbfe;
}

.chax-history__item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background-color: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.chax-history__item--active .chax-history__item-icon {
  background-color: #93c5fd;
  color: #1d4ed8;
}

.chax-history__item-icon svg {
  width: 14px;
  height: 14px;
}

.chax-history__item-content {
  flex: 1;
  min-width: 0;
}

.chax-history__item-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chax-history__item--active .chax-history__item-title {
  color: #1e40af;
}

.chax-history__item-date {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

.chax-history__item-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background-color: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
}

.chax-history__item:hover .chax-history__item-delete {
  opacity: 1;
}

.chax-history__item-delete:hover {
  background-color: #fee2e2;
  color: #ef4444;
}

.chax-history__item-delete svg {
  width: 14px;
  height: 14px;
}

.chax-history__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.chax-history__empty-icon {
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.chax-history__empty-text {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 4px;
}

.chax-history__empty-hint {
  font-size: 12px;
  color: #9ca3af;
}

.chax-history__list::-webkit-scrollbar {
  width: 4px;
}

.chax-history__list::-webkit-scrollbar-track {
  background: transparent;
}

.chax-history__list::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 2px;
}

.chax-history__list::-webkit-scrollbar-thumb:hover {
  background-color: #9ca3af;
}

@media (max-width: 768px) {
  .chax-history {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .chax-history--open {
    transform: translateX(0);
  }
}
</style>
