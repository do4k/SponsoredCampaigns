export default function CampaignList({ campaigns, onEdit, onDelete, loading }) {
    if (loading) return <p>Loading...</p>;
    if (!campaigns.length) return <p>No campaigns found.</p>;

    return (
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Partner</th>
                    <th>Bid</th>
                    <th>Areas</th>
                    <th>Times</th>
                    <th>Days</th>
                    <th>Boost</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {campaigns.map(camp => (
                    <tr key={camp.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{camp.id.substring(0, 8)}...</td>
                        <td>{camp.partner_id}</td>
                        <td>{camp.bid_price}</td>
                        <td>
                            {camp.delivery_areas.map(a => (
                                <span key={a} className="badge">{a}</span>
                            ))}
                        </td>
                        <td>
                            {camp.time_of_day.map(t => (
                                <span key={t} className="badge">{t}</span>
                            ))}
                        </td>
                        <td>
                            {camp.days_of_week && camp.days_of_week.map(d => (
                                <span key={d} className="badge">{d.substring(0,3)}</span>
                            ))}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                            {camp.carousel_boost ? (
                                <span style={{ color: 'green', fontSize: '1.2em' }}>✓</span>
                            ) : (
                                <span style={{ color: '#ccc' }}>-</span>
                            )}
                        </td>
                        <td className="actions">
                            <button className="secondary" onClick={() => onEdit(camp)}>Edit</button>
                            <button className="danger" onClick={() => onDelete(camp.id)}>Del</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
