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
    this.CACHE_DURATION = 60000; // 1 minute cache
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
    const container = document.querySelector(containerSelector);
    if (!container) {
      console.error('Container not found:', containerSelector);
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
    } catch (error) {
      console.error('✗ Failed to auto-load endpoints:', error);
    }
  })();
}
