import { useState } from 'react';

export default function CheckSponsored() {
  const [deliveryArea, setDeliveryArea] = useState('BS1');
  const [partnerIds, setPartnerIds] = useState('');
  const [includeCarousel, setIncludeCarousel] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  const handleCheck = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setResponseTime(null);

    const partners = partnerIds.split(',').map(s => s.trim()).filter(Boolean);
    
    if (partners.length === 0) {
        setError("Please enter at least one Partner ID");
        setLoading(false);
        return;
    }

    const startTime = performance.now();
    try {
      const res = await fetch('/api/sponsored/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_area: deliveryArea,
          partner_ids: partners,
          include_carousel: includeCarousel
        })
      });

      const endTime = performance.now();
      setResponseTime((endTime - startTime).toFixed(2));

      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to check');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="check-panel" style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '8px', background: '#f9f9f9' }}>
      <h3>Check Sponsorship Status</h3>
      <form onSubmit={handleCheck}>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '5px' }}>Delivery Area</label>
          <input 
            value={deliveryArea} 
            onChange={e => setDeliveryArea(e.target.value)} 
            placeholder="e.g. BS1"
            required 
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div className="form-group">
          <label style={{ display: 'block', marginBottom: '5px' }}>Partner IDs (comma separated)</label>
          <textarea
            value={partnerIds}
            onChange={e => setPartnerIds(e.target.value)}
            placeholder="e.g. 123, 456, 789"
            required
            rows={3}
            style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: '10px' }}>
             <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input 
                    type="checkbox" 
                    checked={includeCarousel}
                    onChange={e => setIncludeCarousel(e.target.checked)}
                    style={{ marginRight: '8px' }}
                />
                Include Carousel Boosted
             </label>
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '10px' }}>
          {loading ? 'Checking...' : 'Check Now'}
        </button>
      </form>

      {error && <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>}

      {result && (
        <div style={{ marginTop: '15px', padding: '10px', background: '#fff', border: '1px solid #eee' }}>
          <h4>Result <span style={{fontSize: '0.8em', color: '#666', fontWeight: 'normal'}}>({responseTime}ms total, {result.meta.server_processing_ms}ms server)</span></h4>
          <p><strong>Time Bucket:</strong> {result.meta.time_bucket}</p>
          <p><strong>Active Partners:</strong></p>
          {result.active_partners.length > 0 ? (
            <ul>
              {result.active_partners.map(pid => (
                <li key={pid} style={{ color: 'green', fontWeight: 'bold' }}>{pid}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'gray' }}>No active partners found for this criteria.</p>
          )}
        </div>
      )}
    </div>
  );
}
