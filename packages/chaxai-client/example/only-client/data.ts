import type { IRecChax, IRecChaxCoversation } from '@/view/interface'
import { ChatControl, IChaxReq } from '@/ChatControl'
import type { IChaxMessage, IChaxConversation } from "@chaxai-common"
import { RecChax } from '@/view/fromChax'
import { Ref, ref, computed } from 'vue'

export const mockHistoryList = [
  {
    id: '1',
    title: 'Vue 3 组件通信方式',
    updatedAt: Date.now() - 1000 * 60 * 30, // 30分钟前
  },
  {
    id: '2',
    title: 'TypeScript 高级类型详解',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24, // 1天前
  },
  {
    id: '3',
    title: '如何优化前端性能',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3天前
  },
  {
    id: '4',
    title: 'RESTful API 设计原则',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7, // 1周前
  },
]

export const mockMessages: IRecChaxCoversation['msgList'] = [
  {
    msgId: 'msg-1',
    type: 'user',
    content: '你好，我想了解 Vue 3 的组合式 API',
    createTime: Date.now() - 1000 * 60 * 5,
    unfinished: false,
  },
  {
    msgId: 'msg-2',
    type: 'assistant',
    content: '你好！Vue 3 的组合式 API（Composition API）是一种新的代码组织方式，它允许你使用函数来逻辑复用，而不是依赖于选项对象（如 data、methods、computed 等）。\n\n主要特点：\n1. **更好的逻辑复用** - 可以轻松提取和复用逻辑\n2. **更灵活的代码组织** - 可以按逻辑功能而非选项类型组织代码\n3. **更好的 TypeScript 支持** - 类型推断更准确\n\n核心函数：\n- `ref()` - 创建响应式引用\n- `reactive()` - 创建响应式对象\n- `computed()` - 创建计算属性\n- `watch()` / `watchEffect()` - 监听数据变化',
    createTime: Date.now() - 1000 * 60 * 5 + 1000,
    unfinished: false,
  },
  {
    msgId: 'msg-3',
    type: 'user',
    content: '能举个实际使用场景的例子吗？',
    createTime: Date.now() - 1000 * 60 * 2,
    unfinished: false,
  },
  {
    msgId: 'msg-4',
    type: 'assistant',
    content: '当然！下面是一个鼠标位置跟踪的组合式 API 示例：\n\n```typescript\n// useMouse.ts\nimport { ref, onMounted, onUnmounted } from \'vue\'\n\nexport function useMouse() {\n  const x = ref(0)\n  const y = ref(0)\n\n  function update(event: MouseEvent) {\n    x.value = event.pageX\n    y.value = event.pageY\n  }\n\n  onMounted(() => window.addEventListener(\'mousemove\', update))\n  onUnmounted(() => window.removeEventListener(\'mousemove\', update))\n\n  return { x, y }\n}\n```\n\n使用方式：\n```vue\n<script setup>\nimport { useMouse } from \'./useMouse\'\n\nconst { x, y } = useMouse()\n</script>\n\n<template>\n  <p>鼠标位置: {{ x }}, {{ y }}</p>\n</template>\n```',
    createTime: Date.now() - 1000 * 60 * 2 + 1500,
    unfinished: false,
  },
]

export const mockCurrentConversation: IRecChaxCoversation = {
  conversationId: 'conv-1',
  title: 'Vue 3 组件通信方式',
  updateTime: Date.now() - 1000 * 60 * 2,
  msgList: mockMessages,
}

export const mockInputValue = ''
export const mockInputLoading = false
export const mockInputHasSSE = false

export const mockMarkdownConfig = {
  renderer: null,
  keyType: null,
}

export const mockChaxData: IRecChax = {
  current: mockCurrentConversation,
  history: {
    isOpen: true,
    active: mockCurrentConversation.conversationId,
    list: mockHistoryList.map(h => ({
      title: h.title,
      updateTime: h.updatedAt,
      conversationId: h.id,
    })),
    close: () => {},
    open: () => {},
  },
  input: {
    isFocus: false,
    isDisabled: false,
    loading: false,
    userInput: mockInputValue,
    placeholder: '输入消息，按 Enter 发送，Shift+Enter 换行',
    tools: [{
      type: 'selector',
      options: ['DeepSeek-R1-32B']
    }],
  },
  markdown: mockMarkdownConfig,
  hasSSE: false,
}

