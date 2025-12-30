<script setup lang="ts">
import FileView from '../../../src/components/FileView.vue';
import { fileViewHandler } from './mock';
</script>

<template>
  <div class="app">
    <FileView :handler="fileViewHandler" />
  </div>
</template>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
}
</style>

<style >
body , html, .app {
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
