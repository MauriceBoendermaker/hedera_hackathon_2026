import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Filler,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { fetchWithTimeout } from 'utils/fetchWithTimeout';
import { ANALYTICS_URL } from 'utils/HederaConfig';
import { ANALYTICS_TIMEOUT_MS } from 'config';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Filler, Tooltip, Legend,
);

ChartJS.defaults.color = 'rgba(255,255,255,0.7)';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.08)';

type Range = '7d' | '30d' | '90d';
type Granularity = 'hour' | 'day';

interface TimeseriesBucket { bucket: number; count: number }
interface GeoBucket { country: string; count: number }

const COUNTRY_NAMES: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
    JP: 'Japan', BR: 'Brazil', IN: 'India', CA: 'Canada', AU: 'Australia',
    IT: 'Italy', ES: 'Spain', MX: 'Mexico', KR: 'South Korea', NL: 'Netherlands',
    RU: 'Russia', SE: 'Sweden', CH: 'Switzerland', AR: 'Argentina', PL: 'Poland',
    TR: 'Turkey', ID: 'Indonesia', TH: 'Thailand', PH: 'Philippines',
    NG: 'Nigeria', ZA: 'South Africa', EG: 'Egypt', CO: 'Colombia',
    CL: 'Chile', PE: 'Peru', VE: 'Venezuela',
};

const REFERRER_COLORS: Record<string, string> = {
    'Twitter/X': '#1DA1F2',
    'WhatsApp': '#25D366',
    'Reddit': '#FF4500',
    'Facebook': '#1877F2',
    'LinkedIn': '#0A66C2',
    'Google': '#EA4335',
    'Telegram': '#26A5E4',
    'Discord': '#5865F2',
    'Direct': '#00ffe0',
    'Other': '#8a8a8a',
};

