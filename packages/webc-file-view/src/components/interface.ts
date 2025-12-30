/**
 * WebcFileView组件接口定义文件
 * 定义了WebcFileView组件及其相关功能所需的所有类型和接口
 */

/**
 * 视图类型枚举：列表视图或网格视图
 */
export type ViewType = 'list' | 'grid';

/**
 * 文件类型枚举：文件或目录
 */
export type FileType = 'file' | 'directory';

/**
 * 元数据分组接口
 * 按组组织的附加信息
 */
export interface MetadataGroup {
    /**
     * 分组名称
     */
    name: string;
    /**
     * 分组描述（可选）
     */
    description?: string;
    /**
     * 分组内的键值对数据，其键为 metadata 中的键，值为别名
     */
    items: Record<string, string | number>;
}

/**
 * WebcFileView组件的属性接口
 * 定义了WebcFileView组件所需的配置参数
 */
export interface WebcFileViewProps {
    /**
     * 资源路径或数据源URL
     */
    src: string;
    /**
     * 视图类型
     */
    viewType: ViewType;
    /**
     * 文件/目录项列表数据
     */
    list: WebcFileItem[];
}


/**
 * 文件/目录项接口
 * 定义了文件或目录的属性结构
 */
export interface WebcFileItem {
    /**
     * 文件或目录名称
     */
    name: string;
    /**
     * 文件或目录地址
     */
    path: string;
    /**
     * 项目类型：文件或目录
     */
    type: FileType;
    /**
     * 文件大小（字节）
     */
    size: number;
    /**
     * 最后修改时间（时间戳）
     */
    lastModified: number;
    /**
     * 缩略图URL（可选）
     */
    thumbnail?: string;
    /**
     * 元数据（可选）
     * 键值对形式的附加信息
     */
    metadata?: Record<string, WebcFileMetaValue>;
    /**
     * 元数据分组（可选）
     * 按组组织的附加信息
     */
    metadataGroup?: MetadataGroup[];
}


/**
 * 文本类型元数据接口
 */
export type WebcFileMetaText = {
    type: 'text';
    /**
     * 文本内容
     */
    value: string;
};

/**
 * URL类型元数据接口
 */
export type WebcFileMetaUrl = {
    type: 'url';
    /**
     * URL显示标题
     */
    title: string;
    /**
     * URL地址
     */
    value: string;
};

/**
 * 操作类型元数据接口
 */
export type WebcFileMetaAction = {
    type: 'action';
    /**
     * 操作按钮标题
     */
    title: string;
    /**
     * 操作对应的标识符或值
     */
    value: string;
};

/**
 * 文件元数据值类型（联合类型）
 * 定义了元数据值的不同表现形式
 */
export type WebcFileMetaValue = WebcFileMetaText | WebcFileMetaUrl | WebcFileMetaAction;

/**
 * 文件视图处理器接口
 * 定义了文件视图控制器的基本功能和行为
 */
export interface IFileViewHandler {
    /** 当前视图配置 */
    view: WebcFileViewProps;
    
    /** 当前选中的文件详情项 */
    detailItem: WebcFileItem | undefined;
    
    /**
     * 处理文件项点击事件
     * @param item 被点击的文件项
     */
    onDetailItemClick(item: WebcFileItem): void;
    
    /**
     * 处理关闭文件详情事件
     */
    onDetailItemClose(): void;
    
    /**
     * 处理文件详情操作事件（可选实现）
     * @param value 操作值
     */
    onDetailItemAction?(_value: string): void;
    
    /**
     * 处理视图类型变更事件
     * @param type 新的视图类型
     */
    onChangeViewType(type: ViewType): void;
}