<script setup lang="ts">
import FileItem from './FileItem.vue';
import type { IFileViewHandler, WebcFileItem } from './interface';

interface Props {
  /** 文件视图处理器 */
  handler: IFileViewHandler;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 视图类型变更事件 */
  (e: 'view-type-change', type: string): void;
}>();

/** 处理文件项点击 */
const handleFileItemClick = (file: WebcFileItem) => {
  props.handler.onDetailItemClick(file);
};

/** 切换视图类型 */
const changeViewType = (type: string) => {
  props.handler.onChangeViewType(type as any);
  emit('view-type-change', type);
};
</script>

<template>
  <div class="file-body">
    <!-- 视图工具栏 -->
    <div class="file-body__toolbar">
      <div class="file-body__toolbar-left">
        <h2>{{ handler.view.src }}</h2>
      </div>
      <div class="file-body__toolbar-right">
        <button 
          class="file-body__view-btn" 
          :class="{ 'file-body__view-btn--active': handler.view.viewType === 'list' }"
          @click="changeViewType('list')"
        >
          列表视图
        </button>
        <button 
          class="file-body__view-btn" 
          :class="{ 'file-body__view-btn--active': handler.view.viewType === 'grid' }"
          @click="changeViewType('grid')"
        >
          网格视图
        </button>
      </div>
    </div>

    <!-- 文件列表 -->
    <div class="file-body__file-list" :class="`file-body__file-list--${handler.view.viewType}`">
      <FileItem
        v-for="file in handler.view.list"
        :key="file.path"
        :file="file"
        :selected="handler.detailItem?.path === file.path"
        :viewType="handler.view.viewType"
        @click="handleFileItemClick"
      />
    </div>
  </div>
</template>

<style scoped>
.file-body {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.file-body__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
  background-color: #fafafa;
}

.file-body__toolbar h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.file-body__toolbar-right {
  display: flex;
  gap: 8px;
}

.file-body__view-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background-color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.file-body__view-btn:hover {
  background-color: #f5f5f5;
}

.file-body__view-btn--active {
  background-color: #2196f3;
  color: white;
  border-color: #2196f3;
}

.file-body__file-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  gap: 8px;
}

/* 列表视图样式 */
.file-body__file-list--list {
  display: flex;
  flex-direction: column;
}

/* 网格视图样式 */
.file-body__file-list--grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
</style>