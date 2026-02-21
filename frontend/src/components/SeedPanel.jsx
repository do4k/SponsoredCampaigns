import { useState } from 'react';

export default function SeedPanel({ onSuccess }) {
    const [seedCount, setSeedCount] = useState(10);
    const [loading, setLoading] = useState(false);

    const handleSeed = async () => {
        setLoading(true);
        try {
            await fetch('/api/campaigns/seed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count: parseInt(seedCount) })
            });
            // Wait a bit for async seed to process
            setTimeout(onSuccess, 1000);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="seed-panel">
            <h3>Load Test Seeder</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
                <input
                    type="number"
                    value={seedCount}
                    onChange={e => setSeedCount(e.target.value)}
                    min="1" max="1000"
                />
                <button onClick={handleSeed} disabled={loading}>
                    {loading ? 'Seeding...' : 'Generate'}
                </button>
            </div>
        </div>
    );
}
