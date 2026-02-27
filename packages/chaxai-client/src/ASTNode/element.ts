export class InfoElement {


    private elements: {
        title: HTMLElement,
        outer: HTMLElement,
        inner: HTMLElement,
        target: HTMLDivElement,
        hr: HTMLElement,
    }

    private currentViewType: 'hidden' | 'maxHeight' | 'scroll' = 'maxHeight'

    private transitionDuration = 500

    get viewType() {
        return this.currentViewType
    }

    constructor(
        public contentElement: HTMLElement
    ) {
        this.elements = this.initElements()
        this.setViewType('scroll')
    }

    private initElements() {
        const initTitleElement = () => {
            const ele = document.createElement('h4')
            ele.style.display = 'flex'
            ele.style.alignItems = 'center'

            const titleText = document.createElement('div')
            titleText.style.flex = '1 1 0'
            titleText.style.overflow = 'hidden'
            titleText.style.textOverflow = 'ellipsis'
            titleText.style.whiteSpace = 'nowrap'
            titleText.style.width = '0'
            const titleToggle = document.createElement('button')
            titleToggle.style.flex = '0 0 auto'
            ele.appendChild(titleText)
            ele.appendChild(titleToggle)
            titleToggle.textContent = this.currentViewType 
            titleToggle.onclick = () => this.toggle()
            ele.style.fontWeight = 'bold'
            ele.style.margin = '8px 24px 0 24px'
            return ele
        }

        const initContentContainer = () => {
            const outer = document.createElement('div')
            const inner = document.createElement('div')
            outer.style.transition = `height ${this.transitionDuration}ms ease`
            inner.style.overflow = 'hidden'
            outer.appendChild(inner)
            inner.appendChild(this.contentElement)
            return { outer, inner }
        }

        const initTargetElement = () => {
            const ele = document.createElement('div')
            ele.style.display = 'flex'
            ele.style.flexDirection = 'column'
            ele.style.border = '1px solid #ccc'
            ele.style.padding = '4px'
            ele.style.borderRadius = '6px'
            ele.style.backgroundColor = '#f9f9f9'
            ele.style.marginBottom = '10px'
            return ele
        }

        const initHrElement = () => {
            const ele = document.createElement('hr')
            ele.style.border = 'none'
            ele.style.borderTop = '1px solid #ccc'
            ele.style.margin = '10px 0'
            return ele
        }

        const target = initTargetElement()
        const hr = initHrElement()

        const title = initTitleElement()
        const { outer, inner } = initContentContainer()

        target.appendChild(title)
        target.appendChild(hr)
        target.appendChild(outer)
        return { title, outer, inner, target, hr }
    }

    setTitle(title: string) {
        this.titleTextElement.textContent = title
        return this
    }

    get target() {
        return this.elements.target
    }

    private currentViewTypeTask: Promise<void> | null = null
    setViewType(viewType: 'hidden' | 'maxHeight' | 'scroll') {
        if (viewType === this.currentViewType) {
            return this
        }
        if (this.currentViewTypeTask) {
            return this
        }

        this.currentViewTypeTask = new Promise<void>(async (resolve, _reject) => {
            const initHeight =  async ()=>{
                this.elements.outer.style.overflow = 'hidden'
                this.elements.outer.style.height = this.elements.inner.clientHeight + 'px'
                this.elements.outer.style.maxHeight = ''
                await new Promise(resolve => setTimeout(resolve, 0))
            }

            if (viewType === 'hidden') {
                await initHeight()
                
                this.elements.outer.style.height = '0'
            } else if (viewType === 'maxHeight') {
                
                await initHeight()

                const maxHeight = this.elements.inner.clientHeight
                this.elements.outer.style.height = `${maxHeight}px`
                await new Promise(resolve => setTimeout(resolve, this.transitionDuration))
                this.elements.outer.style.height = `auto`
            } else if (viewType === 'scroll') {
                await initHeight()

                this.elements.outer.style.overflow = 'auto'
                const maxHeight = this.elements.inner.clientHeight > 200
                    ? 200 : this.elements.inner.clientHeight
                this.elements.outer.style.height = `${maxHeight}px`
                await new Promise(resolve => setTimeout(resolve, this.transitionDuration))
                this.elements.outer.style.maxHeight = '200px'
                this.elements.outer.style.height = 'auto'
            }

            this.currentViewType = viewType
            this.titleToggleElement.textContent = viewType

            resolve()

        })
        this.currentViewTypeTask.finally(() => {
            this.currentViewTypeTask = null
        })


    }

    toggle() {
        this.setViewType(
            this.currentViewType === 'hidden' ? 'maxHeight' :
                this.currentViewType === 'maxHeight' ? 'scroll' : 'hidden')
    }


    private get titleTextElement (){
        return this.elements.title.querySelector('div')!
    }

    private get titleToggleElement (){
        return this.elements.title.querySelector('button')!
    }


    scrollToBottom(){
        if(this.currentViewType !== 'scroll'){
            return 
        }
        this.elements.outer.scrollTo({
            top: this.elements.outer.scrollHeight,
            behavior: 'smooth'
        })
    }
}