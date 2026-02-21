import { createContext, useContext, useState } from 'react';

const BackendContext = createContext();

export const BACKENDS = {
    go: { label: 'Go', prefix: '/api', color: '#00ADD8' },
    csharp: { label: 'C#', prefix: '/api-csharp', color: '#68217A' },
};

export function BackendProvider({ children }) {
    const [backend, setBackend] = useState('go');
    return (
        <BackendContext.Provider value={{ backend, setBackend, config: BACKENDS[backend] }}>
            {children}
        </BackendContext.Provider>
    );
}

export function useBackend() {
    return useContext(BackendContext);
}

export default function BackendToggle() {
    const { backend, setBackend } = useBackend();

    const styles = {
        container: {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: '#f8f9fa',
            borderRadius: '6px',
            border: '1px solid #ddd',
            fontSize: '13px',
        },
        label: {
            fontWeight: 'bold',
            color: '#555',
            fontSize: '12px',
            whiteSpace: 'nowrap',
        },
        toggle: {
            display: 'flex',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #ddd',
        },
        option: (key) => ({
            padding: '4px 12px',
            cursor: 'pointer',
            border: 'none',
            fontSize: '12px',
            fontWeight: backend === key ? 'bold' : 'normal',
            background: backend === key ? BACKENDS[key].color : '#fff',
            color: backend === key ? '#fff' : '#555',
            transition: 'all 0.15s',
        }),
        indicator: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: BACKENDS[backend].color,
            flexShrink: 0,
        },
    };

    return (
        <div style={styles.container}>
            <div style={styles.indicator} />
            <span style={styles.label}>Backend:</span>
            <div style={styles.toggle}>
                <button
                    style={styles.option('go')}
                    onClick={() => setBackend('go')}
                >
                    Go
                </button>
                <button
                    style={styles.option('csharp')}
                    onClick={() => setBackend('csharp')}
                >
                    C#
                </button>
            </div>
        </div>
    );
}
