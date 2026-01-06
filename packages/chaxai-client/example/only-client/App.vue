<template>
  <div class="app">
    <header class="app__header">
      <h1 class="app__title">Chax AI 聊天组件测试</h1>
    </header>
    <main class="app__main">
      <Chax
        :option="chatControlRef"
      />
    </main>
    <footer class="app__footer">
      <div class="app__log">
        <strong>事件日志：</strong>
        <div v-for="(log, index) in logs" :key="index" class="app__log-item">
          {{ log }}
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import Chax from '../src/view/Chax.vue'
import { chatControlRef, logs } from './data'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f3f4f6;
}

.app__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.app__title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.app__controls {
  display: flex;
  gap: 8px;
}

.app__btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background-color: #ffffff;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.app__btn:hover {
  background-color: #f9fafb;
  border-color: #d1d5db;
}

.app__btn--active {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: #ffffff;
}

.app__btn--active:hover {
  background-color: #2563eb;
}

.app__main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  margin: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.app__footer {
  padding: 16px 24px;
  background-color: #ffffff;
  border-top: 1px solid #e5e7eb;
  max-height: 200px;
  overflow-y: auto;
}

.app__log {
  font-size: 13px;
  color: #6b7280;
}

.app__log strong {
  color: #374151;
}

.app__log-item {
  padding: 4px 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: #4b5563;
}

@media (max-width: 768px) {
  .app__header {
    flex-direction: column;
    gap: 12px;
  }

  .app__controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .app__main {
    margin: 8px;
  }
}
</style>
