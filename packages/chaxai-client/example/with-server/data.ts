import type { IRecChax } from '@/view/interface'
import { ChatControl, IChaxReq } from '@/ChatControl'
import type { IChaxMessage, IChaxConversation } from "@chaxai-common"
import { RecChax } from '@/view/fromChax'
import { Ref, ref, computed } from 'vue'

// 创建真实的IChaxReq实现，调用chaxai-service API
class ChaxReq implements IChaxReq {
  private baseUrl = '/ai'

  async fetchAllConversation(): Promise<IChaxConversation[]> {
    const response = await fetch(`${this.baseUrl}/record/list`)
    if (!response.ok) {
      throw new Error('Failed to fetch conversations')
    }
    return response.json()
  }

  async fetchAllMessage(conversationId: string): Promise<IChaxMessage[]> {
    const response = await fetch(`${this.baseUrl}/message/list/${conversationId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch messages')
    }
    return response.json()
  }

  async fetchContent(msgId: string): Promise<{ content: string, error?: string }> {
    const response = await fetch(`${this.baseUrl}/message/content/${msgId}`)
    if (!response.ok) {
      throw new Error('Failed to fetch message content')
    }
    return response.json()
  }

  async send(input: {
    conversationId?: string
    content: string,
    extra: any
  }): Promise<{ conversationId: string }> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: input.conversationId,
        content: input.content,
      }),
    })
    if (!response.ok) {
      throw new Error('Failed to send message')
    }
    return response.json()
  }

  sseContent(msgId: string): EventSource {
    return new EventSource(`${this.baseUrl}/message/stream/${msgId}`)
  }
}

// 创建真实的ChatControl实例
const chatControl = new ChatControl({
  request: new ChaxReq()
})

// 初始化ChatControl实例
async function initChatControl() {
  // 加载对话列表
  await chatControl.loadRecords()
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
const baseChatControlRef: Ref<IRecChax> = RecChax.createRef(chatControl)

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
