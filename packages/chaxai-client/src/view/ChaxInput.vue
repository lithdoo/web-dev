<template>
  <div class="chax-input">
    <div class="chax-input__container">
      <div class="chax-input__textarea-wrapper">
        <textarea
          ref="textareaRef"
          v-model="localValue"
          class="chax-input__textarea"
          :class="{ 'chax-input__textarea--disabled': disabled }"
          :disabled="disabled"
          :placeholder="placeholder"
          rows="1"
          @keydown.enter.exact.prevent="handleEnter"
          @input="autoResize"
          @focus="handleFocus"
        ></textarea>
      </div>
      <button
        class="chax-input__submit"
        :class="{ 'chax-input__submit--disabled': disabled || !localValue.trim() }"
        :disabled="disabled || !localValue.trim()"
        @click="handleSubmit"
      >
        <svg
          v-if="!isLoading"
          class="chax-input__send-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        <svg
          v-else
          class="chax-input__loading-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      </button>
    </div>
    <div v-if="hasSSE" class="chax-input__sse-indicator">
      <span class="chax-input__sse-dot"></span>
      AI 正在思考中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { IRecChaxInput } from './interface'

const props = defineProps<{option:IRecChaxInput}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const localValue = ref(props.option.userInput)

const disabled = computed(() => props.option.isDisabled)
const isLoading = computed(() => props.option.loading)
const hasSSE = computed(() => false)

const placeholder = computed(() => props.option.placeholder)

watch(() => props.option.userInput, (newVal) => {
  if (newVal !== localValue.value) {
    localValue.value = newVal
    nextTick(() => autoResize())
  }
})

function handleEnter(event: KeyboardEvent) {
  if (disabled.value) {
    return
  }
  const content = localValue.value.trim()
  if (content && props.option.onSend) {
    props.option.onSend(content)
  }
}

function handleSubmit() {
  if (disabled.value) {
    return
  }
  const content = localValue.value.trim()
  if (content && props.option.onSend) {
    props.option.onSend(content)
  }
}

function handleFocus() {
  if (props.option.onFocus) {
    props.option.onFocus()
  }
}

function handleBlur() {
  if (props.option.onBlur) {
    props.option.onBlur()
  }
}

function autoResize() {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    const scrollHeight = textarea.scrollHeight
    const maxHeight = 150
    textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px'
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto'
    } else {
      textarea.style.overflowY = 'hidden'
    }
  }
}
</script>

<style scoped>
.chax-input {
  padding: 16px;
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb;
}

.chax-input__container {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px 8px 8px 16px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.chax-input__container:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.chax-input__textarea-wrapper {
  flex: 1;
  min-width: 0;
}

.chax-input__textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  color: #1f2937;
  padding: 8px 0;
  max-height: 150px;
  overflow-y: hidden;
}

.chax-input__textarea::placeholder {
  color: #9ca3af;
}

.chax-input__textarea--disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.chax-input__submit {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: none;
  background-color: #3b82f6;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease, transform 0.1s ease;
}

.chax-input__submit:hover:not(.chax-input__submit--disabled) {
  background-color: #2563eb;
}

.chax-input__submit:active:not(.chax-input__submit--disabled) {
  transform: scale(0.95);
}

.chax-input__submit--disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.chax-input__send-icon {
  width: 20px;
  height: 20px;
}

.chax-input__loading-icon {
  width: 20px;
  height: 20px;
  animation: chax-input-spin 1s linear infinite;
}

@keyframes chax-input-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.chax-input__sse-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  font-size: 13px;
  color: #6b7280;
}

.chax-input__sse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #10b981;
  animation: chax-input-pulse 2s infinite;
}

@keyframes chax-input-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

@media (max-width: 640px) {
  .chax-input {
    padding: 12px;
  }

  .chax-input__container {
    padding: 8px 8px 8px 12px;
  }

  .chax-input__textarea {
    font-size: 14px;
  }

  .chax-input__submit {
    width: 36px;
    height: 36px;
  }
}
</style>
