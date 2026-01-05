<script lang="ts" setup>
import { SinglePanelSplitHandler } from './handler'
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{ handler: SinglePanelSplitHandler }>()
const handler = computed(() => props.handler)
const controller = ref<HTMLDivElement | null>(null)

const siderStyle = computed(()=>{
  console.warn(handler.value.siderBarWidth)
  if(handler.value.siderBarWidth){
    return {minWidth:handler.value.siderBarWidth}
  }else{
    return {}
  }
})
const flexDirection = computed(() => {
  if (handler.value.position === 'left') {
    return 'row'
  }
  if (handler.value.position === 'right') {
    return 'row-reverse'
  }
  if (handler.value.position === 'top') {
    return 'column'
  }
  if (handler.value.position === 'bottom') {
    return 'column-reverse'
  }
  return 'column'
})

const controlBarStyle = computed(() => {
  if (handler.value.isHorizontal()) {
    return {
      width: '4px',
      marginRight: '-2px',
      marginLeft: '-2px',
      cursor: 'ew-resize'
    }
  } else {
    return {
      height: '4px',
      marginTop: '-2px',
      marginBottom: '-2px',
      cursor: 'ns-resize'
    }
  }
})

const extraStyle = computed(() => {
  if (handler.value.isHorizontal()) {
    return { width: '100%' }
  } else {
    return { height: '100%' }
  }
})

onMounted(() => {
  if (controller.value) {
    handler.value.bindController(controller.value)
  }
})

onUnmounted(() => {
  handler.value.destroyController?.()
})
</script>

<template>
  <div
    :style="{ flexDirection }"
    :class="{
      'panel-split': true,
      'panel-split--layout-max': handler.isMax
    }"
  >
    <div class="panel-split__panel" :style="siderStyle">
      <slot name="panel" :distance="handler.distance" />
    </div>
    <div class="panel-split__controller" ref="controller" :style="controlBarStyle"></div>
    <div class="panel-split__extra" :style="extraStyle">
      <slot name="extra" :distance="handler.distance" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.panel-split {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;

  &.panel-split--layout-max {
    .panel-split__panel {
      height: 100%;
    }

    .panel-split__controller {
      flex: 0 0 auto;
      z-index: 1;
      display: none;
    }
  }
}

.panel-split__panel {
  flex: 0 0 auto;
}

.panel-split__extra {
  flex: 1 1 0;
  overflow: auto;
}

.panel-split__controller {
  flex: 0 0 auto;
  z-index: 1;
}
</style>