export const mockChaxDataWithSSE: IRecChax = {
  ...mockChaxData,
  hasSSE: true,
  input: {
    ...mockChaxData.input,
    isDisabled: true,
  },
}

export const mockEmptyChaxData: IRecChax = {
  current: undefined,
  history: {
    isOpen: true,
    active: undefined,
    list: mockHistoryList.map(h => ({
      title: h.title,
      updateTime: h.updatedAt,
      conversationId: h.id,
    })),
    close: () => {},
    open: () => {},
  },
  input: {
    isFocus: false,
    isDisabled: false,
    loading: false,
    userInput: '',
    placeholder: '输入消息，按 Enter 发送，Shift+Enter 换行',
    tools: [{
      type: 'selector',
      options: ['DeepSeek-R1-32B']
    }],
  },
  markdown: mockMarkdownConfig,
  hasSSE: false,
}

// 创建模拟的IChaxReq实现
class MockChaxReq implements IChaxReq {
  async fetchAllConversation(): Promise<IChaxConversation[]> {
    // 将mockHistoryList转换为IChaxConversation格式
    return mockHistoryList.map(h => ({
      conversationId: h.id,
      title: h.title,
      updateTimestamp: h.updatedAt,
      createTimestamp: h.updatedAt,
    }))
  }

  async fetchAllMessage(conversationId: string): Promise<IChaxMessage[]> {
    // 如果是当前对话，返回mockMessages转换后的格式
    if (conversationId === 'conv-1') {
      return mockMessages.map(m => ({
        msgId: m.msgId,
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
        createTime: m.createTime,
        unfinished: m.unfinished,
        visiableInClient: true,
      }))
    }
    return []
  }

  async fetchContent(msgId: string): Promise<{ content: string, error?: string }> {
    // 从mockMessages中查找对应消息的内容
    const message = mockMessages.find(m => m.msgId === msgId)
    return {
      content: message?.content || '',
    }
  }

  async send(input: {
    conversationId?: string
    content: string,
    extra: any
  }): Promise<{ conversationId: string }> {
    // 模拟发送消息，返回当前conversationId
    return {
      conversationId: input.conversationId || 'conv-1',
    }
  }

  sseContent(_msgId: string): EventSource {
    // 模拟SSE连接
    throw new Error('SSE not implemented in mock')
  }
}

// 创建模拟的ChatControl实例
const mockChatControl = new ChatControl({
  request: new MockChaxReq()
})

// 初始化ChatControl实例
async function initChatControl() {
  // 加载对话列表
  await mockChatControl.loadRecords()
  // 设置当前对话
  await mockChatControl.load('1')
}

// 初始化ChatControl实例
initChatControl().catch(console.error)

// 添加日志记录功能
export const logs: Ref<string[]> = ref([])

function addLog(message: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift(`[${time}] ${message}`)
  if (logs.value.length > 20) {
    logs.value.pop()
  }
}

// 创建带有日志记录的聊天控制引用
const baseChatControlRef: Ref<IRecChax> = RecChax.createRef(mockChatControl)

// 包装回调函数以添加日志记录
export const chatControlRef: Ref<IRecChax> = computed(() => {
  const base = baseChatControlRef.value
  return {
    ...base,
    history: {
      ...base.history,
      onSelect: (id: string) => {
        addLog(`选择对话: ${id}`)
        base.history.onSelect?.(id)
      },
      onNewChat: () => {
        addLog('新建对话')
        base.history.onNewChat?.()
      },
      onDelete: (id: string) => {
        addLog(`删除对话: ${id}`)
        base.history.onDelete?.(id)
      },
    },
    input: {
      ...base.input,
      onSend: (content: string) => {
        addLog(`发送消息: ${content}`)
        base.input.onSend?.(content)
      },
      onFocus: () => {
        addLog('输入框获得焦点')
        base.input.onFocus?.()
      },
      onBlur: () => {
        addLog('输入框失去焦点')
        base.input.onBlur?.()
      },
    },
  }
})
