import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const chartColors = ['#0284c7', '#059669', '#d97706', '#dc2626', '#64748b']

function DashboardInsights({
  title = 'People insights',
  description,
  loading = false,
  error = '',
  kpis = [],
  charts = [],
  filters = [],
  filterSummary = '',
  onResetFilters,
}) {
  const hasKpis = kpis.some((kpi) => kpi.value !== null && kpi.value !== undefined)
  const hasChartData = charts.some((chart) => Array.isArray(chart.data) && chart.data.length > 0)

  return (
    <section className="workspace-insights" aria-labelledby="dashboard-insights-title">
      <div className="mb-4 flex flex-col gap-3">
        <div>
          <span className="panel-heading__eyebrow">Live HR data</span>
          <h2 id="dashboard-insights-title" className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
        </div>
        {filters.length > 0 && (
          <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-3">
              {filters.map((filter) => (
                <label key={filter.id} className="min-w-0 flex-1 basis-40">
                  <span className="mb-1 block text-xs font-medium text-slate-600">{filter.label}</span>
                  {filter.type === 'select' ? (
                    <select className="field-input" value={filter.value} onChange={filter.onChange} disabled={loading}>
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="field-input"
                      type={filter.type || 'date'}
                      value={filter.value}
                      onChange={filter.onChange}
                      min={filter.min}
                      max={filter.max}
                      required={filter.required}
                      disabled={loading}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {filterSummary && <p className="text-xs text-slate-500">{filterSummary}</p>}
              {onResetFilters && (
                <button type="button" className="action-button-secondary" onClick={onResetFilters} disabled={loading}>
                  Reset filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {loading && <p className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">Loading dashboard insights...</p>}
      {error && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">{error}</p>}

      {!loading && !hasKpis && !hasChartData && !error && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600" role="status">
          No dashboard data is available for this selection.
        </p>
      )}

      {!loading && hasKpis && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const card = <>
              <p className="text-sm font-medium text-slate-700">{kpi.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{kpi.value ?? 'Unavailable'}</p>
              {kpi.detail && <p className="mt-1 text-sm leading-5 text-slate-600">{kpi.detail}</p>}
            </>
            return kpi.to
              ? <Link key={kpi.label} to={kpi.to} className="panel-surface block p-4 hover:border-sky-500 focus-visible:outline-2 focus-visible:outline-sky-600 sm:p-5">
                  {card}<span className="mt-2 block text-sm font-semibold text-sky-800">View records</span>
                </Link>
              : <article key={kpi.label} className="panel-surface p-4 sm:p-5">{card}</article>
          })}
        </div>
      )}

      {!loading && charts.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          {charts.map((chart) => (
            <article key={chart.title} className="panel-surface min-w-0 p-4 sm:p-5">
              <div className="mb-3">
                <h3 className="font-semibold text-slate-900">{chart.title}</h3>
                {chart.description && <p className="mt-1 text-xs text-slate-500">{chart.description}</p>}
              </div>
              {!Array.isArray(chart.data) || chart.data.length === 0 ? (
                <p className="flex h-64 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-slate-500" role="status">
                  No records are available for this chart.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  {chart.type === 'pie' ? (
                    <PieChart>
                      <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius="65%">
                        {chart.data.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  ) : chart.type === 'line' ? (
                    <LineChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey={chart.xKey} minTickGap={20} tickMargin={7} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={68} />
                      <Tooltip />
                      <Legend />
                      {chart.series.map((series, index) => (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          stroke={series.color || chartColors[index % chartColors.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  ) : (
                    <BarChart data={chart.data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey={chart.xKey} minTickGap={20} tickMargin={7} tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={Boolean(chart.currency)} tick={{ fontSize: 12 }} width={chart.currency ? 56 : 42}
                        tickFormatter={chart.currency ? (value) => new Intl.NumberFormat('en', { notation: 'compact' }).format(value) : undefined} />
                      <Tooltip formatter={chart.currency ? (value) => `${chart.currency} ${Number(value).toLocaleString('en', { minimumFractionDigits: 2 })}` : undefined} />
                      {chart.series.length > 1 && <Legend />}
                      {chart.series.map((series, index) => (
                        <Bar
                          key={series.key}
                          dataKey={series.key}
                          name={series.label}
                          stackId={chart.stacked ? 'total' : undefined}
                          fill={series.color || chartColors[index % chartColors.length]}
                          radius={chart.stacked ? 0 : [4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default DashboardInsights
