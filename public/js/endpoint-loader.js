/**
 * Dynamic Endpoint Loader
 * Loads API endpoints from database instead of hardcoded values
 */

class EndpointLoader {
  constructor() {
    this.endpoints = [];
    this.categories = [];
    this.loading = false;
    this.cache = null;
    this.cacheTimestamp = 0;
    this.CACHE_DURATION = 0; // No cache for real-time updates
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.containerSelector = null; // Store container selector for re-rendering
  }

  /**
   * Load all endpoints from database
   */
  async loadEndpoints(forceRefresh = false) {
    // Check cache
    const currentTime = Date.now();
    if (!forceRefresh && this.cache && (currentTime - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('📦 Using cached endpoints');
      return this.cache;
    }

    if (this.loading) {
      console.log('⏳ Already loading endpoints...');
      return this.cache;
    }

    this.loading = true;

    try {
      console.log('🔄 Loading endpoints from database...');

      // Fetch endpoints from database
      const response = await fetch('/api/endpoints?limit=1000&sortBy=priority&sortOrder=DESC');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load endpoints');
      }

      this.endpoints = data.endpoints;
      this.cache = data;
      this.cacheTimestamp = currentTime;

      console.log(`✓ Loaded ${this.endpoints.length} endpoints from database`);

      this.loading = false;
      return data;
    } catch (error) {
      console.error('✗ Failed to load endpoints:', error);
      this.loading = false;
      throw error;
    }
  }

