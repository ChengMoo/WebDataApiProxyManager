import { useEffect, useRef } from 'react'
import type { ECharts, EChartsCoreOption } from 'echarts'

export function EChart({
  option,
  className,
}: {
  option: EChartsCoreOption
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let disposed = false
    let observer: ResizeObserver | null = null
    let chart: ECharts | null = null

    const setup = async () => {
      const element = ref.current
      if (!element) {
        return
      }

      const echarts = await import('echarts')
      if (disposed) {
        return
      }

      chart = echarts.init(element)
      chart.setOption({
        backgroundColor: 'transparent',
        ...option,
      })

      observer = new ResizeObserver(() => chart?.resize())
      observer.observe(element)
    }

    void setup()

    return () => {
      disposed = true
      observer?.disconnect()
      chart?.dispose()
    }
  }, [option])

  return <div ref={ref} className={className ?? 'chart'} />
}
