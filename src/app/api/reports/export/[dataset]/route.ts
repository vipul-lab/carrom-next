import { NextResponse, type NextRequest } from 'next/server'
import { connectToDatabase } from '@/lib/db'
import { customPeriod, periodFromKey } from '@/lib/stats-period'
import { gameExportRows, playerExportRows, teamExportRows, toCsv } from '@/lib/services/reports'

const DATASETS = ['players', 'teams', 'games'] as const
type Dataset = (typeof DATASETS)[number]

/** CSV download for players, teams or games. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dataset: string }> },
) {
  const { dataset } = await params
  if (!DATASETS.includes(dataset as Dataset)) {
    return NextResponse.json({ error: 'Unknown dataset.' }, { status: 404 })
  }

  const search = request.nextUrl.searchParams
  const from = search.get('from')
  const to = search.get('to')

  // A custom date range overrides the preset period.
  const period = from || to ? customPeriod(from, to) : periodFromKey(search.get('period') ?? 'all')

  await connectToDatabase()

  const rows =
    dataset === 'teams'
      ? await teamExportRows(period)
      : dataset === 'games'
        ? await gameExportRows(period)
        : await playerExportRows(period)

  const filename = `carrom-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`

  // The BOM keeps Excel from mangling non-ASCII names.
  return new NextResponse('﻿' + toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
