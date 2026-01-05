<script setup lang="ts">
import type { WebcFileItem } from './interface';

interface Props {
  /** 文件详情数据 */
  file?: WebcFileItem;
}

const props = withDefaults(defineProps<Props>(), {
  file: undefined
});

const emit = defineEmits<{
  /** 关闭事件 */
  (e: 'close'): void;
  /** 操作事件 */
  (e: 'action', value: string): void;
}>();

const handleClose = () => {
  emit('close');
};

const handleAction = (value: string) => {
  emit('action', value);
};
</script>

<template>
  <div v-if="file" class="file-detail">
    <div class="file-detail__header">
      <h3>{{ file?.name }}</h3>
      <button class="file-detail__close-btn" @click="handleClose">×</button>
    </div>
    <div class="file-detail__content">
      <div class="file-detail__file-info">
        <div class="file-detail__info-item">
          <span class="file-detail__label">类型:</span>
          <span class="file-detail__value">{{ file.type === 'directory' ? '目录' : '文件' }}</span>
        </div>
        <div class="file-detail__info-item">
          <span class="file-detail__label">大小:</span>
          <span class="file-detail__value">{{ file.size }} B</span>
        </div>
        <div class="file-detail__info-item">
          <span class="file-detail__label">最后修改:</span>
          <span class="file-detail__value">{{ new Date(file.lastModified).toLocaleString() }}</span>
        </div>
        <div class="file-detail__info-item">
          <span class="file-detail__label">路径:</span>
          <span class="file-detail__value">{{ file.path }}</span>
        </div>
      </div>
      
      <div class="file-detail__metadata" v-if="file.metadata">
        <h4>元数据</h4>
        <div class="file-detail__metadata-list">
          <div 
            v-for="(value, key) in file.metadata" 
            :key="key"
            class="file-detail__metadata-item"
          >
            <span class="file-detail__label">{{ key }}:</span>
            <span class="file-detail__value">
              <template v-if="value.type === 'text'">
                {{ value.value }}
              </template>
              <template v-else-if="value.type === 'url'">
                <a :href="value.value" target="_blank">{{ value.title }}</a>
              </template>
              <template v-else-if="value.type === 'action'">
                <button class="file-detail__action-btn" @click="handleAction(value.value)">{{ value.title }}</button>
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: white;
}

.file-detail__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.file-detail__header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 500;
}

.file-detail__close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.file-detail__close-btn:hover {
  background-color: #f5f5f5;
}

.file-detail__content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.file-detail__file-info {
  margin-bottom: 24px;
}

.file-detail__info-item {
  display: flex;
  margin-bottom: 8px;
}

.file-detail__info-item .file-detail__label {
  width: 80px;
  color: #666;
  font-weight: 500;
}

.file-detail__info-item .file-detail__value {
  flex: 1;
  word-break: break-all;
}

.file-detail__metadata h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 500;
}

.file-detail__metadata-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-detail__metadata-item {
  display: flex;
  flex-direction: column;
}

.file-detail__metadata-item .file-detail__label {
  color: #666;
  font-size: 14px;
  margin-bottom: 4px;
}

.file-detail__metadata-item .file-detail__value {
  font-size: 14px;
}

.file-detail__action-btn {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.file-detail__action-btn:hover {
  background-color: #1976d2;
}
</style>