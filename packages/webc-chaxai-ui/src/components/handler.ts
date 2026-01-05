/**
 * 文件视图控制器类
 * 负责处理文件视图的状态管理和用户交互逻辑
 */
import type { ViewType, WebcFileItem, WebcFileViewProps, IFileViewHandler } from "./interface";

/**
 * 文件视图控制器
 * 管理文件视图的状态和交互逻辑
 */
export class FileViewHandler implements IFileViewHandler {
    /** 当前选中的文件详情项 */
    private _detailItem?: WebcFileItem;

    /**
     * 构造函数
     * @param view 视图属性配置
     */
    constructor(public view: WebcFileViewProps) {
    }

    /**
     * 获取当前选中的文件详情项
     */
    get detailItem(): WebcFileItem | undefined {
        return this._detailItem;
    }

    /**
     * 设置当前选中的文件详情项
     */
    set detailItem(item: WebcFileItem | undefined) {
        this._detailItem = item;
    }

    /**
     * 处理文件项点击事件
     * @param item 被点击的文件项
     */
    onDetailItemClick(item: WebcFileItem): void {
        this._detailItem = item;
    }

    /**
     * 处理关闭文件详情事件
     */
    onDetailItemClose(): void {
        this._detailItem = undefined;
    }

    /**
     * 处理文件详情操作事件（可选实现）
     * @param value 操作值
     */
    onDetailItemAction?(_value: string): void {
        // 默认实现为空，可由子类重写
    }

    /**
     * 处理视图类型变更事件
     * @param type 新的视图类型
     */
    onChangeViewType(type: ViewType): void {
        this.view.viewType = type;
    }
}
