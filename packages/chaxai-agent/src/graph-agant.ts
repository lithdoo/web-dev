
import {
    ExecuteGraph,
    ExecuteNode,
    ExecuteEdge,
    ExecutionContext,
    ExecutionResult
} from './graph-base';
import {
    AgentState,
    AgentMessage,
    HistoryMessage,
    ToolCall,
} from './graph-llm';

/**
 * 工具定义
 */
export interface Tool {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
}

/**
 * 边条件类型
 */
export type AgentEdgeCondition = {
    prompt?: string;
}


export interface AgentExState extends AgentState {
}

/**
 * Agent 边
 */
export interface AgentEdge extends ExecuteEdge<AgentEdgeCondition> {
}


/**
 * Agent 节点
 */
export interface AgentNode extends ExecuteNode<AgentExState> {
}

/**
 * Agent 图配置
 */
export interface AgentGraphConfig {
    name: string;
    description?: string;
    maxIterations?: number;
    timeout?: number;
}

/**
 * Agent 执行上下文扩展
 */
export interface AgentExecutionContext extends ExecutionContext {
    currentNodeKey(): string;
    iterationCount(): number;
    getMessages: () => AgentMessage[];
    addMessage: (message: AgentMessage) => void;
    addHistory: (message: HistoryMessage) => void;
    getToolCalls: () => ToolCall[];
    clearToolCalls: () => void;
}

/**
 * Agent 图执行结果
 */
export interface AgentExecutionResult extends ExecutionResult<AgentExState> {
    success: boolean;
    finalMessage?: string;
    iterations: number;
}

/**
 * Graph Agent 接口
 * 基于图结构执行的 LLM Agent
 */
export interface GraphAgent extends ExecuteGraph<AgentExState, AgentEdgeCondition> {
    config: AgentGraphConfig;

    validate(): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    };
}





export interface GraphRouter {
    graph: GraphAgent

    // 通过当前节点和状态获取下一个节点
    next(
        currentNodeKey: string,
        state: AgentExState,
        sendChunk: (chunk: string) => Promise<void>
    ): Promise<string>
}



// export class GraphAgentBuilder<NodeKeyName extends string> {
//     static create(config: AgentGraphConfig) {
//         return new GraphAgentBuilder<string>(config, new Map());
//     }
//     routes: {
//         start: NodeKeyName;
//         routes: {
//             to: NodeKeyName;
//             condition: AgentEdgeCondition;
//         }[];
//     }[] = []

//     endNodes: NodeKeyName[] = [];

//     constructor(public config: AgentGraphConfig, public nodes: Map<NodeKeyName, {
//         node: AgentNode;
//         keyname: NodeKeyName;
//     }>) { }

//     initNodes(nodes: { [key in NodeKeyName]: AgentNode }) {
//         const nodeMap = new Map<NodeKeyName, {
//             node: AgentNode;
//             keyname: NodeKeyName;
//         }>();
//         for (const key in nodes) {
//             this.nodes.set(key, {
//                 node: nodes[key],
//                 keyname: key
//             })
//         }

//         return new GraphAgentBuilder<NodeKeyName>(this.config, nodeMap);
//     }

//     addRoute(start: NodeKeyName, route: {
//         to: NodeKeyName;
//         condition: AgentEdgeCondition;
//     }[]) {
//         this.routes.push({
//             start,
//             routes: route
//         })

//         return this
//     }

//     setEndPoints(endNodes: NodeKeyName[]) {
//         this.endNodes = endNodes;

//         return this
//     }

//     //  build(): GraphAgent;
// }



// export class GraphRouteMap<NodeKeyName extends string> {


//     nodes: Map<NodeKeyName, {
//         node: AgentNode;
//         keyname: NodeKeyName;
//     }> = new Map();

//     routes: {
//         from: NodeKeyName;
//         routes: {
//             to: NodeKeyName;
//             condition: AgentEdgeCondition;
//         }[];
//     }[] = []

//     endNodes: NodeKeyName[] = [];
// }