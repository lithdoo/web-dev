# Agent System Design Document

## Overview

基于图结构执行的 LLM Agent 系统，支持工具调用、条件路由和流式输出。

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AgentBuilder                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  配置: name, maxIterations, timeout                 │   │
│  │  节点: LLMNode (带工具绑定能力)                      │   │
│  │  边:   SimpleAgentEdge (普通边/条件边)              │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │ build()
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                        AgentGraph                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  config: AgentGraphConfig                           │   │
│  │  nodes: Array<{node, keyname}>                      │   │
│  │  edges: AgentEdge[]                                 │   │
│  │  entries: string[] (入口点)                         │   │
│  │  endPoints: string[] (终点节点)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│              ┌─────────────┴─────────────┐                  │
│              │       execute()           │                  │
│              ▼                           ▼                  │
│  ┌─────────────────────┐     ┌─────────────────────┐       │
│  │  DefaultAgent       │     │  Promise<Agent      │       │
│  │  ExecutionContext   │     │  ExecutionResult>   │       │
│  └─────────────────────┘     └─────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### AgentGraph

图执行引擎，负责遍历节点并执行。

**关键方法：**

| 方法 | 说明 |
|------|------|
| `execute(entry, initialState)` | 开始执行，返回 Promise 和执行上下文 |
| `getNode(key)` | 获取指定节点 |
| `cancel()` | 取消执行 |
| `validate()` | 验证图结构 |

**执行流程：**

```typescript
entry → 节点执行 → 查找下一条边 → 判断是否为终点
                    ↓
              否 → 更新状态 → 继续循环
              是 → 返回结果
```

### AgentBuilder

构建器模式，简化图结构创建。

**使用方法：**

```typescript
const graph = new AgentBuilder('my-agent')
    .setDescription('AI 助手')
    .setMaxIterations(50)
    .setTimeout(60000)
    .addLLMNode('chat', '对话节点', llm, tools, '你是 Helpful AI')
    .addLLMNode('review', '审核节点', llm, tools, '你是严格审核员')
    .addEdge('chat', 'review')
    .setEntryPoint('chat')
    .setEndPoints(['review'])
    .build();
```

### LLMNode

LLM 执行节点，集成了工具调用能力。

**功能：**
- 构建消息（system + history + context）
- 调用 LLM 并处理流式响应
- 执行工具调用并收集结果
- 自动将工具结果加入上下文

**消息构建：**

```typescript
messages = [
    ...systemPrompt,                    // 系统提示
    ...history (user/assistant),        // 历史对话
    ...context (全部消息类型)            // 当前上下文
]
```

### DefaultAgentExecutionContext

执行上下文，管理执行状态。

| 属性/方法 | 说明 |
|-----------|------|
| `executionId` | 执行 ID |
| `startTime` | 开始时间 |
| `iterationCount()` | 当前迭代次数 |
| `status()` | 执行状态 |
| `pause()/resume()` | 暂停/恢复 |
| `abort()` | 中止执行 |
| `addMessage()/addHistory()` | 添加消息 |
| `getToolCalls()` | 获取工具调用记录 |

**执行状态：** `PENDING` → `RUNNING` → `COMPLETED/CANCELLED/ERROR`

## Message Types

```typescript
AgentMessage =
    | AIMessageInAgent        // 助手消息 (含 tool_calls)
    | UserMessageInAgent      // 用户消息
    | SystemMessageInAgent    // 系统消息
    | ToolMessage             // 工具调用结果
```

**状态管理：**

```typescript
AgentState = {
    history: HistoryMessage[],   // 已完成的对话轮次
    context: AgentMessage[],     // 当前上下文
    sendChunk: (chunk) => void   // 流式输出回调
}
```

## Edge Routing

### 普通边

```typescript
builder.addEdge('nodeA', 'nodeB');
```

### 条件边

```typescript
builder.addConditionalEdge(
    'nodeA',
    'nodeB',
    '根据上下文判断是否需要路由到 B'
);
```

**条件评估：**
- 多条出边时，按顺序评估条件
- 首个满足条件的边作为路由目标
- 无条件边作为默认路由

## Execution Result

```typescript
AgentExecutionResult = {
    finalState: AgentState,      // 最终状态
    executionPath: NodeExecutionRecord[],  // 执行路径
    success: boolean,            // 是否成功
    finalMessage?: string,       // 最终消息
    iterations: number           // 迭代次数
}
```

## Configuration

```typescript
AgentGraphConfig = {
    name: string,                // 名称 (必填)
    description?: string,        // 描述
    maxIterations?: number,      // 最大迭代次数 (默认: 50)
    timeout?: number             // 超时时间 ms (默认: 60000)
}
```

## Design Decisions

### 1. 单一节点类型

所有功能集成到 `LLMNode`，不区分工具节点和输入节点。简化了图结构，降低复杂度。

### 2. 可变状态 vs 不可变状态

- `AgentGraph` 不可变，创建后不能修改
- `AgentState` 可变，便于在执行过程中更新
- `DefaultAgentExecutionContext` 管理执行状态

### 3. 条件评估

当前 `evaluateCondition` 是占位实现。理想方案：
- 使用 LLM 判断路由条件
- 返回布尔值决定是否选择该边

### 4. 工具调用追踪

- 工具调用信息存储在消息的 `tool_calls` 字段
- 执行上下文通过 `getToolCalls()` 获取完整调用记录
- 避免在状态中重复存储

## Limitations & Future Work

1. **条件评估**：需要集成真正的 LLM 条件判断
2. **超时处理**：需要实现超时机制
3. **检查点**：未实现执行中断后的恢复
4. **并行执行**：仅支持顺序执行
5. **错误重试**：节点执行失败时未实现重试机制
