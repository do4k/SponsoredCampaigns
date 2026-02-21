import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function LoadTestPanel() {
    const [config, setConfig] = useState({ rps: 1000, duration: 30 });
    const [status, setStatus] = useState({ running: false, results: [] });
    const [error, setError] = useState(null);

    // Poll for status
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch('/api/loadtest/status');
                if (res.ok) {
                    const data = await res.json();
                    setStatus(data);
                }
            } catch (err) {
                console.error("Error fetching status", err);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const startTest = async () => {
        setError(null);
        try {
            const res = await fetch('/api/loadtest/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rps: parseInt(config.rps), duration: parseInt(config.duration) })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const stopTest = async () => {
        await fetch('/api/loadtest/stop', { method: 'POST' });
    };

    // Format data for chart
    const chartData = status.results.map(r => ({
        time: new Date(r.timestamp * 1000).toLocaleTimeString(),
        latency: r.avg_latency.toFixed(3),
        p99: r.p99_latency.toFixed(3),
        errors: r.errors
    }));

    return (
        <div className="card">
            <h2>Load Test (Latency)</h2>
            <div className="form-group" style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
                <div>
                    <label>RPS</label>
                    <input 
                        type="number" 
                        value={config.rps} 
                        onChange={e => setConfig({...config, rps: e.target.value})}
                    />
                </div>
                <div>
                    <label>Duration (s)</label>
                    <input 
                        type="number" 
                        value={config.duration} 
                        onChange={e => setConfig({...config, duration: e.target.value})}
                    />
                </div>
                {status.running ? (
                    <button className="danger" onClick={stopTest}>Stop</button>
                ) : (
                    <button onClick={startTest}>Start Test</button>
                )}
            </div>
            
            {error && <p style={{ color: 'red' }}>{error}</p>}
            
            <div style={{ height: '300px', marginTop: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" />
                        <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="latency" stroke="#8884d8" name="Avg Latency (ms)" dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="p99" stroke="#82ca9d" name="P99 Latency (ms)" dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                <p>Latest: {status.results.length > 0 ? `${status.results[status.results.length-1].avg_latency.toFixed(4)} ms` : '-'}</p>
                <p>Total Points: {status.results.length}</p>
            </div>
        </div>
    );
}
