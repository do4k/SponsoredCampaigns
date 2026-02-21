import { useState, useEffect } from 'react';
import CampaignList from './components/CampaignList';
import CampaignForm from './components/CampaignForm';
import SeedPanel from './components/SeedPanel';
import CheckSponsored from './components/CheckSponsored';
import LoadTestPanel from './components/LoadTestPanel';
import RedisExplorer from './components/RedisExplorer';
import BackendToggle, { BackendProvider } from './components/BackendToggle';

function App() {
  const [campaigns, setCampaigns] = useState([]);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 1,
    total_items: 0
  });

  useEffect(() => {
    fetchCampaigns(1);
  }, []);

  const fetchCampaigns = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns?page=${page}&limit=10`);
      const data = await res.json();
      
      // Handle both old array format (during migration) and new paginated format
      if (Array.isArray(data)) {
         setCampaigns(data);
         setPagination({ current_page: 1, total_pages: 1, total_items: data.length });
      } else {
         setCampaigns(data.data || []);
         setPagination(data.meta || { current_page: 1, total_pages: 1, total_items: 0 });
      }
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.total_pages) {
      fetchCampaigns(newPage);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      fetchCampaigns(pagination.current_page);
    } catch (err) {
      alert("Error deleting campaign");
    }
  };

  const handleEdit = (camp) => {
    setEditingCampaign(camp);
  };

  const handleFormSuccess = () => {
    fetchCampaigns(1); // Reset to page 1 on new/update
    setEditingCampaign(null);
  };

  const handleCancelEdit = () => {
    setEditingCampaign(null);
  };

  return (
    <BackendProvider>
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Sponsor Campaign Manager</h1>
        <BackendToggle />
      </div>
      
      <div className="grid">
        <div>
          <CampaignForm 
            editingCampaign={editingCampaign} 
            onSuccess={handleFormSuccess}
            onCancel={handleCancelEdit}
          />
          <SeedPanel onSuccess={fetchCampaigns} />
          
          <div style={{ marginTop: '20px' }}>
            <h2>Check Sponsorship</h2>
            <CheckSponsored />
          </div>

          <div style={{ marginTop: '20px' }}>
             <LoadTestPanel />
          </div>

          <div style={{ marginTop: '20px' }}>
            <RedisExplorer />
          </div>
        </div>

        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2>Running Campaigns ({pagination.total_items})</h2>
            <button onClick={() => fetchCampaigns(pagination.current_page)} className="secondary">Refresh</button>
          </div>
          
          <CampaignList 
            campaigns={campaigns} 
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
             <button 
                onClick={() => handlePageChange(pagination.current_page - 1)} 
                disabled={pagination.current_page <= 1 || loading}
                className="secondary"
             >
                Previous
             </button>
             <span>Page {pagination.current_page} of {pagination.total_pages}</span>
             <button 
                onClick={() => handlePageChange(pagination.current_page + 1)} 
                disabled={pagination.current_page >= pagination.total_pages || loading}
                className="secondary"
             >
                Next
             </button>
          </div>
        </div>
      </div>
    </div>
    </BackendProvider>
  );
}

export default App;
