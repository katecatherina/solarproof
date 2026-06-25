'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Filter } from 'lucide-react'

interface Certificate {
  id: string
  kwh: number
  issued_at: string
  retired: boolean
  retired_at: string | null
  anchor_tx_hash: string
  mint_tx_hash: string
}

interface CertificatesResponse {
  certificates: Certificate[]
  total: number
  page: number
  limit: number
}

async function fetchCertificates(params: URLSearchParams): Promise<CertificatesResponse> {
  const res = await fetch(`/api/certificates?${params}`)
  if (!res.ok) throw new Error('Failed to load certificates')
  return res.json()
}

export default function CertificateHistoryPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [meterId, setMeterId] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (meterId) params.set('meter_id', meterId)
  params.set('page', String(page))
  params.set('limit', String(limit))

  const { data, isLoading, error } = useQuery({
    queryKey: ['certificates', from, to, meterId, page],
    queryFn: () => fetchCertificates(params),
  })

  function downloadCsv() {
    const csvParams = new URLSearchParams(params)
    csvParams.set('format', 'csv')
    csvParams.set('limit', '100')
    window.open(`/api/certificates?${csvParams}`, '_blank')
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Certificate History
        </h1>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <section aria-label="Filters" className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <Filter className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <label htmlFor="from-date" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            From
          </label>
          <input
            id="from-date"
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to-date" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            To
          </label>
          <input
            id="to-date"
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1) }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="meter-id" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Meter ID
          </label>
          <input
            id="meter-id"
            type="text"
            placeholder="UUID"
            value={meterId}
            onChange={(e) => { setMeterId(e.target.value); setPage(1) }}
            className="w-72 rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        {(from || to || meterId) && (
          <button
            onClick={() => { setFrom(''); setTo(''); setMeterId(''); setPage(1) }}
            className="text-sm text-gray-500 underline hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </section>

      {/* Error */}
      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
          Failed to load certificates.
        </p>
      )}

      {/* Summary bar */}
      {data && (
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
          {data.total.toLocaleString()} certificate{data.total !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table
            className="min-w-full divide-y divide-gray-200 bg-white text-sm dark:divide-gray-800 dark:bg-gray-900"
            aria-label="Certificate history"
            aria-busy={isLoading}
          >
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                {['Certificate ID', 'kWh', 'Issued', 'Status', 'Anchor Tx', 'Mint Tx'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-gray-100 dark:bg-gray-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.certificates.length ? (
                data.certificates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {c.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{c.kwh}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {new Date(c.issued_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.retired
                            ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        }`}
                      >
                        {c.retired ? 'Retired' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-500">
                      {c.anchor_tx_hash.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-500">
                      {c.mint_tx_hash.slice(0, 10)}…
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No certificates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
