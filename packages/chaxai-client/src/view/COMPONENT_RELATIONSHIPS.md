# Chax 组件关系文档

## 组件层次结构

```
Chax (根容器组件)
├── ChaxCoversation (会话组件)
│   ├── ChaxMessage × N (消息组件 - 循环渲染)
│   └── ChaxMessage (单个活跃消息)
├── ChaxHistory (历史记录组件)
└── ChaxInput (输入组件)
```

## 接口与组件对应关系

### 1. IRecChax ↔ Chax (根组件)

IRecChax 是顶层接口，定义了整个聊天应用的状态结构，映射到 Chax 根组件。

**属性结构：**
- `current: IRecChaxCoversation | undefined` → ChaxCoversation 组件
- `history: IRecChaxHistory` → ChaxHistory 组件
- `input: IRecChaxInput` → ChaxInput 组件
- `markdown: { renderer, keyType }` → 传递给子组件的渲染配置
- `hasSSE: boolean` → SSE 连接状态标志

**组件职责：**
- 作为所有子组件的容器
- 整合应用的完整状态
- 协调各子组件之间的数据传递

### 2. IRecChaxCoversation ↔ ChaxCoversation (会话组件)

IRecChaxCoversation 定义了当前会话的消息列表和活跃消息，映射到 ChaxCoversation 组件。

**属性结构：**
- `active: IRecChaxMessage | null` → 正在流式输出的消息 (ChaxMessage)
- `history: IRecChaxMessage[]` → 历史消息数组 (ChaxMessage × N)

**组件职责：**
- 展示当前会话的所有消息
- 管理消息列表的渲染
- 处理活跃消息的更新

### 3. IRecChaxHistory ↔ ChaxHistory (历史记录组件)

IRecChaxHistory 定义了用户的历史对话记录列表，映射到 ChaxHistory 组件。

**属性结构：**
- `list: IRecChaxHistoryItem[]` → 历史记录列表
- `active: string | null` → 当前选中的会话ID

**组件职责：**
- 展示用户的历史对话记录
- 允许用户切换不同会话
- 高亮当前活跃的会话

### 4. IRecChaxInput ↔ ChaxInput (输入组件)

IRecChaxInput 定义了输入框的状态和配置，映射到 ChaxInput 组件。

**属性结构：**
- `value: string` → 输入框内容
- `loading: boolean` → 是否正在加载
- `hasSSE: boolean` → 是否有活跃的 SSE 连接

**组件职责：**
- 接收用户输入
- 显示加载状态
- 禁用输入框（当 SSE 连接活跃时）

### 5. IRecChaxMessage ↔ ChaxMessage (消息组件)

IRecChaxMessage 定义了单条消息的结构，映射到 ChaxMessage 组件。

**属性结构：**
- `content: string` → 消息内容
- `role: 'user' | 'assistant'` → 消息角色
- `status: 'streaming' | 'complete' | 'error'` → 消息状态
- `markdownConfig?: { renderer?, keyType? }` → Markdown 渲染配置

**组件职责：**
- 渲染单条聊天消息
- 根据角色显示不同样式
- 根据状态显示不同效果（流式输出中、已完成、错误）

## 数据流向

```
┌─────────────────────────────────────────────────────┐
│                    ChatControl.ts                    │
│                  (业务逻辑层)                        │
└─────────────────────┬───────────────────────────────┘
                      │ 更新状态
                      ▼
┌─────────────────────────────────────────────────────┐
│                       Chax                           │
│                   (根容器组件)                       │
├───────────────┬─────────────────┬───────────────────┤
│               ▼                 ▼                   │
│      ┌─────────────────┐  ┌─────────────────┐       │
│      │  ChaxCoversation│  │   ChaxHistory   │       │
│      │  (会话组件)      │  │  (历史记录组件)  │       │
│      └────────┬────────┘  └────────┬────────┘       │
│               │                    │                │
│               ▼                    │                │
│      ┌─────────────────┐           │                │
│      │  ChaxMessage    │           │                │
│      │  (消息组件)      │◄──────────┘                │
│      └─────────────────┘                           │
│               ▲                                    │
│               │                                    │
│      ┌─────────────────┐                           │
│      │   ChaxInput     │                           │
│      │   (输入组件)     │                           │
│      └─────────────────┘                           │
└─────────────────────────────────────────────────────┘
```

