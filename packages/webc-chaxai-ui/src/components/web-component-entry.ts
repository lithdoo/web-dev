// web-component导出专用入口文件
import { defineCustomElement } from 'vue'
import FileView from './FileView.vue'

// 将Vue组件转换为自定义元素
const FileViewElement = defineCustomElement(FileView)

// 注册自定义元素
if (typeof window !== 'undefined') {
  customElements.define('file-view', FileViewElement)
}

// 导出所有自定义元素
export {
  FileViewElement
}
