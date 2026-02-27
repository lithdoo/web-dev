import { InfoElement } from "./element";
import { BaseViewNode, CacheRootViewNode, CodeNode, CodeViewNode, defaultRenderer, defaultRendererKeyType, MDNodeType, MDViewNode, TextNode } from "./render";





interface ProcessViewContent {
    target: HTMLElement
    update(val: string): void
}



export class ProcessViewNode extends BaseViewNode<CodeNode, HTMLDivElement> {



    static content(type: string): ProcessViewContent {
        if (type.startsWith('[md|')) {
            return new CacheRootViewNode(defaultRenderer, defaultRendererKeyType, null)
        }

        if (type.startsWith('[json|')) {
            const node: CodeNode = {
                type: MDNodeType.Code,
                lang: 'json',
                value: '',
            }

            const view = new CodeViewNode(node)

            return new class implements ProcessViewContent {
                get target() {
                    return view.target
                }
                update(val: string) {
                    view.update(val)
                }
            }
        }
        
        else {

            const target = document.createElement('pre')
            target.style.background = 'transparent'
            target.style.textWrap = 'auto'
            const update = (val:string)=>{
                target.textContent = val
            }

            return {
                target,
                update,
            }
        }

    }




    element: InfoElement
    root: ProcessViewContent
    constructor(node: CodeNode) {
        super(node, null)
        this.update(node)
        this.target = document.createElement('div')
        this.root = ProcessViewNode.content(node.lang || '')
        this.update(node)


        const infoElement = new InfoElement(this.root.target)
        infoElement.setTitle(node.lang || '无语言')
        this.element = infoElement
        this.target = infoElement.target
    }

    initChildren(_children: MDViewNode[]): void {

    }
    updateChildren(_remove: MDViewNode[], _append: MDViewNode[]): void {

    }

    update(node: CodeNode): void {
        const content = node.value
        this.root?.update(content)
        this.element?.scrollToBottom()
    }

}

export const customRenderer = (type: MDNodeType, node: any) => {
    if (type === MDNodeType.Code && node.lang?.[0] === '[') {
        return new ProcessViewNode(node)
    } else {
        return defaultRenderer(type, node)
    }
}
export const customRendererKeyType = (type: MDNodeType, node: any) => {
    if (type === MDNodeType.Code && node.lang?.[0] === '[') {
        return 'ProcessViewNode'
    } else {
        return defaultRendererKeyType(type, node)
    }
}