## 事件传递链

### 用户输入流程

1. **用户输入** → ChaxInput 组件
   - 输入框内容更新 (`value` 属性)
   - 用户提交消息

2. **ChaxInput** → **Chax** (父组件)
   - 触发自定义事件传递消息内容

3. **Chax** → **ChatControl.ts** (业务逻辑层)
   - 调用发送消息方法
   - 发起 SSE 连接

4. **ChatControl.ts** → **Chax** (状态更新)
   - 更新 `input.value` 为空
   - 更新 `input.hasSSE` 为 true
   - 更新 `input.loading` 为 true
   - 更新 `current.history` 添加新消息

5. **Chax** → **ChaxCoversation** (渲染更新)
   - 消息列表渲染更新
   - 活跃消息开始流式输出

### 会话切换流程

1. **用户点击** → ChaxHistory 组件
   - 选择历史会话

2. **ChaxHistory** → **Chax** (父组件)
   - 触发会话切换事件

3. **Chax** → **ChatControl.ts** (业务逻辑层)
   - 调用加载会话方法

4. **ChatControl.ts** → **Chax** (状态更新)
   - 更新 `current` 为新会话数据

5. **Chax** → **ChaxCoversation** (渲染更新)
   - 切换显示的会话内容

## 组件依赖关系

| 组件 | 依赖组件 | 依赖类型 | 说明 |
|------|----------|----------|------|
| Chax | ChaxCoversation | 直接包含 | 通过 current 属性传递 |
| Chax | ChaxHistory | 直接包含 | 通过 history 属性传递 |
| Chax | ChaxInput | 直接包含 | 通过 input 属性传递 |
| ChaxCoversation | ChaxMessage | 循环包含 | 通过 history 数组和 active 属性 |
| ChaxMessage | 无 | 叶子组件 | 不包含其他组件 |

## 状态管理策略

### Props 单向数据流

所有组件状态通过 Props 从父组件传递，遵循 Vue 的单向数据流原则：

- **Chax** 接收来自 ChatControl 的完整状态 (IRecChax)
- **ChaxCoversation** 接收会话消息列表 (IRecChaxCoversation)
- **ChaxHistory** 接收历史记录列表 (IRecChaxHistory)
- **ChaxInput** 接收输入状态 (IRecChaxInput)
- **ChaxMessage** 接收单条消息数据 (IRecChaxMessage)

### 事件向上传递

子组件通过自定义事件将用户操作传递回父组件：

- **ChaxInput** → `send-message` → **Chax**
- **ChaxHistory** → `switch-conversation` → **Chax**

## 实现优先级

1. **ChaxMessage** (消息组件)
   - 基础渲染组件
   - 实现 Markdown 渲染
   - 支持流式输出动画

2. **ChaxInput** (输入组件)
   - 输入框基础功能
   - 加载状态显示
   - SSE 状态下的禁用逻辑

3. **ChaxCoversation** (会话组件)
   - 消息列表容器
   - 滚动管理
   - 消息项渲染

4. **ChaxHistory** (历史记录组件)
   - 会话列表展示
   - 选中状态管理
   - 会话切换交互

5. **Chax** (根容器组件)
   - 组件整合
   - 布局样式
   - 事件协调

## 文件结构

```
view/
├── interface.ts              # 类型定义 (IRecChax, IRecChaxCoversation, 等)
├── Chax.vue                  # 根容器组件
├── ChaxCoversation.vue       # 会话组件
├── ChaxHistory.vue           # 历史记录组件
├── ChaxInput.vue             # 输入组件
├── ChaxMessage.vue           # 消息组件
├── IMPLEMENTATION_PLAN.md    # 实现计划文档
└── COMPONENT_RELATIONSHIPS.md # 组件关系文档 (本文档)
```
