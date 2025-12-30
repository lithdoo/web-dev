<script setup lang="ts">
import { computed, ref } from 'vue';
import type { IFileViewHandler } from './interface';
import FileBody from './FileBody.vue';
import FileDetail from './FileDetail.vue';
import SinglePanelSplit from './SinglePanelSplit/SinglePanelSplit.vue';
import { SinglePanelSplitHandler } from './SinglePanelSplit/handler';

interface Props {
    /** 文件视图处理器 */
    handler: IFileViewHandler;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    /** 视图类型变更事件 */
    (e: 'view-type-change', type: string): void;
}>();

/** 创建SinglePanelSplit的处理器 */
const splitHandler = ref(new SinglePanelSplitHandler());
splitHandler.value.position = 'right';
splitHandler.value.distance = 320;
splitHandler.value.minDistance = 280;
splitHandler.value.maxDistance = 500;


/** 处理关闭文件详情 */
const handleDetailClose = () => {
    props.handler.onDetailItemClose();
};

/** 处理文件详情操作 */
const handleDetailAction = (value: string) => {
    if (props.handler.onDetailItemAction) {
        props.handler.onDetailItemAction(value);
    }
};

const siderSplitWidth = computed(() => {
    return props.handler.detailItem ? `${splitHandler.value.distance}px` : '0'
})
</script>

<template>
    <div class="file-view">
        <SinglePanelSplit :handler="splitHandler">
            <!-- 左侧：文件列表 -->
            <template #extra>
                <FileBody :handler="handler" @view-type-change="(type) => emit('view-type-change', type)" />
            </template>

            <!-- 右侧：文件详情 -->
            <template #panel>
                <div :style="{ width: siderSplitWidth }">
                    <FileDetail :file="handler.detailItem" @close="handleDetailClose" @action="handleDetailAction" />
                </div>
            </template>
        </SinglePanelSplit>
    </div>
</template>

<style scoped>
.file-view {
    width: 100%;
    height: 100%;
}
</style>