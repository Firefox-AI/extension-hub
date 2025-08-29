import { LitElement } from 'lit'

type Constructor<T = {}> = new (...args: any[]) => T

export const FeatureViewMixin = <T extends Constructor<LitElement>>(
  Base: T,
) => {
  class FeatureView extends Base {
    queryTimer: number = 0
    intervalId: number = 0

    millToSeconds(ms: number) {
      return (ms / 1000).toFixed(1)
    }

    setQueryTimer(action: 'start' | 'stop') {
      if (action === 'start') {
        this.queryTimer = 0
        this.intervalId = window.setInterval(() => {
          this.queryTimer += 500
          this.requestUpdate()
        }, 500) as unknown as number
      } else {
        clearInterval(this.intervalId)
        this.intervalId = 0
      }
    }

    disconnectedCallback() {
      super.disconnectedCallback()
      this.setQueryTimer('stop')
    }
  }

  return FeatureView as Constructor<FeatureView> & T
}
