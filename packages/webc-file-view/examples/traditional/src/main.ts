import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
// 导入我们的组件库
import WebcFileView from 'webc-file-view'

const app = createApp(App)
// 使用组件库
app.use(WebcFileView)
app.mount('#app')
