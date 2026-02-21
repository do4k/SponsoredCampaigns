import { useState, useEffect, useCallback } from 'react';

export default function RedisExplorer() {
    const [info, setInfo] = useState(null);
    const [keys, setKeys] = useState(null);
    const [selectedKey, setSelectedKey] = useState(null);
    const [keyDetail, setKeyDetail] = useState(null);
    const [pattern, setPattern] = useState('sponsors:*');
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'keys'

    const fetchInfo = useCallback(async () => {
        try {
            const res = await fetch('/api/redis/info');
            if (res.ok) {
                const data = await res.json();
                setInfo(data);
            }
        } catch (err) {
            console.error('Error fetching Redis info', err);
        }
    }, []);

    const fetchKeys = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/redis/keys?pattern=${encodeURIComponent(pattern)}`);
            if (res.ok) {
                const data = await res.json();
                setKeys(data);
            }
        } catch (err) {
            console.error('Error fetching Redis keys', err);
        } finally {
            setLoading(false);
        }
    }, [pattern]);

    const fetchKeyDetail = useCallback(async (key) => {
        try {
            const res = await fetch(`/api/redis/key?key=${encodeURIComponent(key)}`);
            if (res.ok) {
                const data = await res.json();
                setKeyDetail(data);
                setSelectedKey(key);
            }
        } catch (err) {
            console.error('Error fetching key detail', err);
        }
    }, []);

    useEffect(() => {
        fetchInfo();
    }, [fetchInfo]);

    const formatBytes = (bytes) => {
        if (bytes == null || bytes === undefined) return '-';
        const num = parseInt(bytes);
        if (isNaN(num)) return bytes;
        if (num < 1024) return num + ' B';
        if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
        return (num / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const styles = {
        container: {
            background: '#1a1a2e',
            borderRadius: '8px',
            padding: '16px',
            color: '#e0e0e0',
            fontSize: '13px',
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
        },
        title: {
            color: '#e94560',
            margin: 0,
            fontSize: '16px',
            fontWeight: 'bold',
        },
        tabs: {
            display: 'flex',
            gap: '4px',
            marginBottom: '12px',
        },
        tab: (active) => ({
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: active ? 'bold' : 'normal',
            background: active ? '#e94560' : '#16213e',
            color: active ? 'white' : '#8892b0',
        }),
        statGrid: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginBottom: '12px',
        },
        statCard: {
            background: '#16213e',
            padding: '10px',
            borderRadius: '6px',
            textAlign: 'center',
        },
        statValue: {
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#e94560',
        },
        statLabel: {
            fontSize: '11px',
            color: '#8892b0',
            marginTop: '2px',
        },
        searchBar: {
            display: 'flex',
            gap: '6px',
            marginBottom: '10px',
        },
        input: {
            flex: 1,
            padding: '6px 10px',
            border: '1px solid #16213e',
            borderRadius: '4px',
            background: '#0f3460',
            color: '#e0e0e0',
            fontSize: '12px',
            boxSizing: 'border-box',
        },
        searchBtn: {
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            background: '#e94560',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px',
        },
        keyList: {
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #16213e',
            borderRadius: '4px',
        },
        keyRow: (selected) => ({
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 10px',
            cursor: 'pointer',
            background: selected ? '#0f3460' : 'transparent',
            borderBottom: '1px solid #16213e',
            fontSize: '12px',
            transition: 'background 0.15s',
        }),
        keyName: {
            fontFamily: 'monospace',
            fontSize: '11px',
            wordBreak: 'break-all',
            flex: 1,
        },
        badge: (type) => {
            const colors = {
                hash: '#e94560',
                set: '#0f3460',
                string: '#533483',
                list: '#16213e',
                zset: '#1a5276',
            };
            return {
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                background: colors[type] || '#333',
                color: 'white',
                marginLeft: '6px',
                whiteSpace: 'nowrap',
            };
        },
        detailPanel: {
            background: '#16213e',
            borderRadius: '6px',
            padding: '10px',
            marginTop: '10px',
        },
        detailHeader: {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#e94560',
            wordBreak: 'break-all',
            marginBottom: '8px',
        },
        fieldsTable: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '11px',
        },
        fieldRow: {
            borderBottom: '1px solid #1a1a2e',
        },
        fieldKey: {
            padding: '4px 8px',
            fontFamily: 'monospace',
            color: '#64ffda',
        },
        fieldValue: {
            padding: '4px 8px',
            fontFamily: 'monospace',
            color: '#ccd6f6',
        },
        memoryBar: {
            height: '6px',
            background: '#16213e',
            borderRadius: '3px',
            marginTop: '4px',
            overflow: 'hidden',
        },
        memoryFill: (pct) => ({
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            background: pct > 80 ? '#e94560' : pct > 50 ? '#f39c12' : '#64ffda',
            borderRadius: '3px',
            transition: 'width 0.3s',
        }),
        sectionTitle: {
            fontSize: '12px',
            color: '#8892b0',
            marginBottom: '6px',
            fontWeight: 'bold',
        },
        infoRow: {
            display: 'flex',
            justifyContent: 'space-between',
            padding: '3px 0',
            borderBottom: '1px solid #1a1a2e',
            fontSize: '11px',
        },
        infoLabel: {
            color: '#8892b0',
        },
        infoValue: {
            color: '#ccd6f6',
            fontFamily: 'monospace',
        },
        countBadge: {
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            background: '#0f3460',
            color: '#64ffda',
            marginLeft: '6px',
        },
    };

    const renderOverview = () => {
        if (!info) return <div style={{ textAlign: 'center', padding: '20px', color: '#8892b0' }}>Loading...</div>;

        const memory = info.memory || {};
        const server = info.server || {};
        const stats = info.stats || {};
        const usedMem = parseInt(memory.used_memory || '0');
        const maxMem = parseInt(memory.maxmemory || '0');
        const memPct = maxMem > 0 ? (usedMem / maxMem * 100) : 0;

        return (
            <div>
                <div style={styles.statGrid}>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{info.total_keys != null ? info.total_keys.toLocaleString() : '-'}</div>
                        <div style={styles.statLabel}>Total Keys</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{formatBytes(memory.used_memory)}</div>
                        <div style={styles.statLabel}>Used Memory</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{formatBytes(memory.used_memory_rss)}</div>
                        <div style={styles.statLabel}>RSS Memory</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statValue}>{stats.total_commands_processed ? parseInt(stats.total_commands_processed).toLocaleString() : '-'}</div>
                        <div style={styles.statLabel}>Total Commands</div>
                    </div>
                </div>

                {maxMem > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                        <div style={styles.sectionTitle}>Memory Usage ({memPct.toFixed(1)}%)</div>
                        <div style={styles.memoryBar}>
                            <div style={styles.memoryFill(memPct)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8892b0', marginTop: '2px' }}>
                            <span>{formatBytes(memory.used_memory)}</span>
                            <span>{formatBytes(memory.maxmemory)}</span>
                        </div>
                    </div>
                )}

                <div style={styles.sectionTitle}>Memory Details</div>
                {[
                    ['Peak Memory', formatBytes(memory.used_memory_peak)],
                    ['Lua Memory', formatBytes(memory.used_memory_lua)],
                    ['Fragmentation Ratio', memory.mem_fragmentation_ratio || '-'],
                    ['Evicted Keys', stats.evicted_keys || '0'],
                    ['Hit Rate', stats.keyspace_hits && stats.keyspace_misses
                        ? ((parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses))) * 100).toFixed(1) + '%'
                        : '-'],
                ].map(([label, val], i) => (
                    <div key={i} style={styles.infoRow}>
                        <span style={styles.infoLabel}>{label}</span>
                        <span style={styles.infoValue}>{val}</span>
                    </div>
                ))}

                <div style={{ ...styles.sectionTitle, marginTop: '10px' }}>Server</div>
                {[
                    ['Redis Version', server.redis_version || '-'],
                    ['Uptime', server.uptime_in_seconds ? Math.floor(parseInt(server.uptime_in_seconds) / 3600) + 'h' : '-'],
                    ['Connected Clients', stats.connected_clients || info.stats?.connected_clients || '-'],
                    ['Ops/sec', stats.instantaneous_ops_per_sec || '-'],
                ].map(([label, val], i) => (
                    <div key={i} style={styles.infoRow}>
                        <span style={styles.infoLabel}>{label}</span>
                        <span style={styles.infoValue}>{val}</span>
                    </div>
                ))}
            </div>
        );
    };

    const renderKeys = () => (
        <div>
            <div style={styles.searchBar}>
                <input
                    style={styles.input}
                    value={pattern}
                    onChange={e => setPattern(e.target.value)}
                    placeholder="sponsors:*"
                    onKeyDown={e => e.key === 'Enter' && fetchKeys()}
                />
                <button style={styles.searchBtn} onClick={fetchKeys} disabled={loading}>
                    {loading ? '...' : 'Scan'}
                </button>
            </div>

            {keys && (
                <div style={{ marginBottom: '8px', fontSize: '11px', color: '#8892b0' }}>
                    Found {keys.count} keys{keys.truncated ? ' (truncated)' : ''}
                </div>
            )}

            <div style={styles.keyList}>
                {keys && keys.keys && keys.keys.map((k) => (
                    <div
                        key={k.key}
                        style={styles.keyRow(selectedKey === k.key)}
                        onClick={() => fetchKeyDetail(k.key)}
                        onMouseEnter={e => { if (selectedKey !== k.key) e.currentTarget.style.background = '#0f3460'; }}
                        onMouseLeave={e => { if (selectedKey !== k.key) e.currentTarget.style.background = 'transparent'; }}
                    >
                        <span style={styles.keyName}>{k.key}</span>
                        <span style={styles.badge(k.type)}>{k.type}</span>
                        <span style={styles.countBadge}>{k.size}</span>
                    </div>
                ))}
                {keys && keys.keys && keys.keys.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8892b0' }}>No keys found</div>
                )}
                {!keys && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8892b0' }}>
                        Enter a pattern and click Scan
                    </div>
                )}
            </div>

            {keyDetail && selectedKey && (
                <div style={styles.detailPanel}>
                    <div style={styles.detailHeader}>{keyDetail.key}</div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', fontSize: '11px' }}>
                        <span>Type: <span style={{ color: '#e94560' }}>{keyDetail.type}</span></span>
                        <span>Memory: <span style={{ color: '#64ffda' }}>{formatBytes(keyDetail.memory_bytes)}</span></span>
                        <span>TTL: <span style={{ color: '#f39c12' }}>{keyDetail.ttl_ms === -1 ? 'none' : keyDetail.ttl_ms + 'ms'}</span></span>
                    </div>

                    {keyDetail.type === 'hash' && keyDetail.fields && (
                        <div>
                            <div style={styles.sectionTitle}>Fields ({keyDetail.field_count})</div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <table style={styles.fieldsTable}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #1a1a2e' }}>
                                            <th style={{ ...styles.fieldKey, color: '#8892b0', fontWeight: 'normal' }}>Partner ID</th>
                                            <th style={{ ...styles.fieldValue, color: '#8892b0', fontWeight: 'normal' }}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(keyDetail.fields).map(([field, val]) => (
                                            <tr key={field} style={styles.fieldRow}>
                                                <td style={styles.fieldKey}>{field}</td>
                                                <td style={styles.fieldValue}>{val}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {keyDetail.type === 'string' && (
                        <div>
                            <div style={styles.sectionTitle}>Value</div>
                            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64ffda', padding: '6px', background: '#1a1a2e', borderRadius: '4px' }}>
                                {keyDetail.value}
                            </div>
                        </div>
                    )}

                    {keyDetail.type === 'set' && keyDetail.members && (
                        <div>
                            <div style={styles.sectionTitle}>Members ({keyDetail.member_count})</div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {keyDetail.members.map((m, i) => (
                                    <div key={i} style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64ffda', padding: '2px 6px' }}>
                                        {m}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h2 style={styles.title}>Redis Explorer</h2>
                <button
                    style={{ ...styles.searchBtn, fontSize: '11px', padding: '4px 8px' }}
                    onClick={fetchInfo}
                >
                    Refresh
                </button>
            </div>

            <div style={styles.tabs}>
                <button style={styles.tab(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
                    Overview
                </button>
                <button style={styles.tab(activeTab === 'keys')} onClick={() => { setActiveTab('keys'); if (!keys) fetchKeys(); }}>
                    Key Browser
                </button>
            </div>

            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'keys' && renderKeys()}
        </div>
    );
}
