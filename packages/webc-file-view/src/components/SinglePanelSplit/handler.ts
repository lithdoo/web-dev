export class SinglePanelSplitHandler {
  position: 'left' | 'right' | 'top' | 'bottom' = 'left'
  disabled: boolean = false
  // 这个 distance 不会约束布局内的组件宽度/高度，而是作为参数传入
  // 所以引用这个组件的需要自行实现高度、宽度控制
  // 这么设计目的是抽离折叠功能，使用者可以通过 disabled 参数自行实现
  distance: number = 240
  maxDistance: number = 360
  minDistance: number = 198
  isMax: boolean = false
  siderBarWidth: null | string = null

  isHorizontal() {
    return this.position === 'left' || this.position === 'right'
  }

  isVertical() {
    return this.position === 'top' || this.position === 'bottom'
  }

  bindController(controller: HTMLElement) {
    this.destroyController()

    const start = { x: 0, y: 0, distance: 0 }

    const update = (current: { x: number; y: number }) => {
      const offsetX = current.x - start.x
      const offsetY = current.y - start.y

      if (this.position === 'left') {
        const calc = start.distance + offsetX

        const newDistance =
          calc > this.maxDistance
            ? this.maxDistance
            : calc < this.minDistance
              ? this.minDistance
              : calc

        this.distance = newDistance

        return
      }

      if (this.position === 'right') {
        const calc = start.distance - offsetX

        const newDistance =
          calc > this.maxDistance
            ? this.maxDistance
            : calc < this.minDistance
              ? this.minDistance
              : calc

        this.distance = newDistance

        return
      }

      if (this.position === 'top') {
        const calc = start.distance + offsetY

        const newDistance =
          calc > this.maxDistance
            ? this.maxDistance
            : calc < this.minDistance
              ? this.minDistance
              : calc

        this.distance = newDistance

        return
      }

      if (this.position === 'bottom') {
        const calc = start.distance - offsetY

        const newDistance =
          calc > this.maxDistance
            ? this.maxDistance
            : calc < this.minDistance
              ? this.minDistance
              : calc

        this.distance = newDistance

        return
      }
    }

    const startDragging = (e: MouseEvent) => {
      start.x = e.screenX
      start.y = e.screenY
      start.distance = this.distance
      globalThis.addEventListener('mousemove', moveDragging)
      globalThis.addEventListener('mouseup', stopDragging)
    }

    const moveDragging = (e: MouseEvent) => {
      const { screenX, screenY } = e
      update({ x: screenX, y: screenY })
    }

    const stopDragging = (_e: MouseEvent) => {
      globalThis.removeEventListener('mousemove', moveDragging)
      globalThis.removeEventListener('mouseup', moveDragging)
    }

    controller.addEventListener('mousedown', startDragging)

    this.destroyController = () => {
      controller.removeEventListener('mousedown', startDragging)
    }
  }

  max(isMax: boolean = true) {
    this.isMax = isMax
  }

  destroyController: () => void = () => {}

  setDistance(num: number) {
    if (num < this.minDistance) {
      return (this.distance = this.minDistance)
    }

    if (num > this.maxDistance) {
      return (this.distance = this.maxDistance)
    }
    return (this.distance = num)
  }
}
