import FileView from './components/FileView.vue'
import FileBody from './components/FileBody.vue'
import FileDetail from './components/FileDetail.vue'
import SinglePanelSplit from './components/SinglePanelSplit/SinglePanelSplit.vue'

// 导出所有组件
export {
  FileView,
  FileBody,
  FileDetail,
  SinglePanelSplit
}

// 导出默认对象
export default {
  // 安装函数，用于 Vue.use()
  install(app: any) {
    // 注册所有组件
    app.component('FileView', FileView)
    app.component('FileBody', FileBody)
    app.component('FileDetail', FileDetail)
    app.component('SinglePanelSplit', SinglePanelSplit)
  }
}