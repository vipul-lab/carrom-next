'use client'

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type ChartType,
} from 'chart.js'
import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import type { IconName } from '@/components/ui/Icon'
import type { ChartPayload } from '@/lib/services/dashboard'

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)

const PALETTE = ['#2563eb', '#16a34a', '#9333ea', '#f59e0b', '#0ea5e9', '#ef4444', '#14b8a6', '#6366f1']

Chart.defaults.font.family = "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
Chart.defaults.font.size = 12
Chart.defaults.color = '#64748b'
Chart.defaults.plugins.tooltip.backgroundColor = '#16233a'
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.tooltip.cornerRadius = 8
Chart.defaults.plugins.tooltip.displayColors = false
Chart.defaults.plugins.legend.display = false

const gridScale = (extra: Record<string, unknown> = {}) => ({
  grid: { color: '#e9eef5', drawTicks: false },
  border: { display: false },
  ticks: { padding: 8, precision: 0 },
  ...extra,
})

const noGridScale = () => ({
  grid: { display: false },
  border: { display: false },
  ticks: { padding: 6 },
})

const bottomLegend = {
  display: true,
  position: 'bottom' as const,
  labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle' as const, padding: 14 },
}

/** One canvas that mounts a Chart.js instance and tears it down on unmount. */
function ChartCanvas<T extends ChartType>({ config }: { config: ChartConfiguration<T> }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ref.current) return

    const chart = new Chart(ref.current, config)
    return () => chart.destroy()
  }, [config])

  return <canvas ref={ref} />
}

/** An empty chart reads as broken — show the empty state instead. */
function ChartCard<T extends ChartType>({
  title,
  subtitle,
  hasData,
  emptyIcon,
  emptyTitle,
  config,
}: {
  title: string
  subtitle: string
  hasData: boolean
  emptyIcon: IconName
  emptyTitle: string
  config: ChartConfiguration<T>
}) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="relative h-72">
        {hasData ? <ChartCanvas config={config} /> : <EmptyState icon={emptyIcon} title={emptyTitle} />}
      </div>
    </Card>
  )
}

export function DashboardCharts({ charts }: { charts: ChartPayload }) {
  const { pointsByPlayer, pointsByTeam, gamesOverTime, winsLosses } = charts

  const someValues = (values: number[]) => values.some((v) => Number(v) > 0)

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard
        title="Wins by Player"
        subtitle="Top 8 winners"
        emptyIcon="chart"
        emptyTitle="No results recorded yet"
        hasData={pointsByPlayer.labels.length > 0 && someValues(pointsByPlayer.values)}
        config={{
          type: 'bar',
          data: {
            labels: pointsByPlayer.labels,
            datasets: [
              {
                label: 'Wins',
                data: pointsByPlayer.values,
                backgroundColor: '#2563eb',
                hoverBackgroundColor: '#1d4ed8',
                borderRadius: 6,
                maxBarThickness: 26,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: gridScale({ beginAtZero: true }), y: noGridScale() },
          },
        }}
      />

      <ChartCard
        title="Wins by Team"
        subtitle="Share of all games won"
        emptyIcon="chart"
        emptyTitle="No results recorded yet"
        hasData={pointsByTeam.labels.length > 0 && someValues(pointsByTeam.values)}
        config={{
          type: 'doughnut',
          data: {
            labels: pointsByTeam.labels,
            datasets: [
              {
                data: pointsByTeam.values,
                backgroundColor: (pointsByTeam.colors.length ? pointsByTeam.colors : PALETTE).slice(
                  0,
                  pointsByTeam.labels.length,
                ),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: { legend: bottomLegend },
          },
        }}
      />

      <ChartCard
        title="Games Played Over Time"
        subtitle="Most recent match days"
        emptyIcon="calendar"
        emptyTitle="No completed games yet"
        hasData={gamesOverTime.labels.length > 0 && someValues(gamesOverTime.values)}
        config={{
          type: 'line',
          data: {
            labels: gamesOverTime.labels,
            datasets: [
              {
                label: 'Games',
                data: gamesOverTime.values,
                borderColor: '#9333ea',
                backgroundColor: 'rgba(147, 51, 234, 0.12)',
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: '#9333ea',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: noGridScale(), y: gridScale({ beginAtZero: true }) },
          },
        }}
      />

      <ChartCard
        title="Wins vs Losses"
        subtitle="Per team results"
        emptyIcon="trophy"
        emptyTitle="No results yet"
        hasData={winsLosses.labels.length > 0 && someValues(winsLosses.wins)}
        config={{
          type: 'bar',
          data: {
            labels: winsLosses.labels,
            datasets: [
              {
                label: 'Wins',
                data: winsLosses.wins,
                backgroundColor: '#16a34a',
                borderRadius: 5,
                maxBarThickness: 22,
              },
              {
                label: 'Losses',
                data: winsLosses.losses,
                backgroundColor: '#ef4444',
                borderRadius: 5,
                maxBarThickness: 22,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: bottomLegend, tooltip: { displayColors: true } },
            scales: { x: noGridScale(), y: gridScale({ beginAtZero: true }) },
          },
        }}
      />
    </div>
  )
}
