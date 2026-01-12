export interface Node {
    label: string,
    metadata?: Record<string, unknown>;
}

export interface Edge {
    sourceKey: string,
    targetKey: string,
    label: string,
    metadata?: Record<string, unknown>;
}

export interface Graph {
    entries: string[],
    endPoints: string[]
    nodes: {
        node: Node
        keyname: string
    }[]
    edges: Edge[]
}

export interface ExecuteNode<State> extends Node {
    run: (state: State) => Promise<State>;
    snapshot?: (state: State) => unknown;
}
export interface ExecuteEdge<Condition> extends Edge {
    condition?: Condition;
}

export interface DefaultCondition<State> {
    check: (state: State) => boolean | Promise<boolean>;
    priority?: number;
    description?: string;
}

export enum ExecutionStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    FAILED = 'failed'
}

export interface ExecuteGraph<State, Condition> extends Graph {
    nodes: {
        node: ExecuteNode<State>
        keyname: string
    }[]
    edges: ExecuteEdge<Condition>[]

    execute(entry: string, initialState: State): {
        result: Promise<ExecutionResult<State>>;
        context: ExecutionContext;
    };
    cancel(): void;
}

export interface ExecutionContext {
    executionId: string;
    startTime: Date;
    metadata: Record<string, unknown>;
    abort: () => void
    pause(): Promise<void>;
    resume(): Promise<void>;
    status: () => ExecutionStatus;
}


export interface ExecutionAbortSignal {
    abort: () => void;
}

export interface ExecutionError<State> extends Error {
    nodeKey: string;
    executionPath: NodeExecutionRecord[];
    currentState: State;
}

export interface ExecutionResult<State> {
    finalState: State;
    executionPath: NodeExecutionRecord[];
}

export interface NodeExecutionRecord {
    nodeKey: string;
    startTime: Date;
    endTime: Date;
    snapshot?: unknown
}