function formatBucket(ts: number, granularity: Granularity): string {
    const d = new Date(ts);
    if (granularity === 'hour') {
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function LinkAnalytics() {
    const { shortId } = useParams<{ shortId: string }>();
    const [range, setRange] = useState<Range>('7d');
    const [granularity, setGranularity] = useState<Granularity>('day');
    const [timeseries, setTimeseries] = useState<TimeseriesBucket[]>([]);
    const [referrers, setReferrers] = useState<Record<string, number>>({});
    const [geo, setGeo] = useState<GeoBucket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async () => {
        if (!shortId) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError('');

        const base = ANALYTICS_URL;
        const qs = `shortId=${encodeURIComponent(shortId)}&range=${range}&granularity=${granularity}`;

        try {
            const [tsRes, refRes, geoRes] = await Promise.all([
                fetchWithTimeout(`${base}/analytics/timeseries?${qs}`, controller.signal, ANALYTICS_TIMEOUT_MS),
                fetchWithTimeout(`${base}/analytics/referrers?${qs}`, controller.signal, ANALYTICS_TIMEOUT_MS),
                fetchWithTimeout(`${base}/analytics/geo?${qs}`, controller.signal, ANALYTICS_TIMEOUT_MS),
            ]);

            if (!tsRes.ok || !refRes.ok || !geoRes.ok) {
                throw new Error('One or more analytics requests failed.');
            }

            const [tsData, refData, geoData] = await Promise.all([
                tsRes.json(),
                refRes.json(),
                geoRes.json(),
            ]);

            if (!controller.signal.aborted) {
                setTimeseries(tsData.data || []);
                setReferrers(refData.data || {});
                setGeo(geoData.data || []);
            }
        } catch (e: any) {
            if (!controller.signal.aborted) {
                setError(e?.message || 'Failed to load analytics.');
            }
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [shortId, range, granularity]);

    useEffect(() => {
        fetchData();
        return () => { abortRef.current?.abort(); };
    }, [fetchData]);

    const timeseriesChart = timeseries.length > 0 ? (
        <div className="analytics-chart-wrapper">
            <Line
                data={{
                    labels: timeseries.map(b => formatBucket(b.bucket, granularity)),
                    datasets: [{
                        label: 'Clicks',
                        data: timeseries.map(b => b.count),
                        borderColor: '#00ffe0',
                        backgroundColor: 'rgba(0, 255, 224, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 3,
                        pointBackgroundColor: '#00ffe0',
                    }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                        x: { ticks: { maxTicksLimit: 12 } },
                    },
                }}
            />
        </div>
    ) : (
        <div className="analytics-empty">
            <i className="fas fa-chart-line" />
            No data for this period
        </div>
    );

    const refLabels = Object.keys(referrers);
    const referrerChart = refLabels.length > 0 ? (
        <div className="analytics-chart-wrapper analytics-chart-wrapper--doughnut">
            <Doughnut
                data={{
                    labels: refLabels,
                    datasets: [{
                        data: refLabels.map(l => referrers[l]),
                        backgroundColor: refLabels.map(l => REFERRER_COLORS[l] || '#8a8a8a'),
                        borderWidth: 0,
                    }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { padding: 16, usePointStyle: true, pointStyleWidth: 10 },
                        },
                    },
                }}
            />
        </div>
    ) : (
        <div className="analytics-empty">
            <i className="fas fa-share-alt" />
            No referrer data for this period
        </div>
    );

    const geoChart = geo.length > 0 ? (
        <div className="analytics-chart-wrapper">
            <Bar
                data={{
                    labels: geo.map(g => COUNTRY_NAMES[g.country] || g.country),
                    datasets: [{
                        label: 'Visits',
                        data: geo.map(g => g.count),
                        backgroundColor: 'rgba(201, 95, 255, 0.6)',
                        borderColor: '#c95fff',
                        borderWidth: 1,
                        borderRadius: 4,
                    }],
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { beginAtZero: true, ticks: { precision: 0 } },
                    },
                }}
            />
        </div>
    ) : (
        <div className="analytics-empty">
            <i className="fas fa-globe" />
            No geographic data for this period
        </div>
    );

    return (
        <section className="analytics-container">
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-10 glass-card">
                        <div className="analytics-header">
                            <div>
                                <Link to="/dashboard" className="analytics-back">
                                    <i className="fas fa-arrow-left" /> Back to Dashboard
                                </Link>
                                <h2 className="title-glow mt-2 mb-0">
                                    Analytics: <code>{shortId}</code>
                                </h2>
                            </div>
                            <div className="analytics-controls">
                                <div className="analytics-range-selector">
                                    {(['7d', '30d', '90d'] as Range[]).map(r => (
                                        <button
                                            key={r}
                                            className={range === r ? 'active' : ''}
                                            onClick={() => setRange(r)}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                                <div className="analytics-range-selector">
                                    {(['day', 'hour'] as Granularity[]).map(g => (
                                        <button
                                            key={g}
                                            className={granularity === g ? 'active' : ''}
                                            onClick={() => setGranularity(g)}
                                        >
                                            {g === 'day' ? 'Daily' : 'Hourly'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="analytics-loading">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading analytics...</span>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="analytics-error">
                                <i className="fas fa-exclamation-triangle" />
                                <p>{error}</p>
                                <button className="btn btn-sm btn-outline-light" onClick={fetchData}>
                                    <i className="fas fa-redo me-1" /> Retry
                                </button>
                            </div>
                        ) : (
                            <div className="analytics-sections">
                                <div className="analytics-section">
                                    <h3><i className="fas fa-chart-line" />Clicks Over Time</h3>
                                    {timeseriesChart}
                                </div>
                                <div className="analytics-section">
                                    <h3><i className="fas fa-share-alt" />Referrer Breakdown</h3>
                                    {referrerChart}
                                </div>
                                <div className="analytics-section">
                                    <h3><i className="fas fa-globe" />Geographic Distribution</h3>
                                    {geoChart}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default LinkAnalytics;
