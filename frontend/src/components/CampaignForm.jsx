import { useState, useEffect } from 'react';

const timeOptions = ['early-hours', 'breakfast', 'lunch', 'dinner', 'all-day'];
const dayOptions = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function CampaignForm({ editingCampaign, onSuccess, onCancel }) {
    const [formData, setFormData] = useState({
        partner_id: '',
        bid_price: 500,
        created_by: 'ui@user',
        delivery_areas: '',
        time_of_day: [],
        days_of_week: []
    });

    useEffect(() => {
        if (editingCampaign) {
            setFormData({
                partner_id: editingCampaign.partner_id,
                bid_price: editingCampaign.bid_price,
                created_by: editingCampaign.created_by,
                delivery_areas: editingCampaign.delivery_areas.join(', '),
                time_of_day: editingCampaign.time_of_day || [],
                days_of_week: editingCampaign.days_of_week || []
            });
        } else {
            // Reset for new
            setFormData({
                partner_id: '',
                bid_price: 500,
                created_by: 'ui@user',
                delivery_areas: '',
                time_of_day: [],
                days_of_week: []
            });
        }
    }, [editingCampaign]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation for Delivery Areas
        const areas = formData.delivery_areas.split(',').map(s => s.trim());
        if (areas.includes('*') && areas.length > 1) {
            alert("Delivery Areas cannot contain both '*' and specific areas. Please select only '*' or specific areas.");
            return;
        }

        const payload = {
            ...formData,
            bid_price: parseInt(formData.bid_price),
            delivery_areas: areas,
        };

        try {
            const url = editingCampaign ? `/api/campaigns/${editingCampaign.id}` : '/api/campaigns';
            const method = editingCampaign ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onSuccess(); // Refresh list
                if (!editingCampaign) {
                    // Reset if creating new
                    setFormData({
                        partner_id: '',
                        bid_price: 500,
                        created_by: 'ui@user',
                        delivery_areas: '',
                        time_of_day: [],
                        days_of_week: []
                    });
                }
            } else {
                alert("Error saving campaign: " + res.statusText);
            }
        } catch (err) {
            alert("Error saving campaign: " + err.message);
        }
    };

    const toggleTime = (time) => {
        setFormData(prev => {
            const times = prev.time_of_day.includes(time)
                ? prev.time_of_day.filter(t => t !== time)
                : [...prev.time_of_day, time];
            return { ...prev, time_of_day: times };
        });
    };

    const toggleDay = (day) => {
        setFormData(prev => {
            const days = prev.days_of_week.includes(day)
                ? prev.days_of_week.filter(d => d !== day)
                : [...prev.days_of_week, day];
            return { ...prev, days_of_week: days };
        });
    };


    return (
        <div className="form-panel">
            <h2>{editingCampaign ? 'Edit Campaign' : 'New Campaign'}</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Partner ID</label>
                    <input
                        value={formData.partner_id}
                        onChange={e => setFormData({ ...formData, partner_id: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Bid Price (cents)</label>
                    <input
                        type="number"
                        value={formData.bid_price}
                        onChange={e => setFormData({ ...formData, bid_price: e.target.value })}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Delivery Areas (comma sep)</label>
                    <input
                        value={formData.delivery_areas}
                        onChange={e => setFormData({ ...formData, delivery_areas: e.target.value })}
                        placeholder="BS1, BS2, *"
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Time of Day</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {timeOptions.map(t => (
                            <button
                                key={t}
                                type="button"
                                className={formData.time_of_day.includes(t) ? '' : 'secondary'}
                                onClick={() => toggleTime(t)}
                                style={{ fontSize: '0.8rem', padding: '5px 8px' }}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="form-group">
                    <label>Days of Week</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {dayOptions.map(day => (
                            <button
                                key={day}
                                type="button"
                                className={formData.days_of_week.includes(day) ? '' : 'secondary'}
                                onClick={() => toggleDay(day)}
                                style={{ fontSize: '0.8rem', padding: '5px 8px' }}
                            >
                                {day.substring(0, 3)}
                            </button>
                        ))}
                    </div>
                </div>
                <button type="submit">{editingCampaign ? 'Update' : 'Create'}</button>
                {editingCampaign && (
                    <button
                        type="button"
                        className="secondary"
                        onClick={onCancel}
                        style={{ marginLeft: '10px' }}
                    >
                        Cancel
                    </button>
                )}
            </form>
        </div>
    );
}
