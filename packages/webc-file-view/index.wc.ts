// 使用原生HTML接口创建web-component
// 从dist目录静态导入CSS内容
import cssContent from './dist/index.css?raw';
import { createApp, ref, type Ref } from 'vue';
import { FileView } from './dist/webc-file-view.es.js';
import type { IFileViewHandler } from './src/components/interface.js';
class FileViewElement extends HTMLElement {
    constructor() {
        super();
        // 创建Shadow DOM
        this.attachShadow({ mode: 'open' });
    }

    private rootEl = document.createElement('div');
    private app: any = null;

    props: Ref<{ [key: string]: any }| null> = ref(null)

    async connectedCallback() {
        try {
            // 加载CSS并添加到Shadow DOM
            this.loadAndInjectCSS();

            // 渲染组件内容
            this.render();
        } catch (error) {
            console.error('Failed to initialize FileViewElement:', error);
            this.renderError(error instanceof Error ? error : new Error(String(error)));
        }
    }

    loadAndInjectCSS() {
        // 创建style元素并添加到Shadow DOM
        const style = document.createElement('style');
        style.textContent = cssContent;
        this.shadowRoot?.appendChild(style);

        console.log('CSS loaded and injected successfully');
    }

    render() {
        // 清空Shadow DOM内容
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }

        // 重新添加样式
        this.loadAndInjectCSS();

        // 只有当 props.value 不为 null 时才加载 Vue 应用
        if (this.props.value) {
            // 创建Vue应用并挂载到rootEl，传递 props
            this.app = createApp(FileView, this.props.value);
            this.app.mount(this.rootEl);

            // 将rootEl添加到Shadow DOM
            this.shadowRoot?.appendChild(this.rootEl);

            console.log('FileViewElement rendered successfully');
        } else {
            // props 为空时显示提示信息
            const placeholder = document.createElement('div');
            placeholder.className = 'file-view-placeholder';
            placeholder.textContent = 'Please set props using setProps() method';
            this.shadowRoot?.appendChild(placeholder);

            console.log('FileViewElement waiting for props...');
        }
    }

    renderError(error: Error) {
        // 清空Shadow DOM
        if (this.shadowRoot) {
            this.shadowRoot.innerHTML = '';
        }

        // 创建错误信息元素
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-container';
        errorContainer.innerHTML = `
            <h3>Error loading File View</h3>
            <p>${error.message}</p>
            <button id="retry-button">Retry</button>
        `;

        // 添加重试按钮事件
        const retryButton = errorContainer.querySelector('#retry-button');
        retryButton?.addEventListener('click', () => {
            this.connectedCallback();
        });

        this.shadowRoot?.appendChild(errorContainer);
    }

    setProps(props:{handler: IFileViewHandler}): void {
        this.props.value= props;
        this.render();
    }
}

// 注册自定义元素
if (typeof window !== 'undefined') {
    customElements.define('file-view', FileViewElement);
}

// export {
//     FileViewElement
// };