  /**
   * Load categories from database
   */
  async loadCategories() {
    try {
      const response = await fetch('/api/endpoints/categories');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load categories');
      }

      this.categories = data.categories;
      console.log(`✓ Loaded ${this.categories.length} categories`);

      return data.categories;
    } catch (error) {
      console.error('✗ Failed to load categories:', error);
      throw error;
    }
  }

  /**
   * Get endpoints by category
   */
  getEndpointsByCategory(category) {
    return this.endpoints.filter(ep => ep.category === category);
  }

  /**
   * Get endpoints by status
   */
  getEndpointsByStatus(status) {
    return this.endpoints.filter(ep => ep.status === status);
  }

  /**
   * Search endpoints
   */
  searchEndpoints(query) {
    const lowerQuery = query.toLowerCase();
    return this.endpoints.filter(ep => 
      ep.name.toLowerCase().includes(lowerQuery) ||
      ep.path.toLowerCase().includes(lowerQuery) ||
      (ep.description && ep.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get endpoint statistics
   */
  async getStats() {
    try {
      const response = await fetch('/api/endpoints/stats');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load stats');
      }

      return data.stats;
    } catch (error) {
      console.error('✗ Failed to load stats:', error);
      throw error;
    }
  }

  /**
   * Render endpoints to DOM
   */
  renderEndpoints(containerSelector) {
    // Store container selector for future re-renders
    if (containerSelector) {
      this.containerSelector = containerSelector;
    }
    
    // Use stored selector if not provided
    const selector = containerSelector || this.containerSelector || '#endpointsContainer';
    
    const container = document.querySelector(selector);
    if (!container) {
      console.error('Container not found:', selector);
      return;
    }

    // Clear container
    container.innerHTML = '';

    if (this.endpoints.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 40px; color: #888;">No endpoints available</p>';
      return;
    }

    // Group by category
    const grouped = {};
    this.endpoints.forEach(ep => {
      const cat = ep.category || 'other';
      if (!grouped[cat]) {
        grouped[cat] = [];
      }
      grouped[cat].push(ep);
    });

    // Render each category
    Object.keys(grouped).sort().forEach(category => {
      const categorySection = this.renderCategorySection(category, grouped[category]);
      container.appendChild(categorySection);
    });

    console.log('✓ Rendered endpoints to DOM');
  }

  /**
   * Render category section
   */
  renderCategorySection(category, endpoints) {
    const section = document.createElement('div');
    section.className = 'category-section';
    section.innerHTML = `
      <h3 class="category-section-title">
        ${this.getCategoryDisplayName(category)}
        <span class="category-section-count">${endpoints.length}</span>
      </h3>
      <div class="endpoints-list"></div>
    `;

    const list = section.querySelector('.endpoints-list');

    endpoints.forEach((ep, index) => {
      const endpointEl = this.renderEndpoint(ep, index);
      list.appendChild(endpointEl);
    });

    return section;
  }

  /**
   * Render single endpoint
   */
  renderEndpoint(endpoint, index) {
    const div = document.createElement('div');
    div.className = 'endpoint';
    div.dataset.endpointId = endpoint.id;
    div.dataset.status = endpoint.status;

    // Status badge
    let statusBadge = '';
    if (endpoint.status === 'vip' || endpoint.status === 'premium') {
      statusBadge = `<span class="vip-badge">⭐ ${endpoint.status.toUpperCase()}</span>`;
    } else if (endpoint.status === 'disabled') {
      statusBadge = '<span class="disabled-badge">🚫 DISABLED</span>';
    } else {
      statusBadge = '<span class="free-badge">✓ FREE</span>';
    }

    div.innerHTML = `
      <div class="endpoint-header">
        <span class="endpoint-number">${index + 1}</span>
        <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
        <span class="endpoint-path">${endpoint.path}</span>
        ${statusBadge}
        <span class="expand-icon">▼</span>
      </div>
      <div class="endpoint-body" style="display: none;">
        <p class="endpoint-desc">${endpoint.description || 'No description available'}</p>
        ${this.renderParameters(endpoint.parameters)}
        ${this.renderExamples(endpoint)}
      </div>
    `;

    // Add click handler
    const header = div.querySelector('.endpoint-header');
    header.addEventListener('click', () => {
      div.classList.toggle('active');
      const body = div.querySelector('.endpoint-body');
      const icon = div.querySelector('.expand-icon');
      if (div.classList.contains('active')) {
        body.style.display = 'block';
        icon.textContent = '▲';
      } else {
        body.style.display = 'none';
        icon.textContent = '▼';
      }
    });

    return div;
  }

  /**
   * Render parameters section
   */
  renderParameters(parameters) {
    if (!parameters || parameters.length === 0) {
      return '<p class="no-params">No parameters required</p>';
    }

    let html = '<div class="params-section"><h4>Parameters:</h4><ul class="params-list">';
    parameters.forEach(param => {
      const required = param.required ? '<span class="required-badge">Required</span>' : '<span class="optional-badge">Optional</span>';
      html += `
        <li>
          <strong>${param.name}</strong> ${required}
          <br><span class="param-type">${param.type || 'string'}</span>
          ${param.description ? `<br><span class="param-desc">${param.description}</span>` : ''}
        </li>
      `;
    });
    html += '</ul></div>';
    return html;
  }

  /**
   * Render examples section
   */
  renderExamples(endpoint) {
    if (!endpoint.examples || endpoint.examples.length === 0) {
      return '';
    }

    let html = '<div class="examples-section"><h4>Examples:</h4>';
    endpoint.examples.forEach(example => {
      html += `
        <div class="example-item">
          <div class="example-request">
            <strong>Request:</strong>
            <pre><code>${this.escapeHtml(example.request || '')}</code></pre>
          </div>
          ${example.response ? `
            <div class="example-response">
              <strong>Response:</strong>
              <pre><code>${this.escapeHtml(JSON.stringify(example.response, null, 2))}</code></pre>
            </div>
          ` : ''}
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  /**
   * Get category display name
   */
  getCategoryDisplayName(category) {
    const categoryMap = {
      'social-media': '📱 Social Media',
      'tools': '🛠️ Tools & Utilities',
      'ai': '🤖 AI & Generation',
      'search': '🔍 Search & Info',
      'image': '🖼️ Image Processing',
      'entertainment': '🎬 Entertainment',
      'news': '📰 News & Media',
      'other': '📦 Other'
    };
    return categoryMap[category] || `📦 ${category}`;
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Refresh endpoints
   */
  async refresh() {
    console.log('🔄 Refreshing endpoints...');
    return await this.loadEndpoints(true);
  }

  /**
   * Connect to real-time endpoint updates via SSE
   */
  connectRealtimeUpdates() {
    if (this.eventSource) {
      console.log('⚠️  SSE already connected');
      return;
    }

    console.log('📡 Connecting to real-time endpoint updates...');

    this.eventSource = new EventSource('/sse/endpoint-updates');

    this.eventSource.onopen = () => {
      console.log('✓ Connected to real-time endpoint updates');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleRealtimeEvent(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      this.eventSource.close();
      this.eventSource = null;

      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        console.log(`Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connectRealtimeUpdates(), delay);
      } else {
        console.error('Max reconnection attempts reached. Please refresh the page.');
      }
    };
  }

  /**
   * Handle real-time events from SSE
   */
  async handleRealtimeEvent(event) {
    console.log('📢 Real-time event received:', event);

    switch (event.type) {
      case 'connected':
        console.log('✓', event.message);
        break;

      case 'endpoint_change':
        await this.handleEndpointChange(event);
        break;

      case 'endpoint_bulk_change':
        await this.handleBulkChange(event);
        break;

      case 'endpoint_sync_complete':
        await this.handleSyncComplete(event);
        break;

      default:
        console.log('Unknown event type:', event.type);
    }
  }

  /**
   * Handle individual endpoint change
   */
  async handleEndpointChange(event) {
    const { action, data } = event;
    
    console.log(`🔄 Endpoint ${action}:`, data.path);

    // Invalidate cache and reload
    this.cache = null;
    await this.loadEndpoints(true);

    // Re-render with stored container selector
    if (typeof this.renderEndpoints === 'function') {
      this.renderEndpoints(); // Will use stored containerSelector
    }

    // Show notification
    this.showNotification(`Endpoint ${action}: ${data.name || data.path}`, 'info');
  }

  /**
   * Handle bulk endpoint changes
   */
  async handleBulkChange(event) {
    const { action, count } = event;
    
    console.log(`🔄 Bulk ${action}: ${count} endpoints`);

    // Invalidate cache and reload
    this.cache = null;
    await this.loadEndpoints(true);

    // Re-render with stored container selector
    if (typeof this.renderEndpoints === 'function') {
      this.renderEndpoints(); // Will use stored containerSelector
    }

    // Show notification
    this.showNotification(`${count} endpoints updated`, 'info');
  }

  /**
   * Handle sync completion
   */
  async handleSyncComplete(event) {
    const { stats } = event;
    
    console.log('🔄 Sync complete:', stats);

    // Invalidate cache and reload
    this.cache = null;
    await this.loadEndpoints(true);

    // Re-render with stored container selector
    if (typeof this.renderEndpoints === 'function') {
      this.renderEndpoints(); // Will use stored containerSelector
    }

    // Show notification
    this.showNotification(`Sync complete: ${stats.total} endpoints`, 'success');
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `endpoint-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Disconnect from SSE
   */
  disconnectRealtimeUpdates() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('Disconnected from real-time updates');
    }
  }
}

// Create global instance
window.endpointLoader = new EndpointLoader();

// Auto-load on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await window.endpointLoader.loadEndpoints();
      await window.endpointLoader.loadCategories();
      console.log('✓ Endpoints loaded successfully');
      
      // Connect to real-time updates
      window.endpointLoader.connectRealtimeUpdates();
    } catch (error) {
      console.error('✗ Failed to auto-load endpoints:', error);
    }
  });
} else {
  // DOM already loaded
  (async () => {
    try {
      await window.endpointLoader.loadEndpoints();
      await window.endpointLoader.loadCategories();
      console.log('✓ Endpoints loaded successfully');
      
      // Connect to real-time updates
      window.endpointLoader.connectRealtimeUpdates();
    } catch (error) {
      console.error('✗ Failed to auto-load endpoints:', error);
    }
  })();
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
