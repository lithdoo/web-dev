# ChaxAI API 接口文档

## 1. 接口概述

ChaxAI 服务提供了一套 RESTful API，用于实现与 AI 助手的对话交互功能。所有 API 端点都以 `/ai` 开头，并遵循 RESTful 设计原则。

### 1.1 跨域支持

服务已启用 CORS（跨域资源共享）支持，允许来自任何域名的请求访问 API。配置如下：
- 允许所有来源：`*`
- 允许的 HTTP 方法：GET、POST、PUT、DELETE、OPTIONS
- 允许的请求头：所有标准请求头
- 允许凭证：false

## 2. 认证方式

当前版本的 API 暂时不提供认证机制，所有请求均可直接访问。

## 3. API 端点

### 3.1 获取对话列表

#### 请求
- **方法**: GET
- **路径**: `/ai/record/list`
- **参数**: 无

#### 响应
```json
[
  {
    "conversationId": "string",
    "title": "string",
    "createTimestamp": 1234567890,
    "updateTimestamp": 1234567890
  }
]
```

#### 示例
```bash
curl http://localhost:3000/ai/record/list
```

### 3.2 获取对话消息列表

#### 请求
- **方法**: GET
- **路径**: `/ai/message/list/:conversationId`
- **参数**:
  - `conversationId`: 对话记录 ID (路径参数)

#### 响应
```json
[
  {
    "msgId": "string",
    "role": "user" | "assistant" | "system",
    "visiableInClient": true,
    "unfinished": boolean,
    "error": "string"
  }
]
```

**注意**: 响应中的消息对象不包含实际内容，需要通过 `/ai/message/content/:msgId` 接口单独获取每条消息的内容。

#### 示例
```bash
curl http://localhost:3000/ai/message/list/123456
```

### 3.3 发送消息

#### 请求
- **方法**: POST
- **路径**: `/ai/chat`
- **参数**:
  ```json
  {
    "conversationId": "string" (可选),
    "content": "string" (必需)
  }
  ```

#### 响应
```json
{
  "conversationId": "string",
  "title": "string",
  "createTimestamp": 1234567890,
  "updateTimestamp": 1234567890
}
```

#### 示例
```bash
curl -X POST -H "Content-Type: application/json" -d '{"content":"你好"}' http://localhost:3000/ai/chat
```

### 3.4 获取消息内容

#### 请求
- **方法**: GET
- **路径**: `/ai/message/content/:msgId`
- **参数**:
  - `msgId`: 消息 ID (路径参数)

#### 响应
```json
{
  "content": "string",
  "error": "string" // 当没有错误时，error字段可能为空字符串
}
```

#### 示例
```bash
curl http://localhost:3000/ai/message/content/789012
```

### 3.5 流式获取消息内容 (SSE)

#### 请求
- **方法**: GET
- **路径**: `/ai/message/stream/:msgId`
- **参数**:
  - `msgId`: 消息 ID (路径参数)
- **响应类型**: `text/event-stream`

#### 响应格式
```
event: chunk
data: {"type":"chunk","content":"部分内容"}

event: done
data: {"type":"done","content":"完整内容"}
```

#### 示例
```bash
curl http://localhost:3000/ai/message/stream/345678
```

## 4. 数据类型定义

### 4.1 IChaxConversation

```typescript
interface IChaxConversation {
  conversationId: string;
  title: string;
  createTimestamp: number;
  updateTimestamp: number;
}
```

### 4.2 IChaxMessage

```typescript
interface IChaxMessage {
  msgId: string;
  role: 'user' | 'assistant' | 'system';
  visiableInClient: boolean;
  unfinished?: boolean;
  error?: string;
}
```

**注意**: IChaxMessage 不直接包含消息内容，内容需要通过 `/ai/message/content/:msgId` 接口单独获取。这种设计允许消息元数据和内容的分离存储与传输。

### 4.3 IChaxStreamChunk

```typescript
interface IChaxStreamChunk {
  type: 'init' | 'chunk' | 'done' | 'error';
  content: string;
}
```

## 5. 错误处理

API 错误响应格式：

```json
{
  "error": "错误描述"
}
```

### 5.1 常见错误码及说明

| 错误码 | 说明 | 示例错误信息 |
|-------|------|------------|
| 400 | 请求参数错误 | `content is required` |
| 404 | 资源不存在 | `Message not found` |
| 500 | 服务器内部错误 | `Internal server error` |

### 5.2 错误处理示例

```bash
# 请求缺少必需的 content 参数
curl -X POST -H "Content-Type: application/json" -d '{}' http://localhost:3000/ai/chat
# 返回：HTTP/1.1 400 Bad Request
# 返回体：{"error":"content is required"}

## 6. 最佳实践

1. **使用流式 API**: 对于长时间运行的 AI 响应，建议使用 `/ai/message/stream/:msgId` 端点获取实时更新。
2. **定期更新对话列表**: 使用 `/ai/record/list` 端点定期更新对话列表，以获取最新的对话状态。
3. **处理 SSE 连接关闭**: 当使用 SSE 时，确保正确处理连接关闭事件，避免资源泄漏。
4. **错误处理**: 所有 API 请求都应包含错误处理逻辑，特别是网络错误和服务器错误。

## 7. 版本历史

- **v1.0.0**: 初始版本，包含基本的对话功能和流式响应支持。

## 8. 联系方式

如有任何问题或建议，请联系开发团队。