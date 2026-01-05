<script setup lang="ts">
import type { WebcFileItem, ViewType } from './interface';

interface Props {
  /** 文件/目录项数据 */
  file: WebcFileItem;
  /** 是否被选中 */
  selected?: boolean;
  /** 视图类型 */
  viewType: ViewType;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
});

const emit = defineEmits<{
  /** 点击事件 */
  (e: 'click', file: WebcFileItem): void;
}>();

const handleClick = () => {
  emit('click', props.file);
};
</script>

<template>
  <div 
    class="file-item" 
    :class="{ 'file-item--selected': selected, 'file-item--directory': file.type === 'directory', [`file-item--${viewType}`]: true }"
    @click="handleClick"
  >
    <div class="file-item__icon">
      {{ file.type === 'directory' ? '📁' : '📄' }}
    </div>
    <div class="file-item__info">
      <div class="file-item__name">{{ file.name }}</div>
      <div class="file-item__meta">
        <span>{{ file.size }} B</span>
        <span class="file-item__date">{{ new Date(file.lastModified).toLocaleDateString() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-item:hover {
  background-color: #f5f5f5;
}

.file-item--selected {
  background-color: #e3f2fd;
}

.file-item--directory {
  font-weight: 500;
}

.file-item__icon {
  font-size: 24px;
  margin-right: 12px;
  width: 32px;
  text-align: center;
}

.file-item__info {
  flex: 1;
}

.file-item__name {
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-item__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
}

.file-item__meta .file-item__date {
  margin-left: auto;
}

/* 网格视图下的文件项样式 */
.file-item--grid {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  height: 150px;
}

.file-item--grid .file-item__icon {
  font-size: 48px;
  margin-right: 0;
  margin-bottom: 12px;
}

.file-item--grid .file-item__info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.file-item--grid .file-item__name {
  margin-bottom: 8px;
  font-size: 14px;
  max-width: 100%;
}

.file-item--grid .file-item__meta {
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.file-item--grid .file-item__meta .file-item__date {
  margin-left: 0;
}
</style>