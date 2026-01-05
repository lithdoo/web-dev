export interface ETab {
    title: string,
    element: HTMLElement
}

export class TabControl {

    list: ETab[] = []
    current?: ETab

    addTab(tab: ETab) {
        const { element } = tab
        const exist = this.list.find(v => v.element === element)
        if (exist) {
            this.current = exist
        } else {
            this.list = [...this.list, tab]
            this.switchTo(tab)
        }
    }
    removeTab(tab: ETab) {
        const { element } = tab


        if (this.current?.element === element) {
            const pre = this.list.find((_v,i)=>this.list[i+1]?.element === element)
            const next = this.list.find((_v,i)=>this.list[i-1]?.element === element)
            this.current = next || pre
        }
        this.list = this.list.filter(v => v.element !== element)
    }


    switchTo(tab: ETab) {
        const { element } = tab
        const exist = this.list.find(v => v.element === element)
        if (exist && this.current !== exist) {
            this.current = exist
        }
    }

    closeTab() {
        this.current = undefined
    }

    clearTab(){
        this.current = undefined
        this.list = []
    }


}