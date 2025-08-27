import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  RefreshCw, 
  Download,
  Bell,
  Settings,
  ChevronDown
} from 'lucide-react';
import OpportunityCard from './OpportunityCard';
import FilterPanel from './FilterPanel';
import StatsPanel from './StatsPanel';
import RealTimeUpdates from './RealTimeUpdates';
import ExportModal from './ExportModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useDebounce } from '../hooks/useDebounce';

interface DashboardProps {
  user?: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const [opportunities, setOpportunities] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    minScore: 0,
    status: 'new',
    timeRange: '24h',
    search: '',
    sortBy: 'score'
  });
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    reviewed: 0,
    avgScore: 0,
    trending: []
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [selectedOps, setSelectedOps] = useState(new Set());
  
  const debouncedSearch = useDebounce(filters.search, 300);
  const { messages, connected } = useWebSocket('/ws/opportunities');
  
  // Infinite scroll
  const {
    items: visibleOpportunities,
    hasMore,
    loadMore,
    reset
  } = useInfiniteScroll(opportunities, 20);
  
  // Fetch opportunities
  const fetchOpportunities = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const params = new URLSearchParams({
        ...filters,
        search: debouncedSearch
      });
      
      const response = await fetch(`/api/opportunities?${params}`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      
      const data = await response.json();
      setOpportunities(data.opportunities);
      setStats(data.stats);
      reset();
    } catch (error) {
      console.error('Failed to fetch opportunities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, debouncedSearch, user]);
  
  // Handle real-time updates
  useEffect(() => {
    messages.forEach(msg => {
      if (msg.type === 'new_opportunity') {
        setOpportunities(prev => [msg.data, ...prev]);
        setStats(prev => ({
          ...prev,
          total: prev.total + 1,
          new: prev.new + 1
        }));
      }
    });
  }, [messages]);
  
  // Initial fetch and filter changes
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 'r':
            e.preventDefault();
            fetchOpportunities(true);
            break;
          case 'e':
            e.preventDefault();
            setShowExport(true);
            break;
          case '/':
            e.preventDefault();
            document.getElementById('search-input')?.focus();
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);
  
  // Memoized computations
  const selectedCount = useMemo(() => selectedOps.size, [selectedOps]);
  
  const filteredOpportunities = useMemo(() => {
    return visibleOpportunities.sort((a, b) => {
      switch(filters.sortBy) {
        case 'score': return b.potentialScore - a.potentialScore;
        case 'recent': return new Date(b.createdAt) - new Date(a.createdAt);
        case 'engagement': return b.engagement.engagementScore - a.engagement.engagementScore;
        default: return 0;
      }
    });
  }, [visibleOpportunities, filters.sortBy]);
  
  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/opportunities/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      setOpportunities(prev => prev.map(opp => 
        opp._id === id ? { ...opp, status: newStatus } : opp
      ));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };
  
  const handleBulkAction = async (action: string) => {
    const ids = Array.from(selectedOps);
    
    try {
      await fetch('/api/opportunities/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ ids, action })
      });
      
      fetchOpportunities();
      setSelectedOps(new Set());
    } catch (error) {
      console.error('Bulk action failed:', error);
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <TrendingUp size={32} className="logo-icon" />
            <div>
              <h1>Opportunity Scanner</h1>
              <p>AI-powered business opportunity discovery</p>
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              className="btn-refresh"
              onClick={() => fetchOpportunities(true)}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'spinning' : ''} size={20} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            
            <button className="btn-export" onClick={() => setShowExport(true)}>
              <Download size={20} />
              Export
            </button>
            
            <div className="connection-status">
              <div className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
              {connected ? 'Live' : 'Offline'}
            </div>
            
            <button className="btn-icon">
              <Bell size={20} />
            </button>
            
            <button className="btn-icon">
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <StatsPanel stats={stats} />
      
      {/* Main Content */}
      <div className="dashboard-content">
        {/* Filters Sidebar */}
        <FilterPanel 
          filters={filters} 
          setFilters={setFilters}
          stats={stats}
        />
        
        {/* Opportunities Grid */}
        <div className="opportunities-section">
          {/* Search and Actions Bar */}
          <div className="actions-bar">
            <div className="search-box">
              <Search size={20} />
              <input
                id="search-input"
                type="text"
                placeholder="Search opportunities... (Ctrl+/)"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            
            <div className="sort-controls">
              <label>Sort by:</label>
              <select 
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              >
                <option value="score">Score</option>
                <option value="recent">Recent</option>
                <option value="engagement">Engagement</option>
              </select>
            </div>
            
            {selectedCount > 0 && (
              <div className="bulk-actions">
                <span>{selectedCount} selected</span>
                <button onClick={() => handleBulkAction('review')}>
                  Mark Reviewed
                </button>
                <button onClick={() => handleBulkAction('archive')}>
                  Archive
                </button>
              </div>
            )}
          </div>
          
          {/* Real-time Updates */}
          <RealTimeUpdates messages={messages} />
          
          {/* Opportunities Grid */}
          <div className="opportunities-grid">
            {loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <p>Discovering opportunities...</p>
              </div>
            ) : filteredOpportunities.length === 0 ? (
              <div className="empty-state">
                <TrendingUp size={48} className="empty-icon" />
                <h3>No opportunities found</h3>
                <p>Try adjusting your filters or check back later</p>
              </div>
            ) : (
              <>
                {filteredOpportunities.map(opp => (
                  <OpportunityCard
                    key={opp._id}
                    opportunity={opp}
                    onStatusUpdate={handleStatusUpdate}
                    isSelected={selectedOps.has(opp._id)}
                    onSelect={(id) => {
                      setSelectedOps(prev => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                  />
                ))}
                
                {hasMore && (
                  <div className="load-more" ref={loadMore}>
                    <div className="spinner-small" />
                    Loading more...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          opportunities={opportunities}
          selectedIds={Array.from(selectedOps)}
          onClose={() => setShowExport(false)}
        />
      )}

      <style jsx>{`
        .dashboard {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .dashboard-header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          max-width: 1600px;
          margin: 0 auto;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .logo-icon {
          color: #667eea;
        }

        .logo-section h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .logo-section p {
          font-size: 0.875rem;
          color: #6b7280;
          margin: 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .btn-refresh, .btn-export {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-refresh {
          background: #f3f4f6;
        }

        .btn-export {
          background: #667eea;
          color: white;
        }

        .btn-icon {
          padding: 0.5rem;
          border: none;
          background: none;
          cursor: pointer;
          color: #6b7280;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border-radius: 20px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-dot.connected {
          background: #10b981;
          animation: pulse 2s infinite;
        }

        .status-dot.disconnected {
          background: #ef4444;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .dashboard-content {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 2rem;
          max-width: 1600px;
          margin: 0 auto;
          padding: 2rem;
        }

        .opportunities-section {
          background: white;
          border-radius: 16px;
          padding: 1.5rem;
          min-height: 600px;
        }

        .actions-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          align-items: center;
        }

        .search-box {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .search-box input {
          flex: 1;
          border: none;
          background: none;
          outline: none;
          font-size: 0.875rem;
        }

        .sort-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sort-controls select {
          padding: 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: white;
        }

        .bulk-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .opportunities-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
          gap: 1.5rem;
        }

        .loading-state, .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 4rem;
        }

        .spinner {
          width: 48px;
          height: 48px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        .spinner-small {
          width: 24px;
          height: 24px;
          border: 2px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }

        .load-more {
          grid-column: 1 / -1;
          text-align: center;
          padding: 2rem;
          color: #6b7280;
        }

        @media (max-width: 1024px) {
          .dashboard-content {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .opportunities-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}