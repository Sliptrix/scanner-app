/**
 * LONEWOLF BIOTECH - Chart Renderer
 * Phase 5: CSS-based Chart Visualizations
 * 
 * Provides chart rendering without external dependencies:
 * - Bar charts
 * - Pie/Donut charts
 * - Line charts (simplified)
 * - Activity heatmaps
 * - Trend indicators
 */

window.ChartRenderer = (function() {
    'use strict';

    // Color palette for charts
    const COLORS = {
        primary: ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'],
        secondary: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
        accent: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95'],
        warning: ['#f59e0b', '#d97706', '#b45309', '#92400e', '#78350f'],
        danger: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'],
        neutral: ['#64748b', '#475569', '#334155', '#1e293b', '#0f172a'],
        
        // Full palette for multi-series
        palette: [
            '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
            '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
        ]
    };

    /**
     * Render a bar chart
     * @param {HTMLElement|string} container - Container element or ID
     * @param {Object} data - { labels: [], values: [], colors?: [] }
     * @param {Object} options - { title, horizontal, showValues, maxBars, onClick }
     */
    function renderBarChart(container, data, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const { labels = [], values = [] } = data;
        const maxValue = Math.max(...values, 1);
        const maxBars = options.maxBars || 10;
        const horizontal = options.horizontal !== false;
        const showValues = options.showValues !== false;

        // Limit to max bars
        const displayLabels = labels.slice(0, maxBars);
        const displayValues = values.slice(0, maxBars);
        const colors = data.colors || COLORS.palette;

        let html = `<div class="chart-container bar-chart ${horizontal ? 'horizontal' : 'vertical'}">`;
        
        if (options.title) {
            html += `<div class="chart-title">${options.title}</div>`;
        }

        html += '<div class="chart-body">';
        
        displayValues.forEach((value, i) => {
            const percent = (value / maxValue) * 100;
            const color = colors[i % colors.length];
            const label = displayLabels[i] || `Item ${i + 1}`;
            
            html += `
                <div class="bar-row" data-index="${i}" data-value="${value}" data-label="${label}">
                    <div class="bar-label" title="${label}">${truncateLabel(label, 15)}</div>
                    <div class="bar-track">
                        <div class="bar-fill" style="width: ${percent}%; background-color: ${color};">
                            ${showValues ? `<span class="bar-value">${formatNumber(value)}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        el.innerHTML = html;

        // Add click handlers if callback provided
        if (options.onClick) {
            el.querySelectorAll('.bar-row').forEach(row => {
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => {
                    options.onClick(row.dataset.label, parseInt(row.dataset.value), parseInt(row.dataset.index));
                });
            });
        }
    }

    /**
     * Render a pie/donut chart
     * @param {HTMLElement|string} container
     * @param {Object} data - { labels: [], values: [], colors?: [] }
     * @param {Object} options - { title, donut, showLegend, centerText, onClick }
     */
    function renderPieChart(container, data, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const { labels = [], values = [] } = data;
        const total = values.reduce((sum, v) => sum + v, 0);
        const colors = data.colors || COLORS.palette;
        const donut = options.donut !== false;

        // Build conic gradient
        let gradientStops = [];
        let currentAngle = 0;

        values.forEach((value, i) => {
            const angle = (value / total) * 360;
            const color = colors[i % colors.length];
            gradientStops.push(`${color} ${currentAngle}deg ${currentAngle + angle}deg`);
            currentAngle += angle;
        });

        const gradient = `conic-gradient(${gradientStops.join(', ')})`;

        let html = `<div class="chart-container pie-chart ${donut ? 'donut' : ''}">`;
        
        if (options.title) {
            html += `<div class="chart-title">${options.title}</div>`;
        }

        html += `
            <div class="chart-body">
                <div class="pie-wrapper">
                    <div class="pie-circle" style="background: ${gradient};">
                        ${donut ? `<div class="pie-hole">
                            <div class="pie-center-text">${options.centerText || formatNumber(total)}</div>
                            <div class="pie-center-label">${options.centerLabel || 'Total'}</div>
                        </div>` : ''}
                    </div>
                </div>
        `;

        if (options.showLegend !== false) {
            html += '<div class="pie-legend">';
            labels.forEach((label, i) => {
                const value = values[i];
                const percent = total > 0 ? Math.round((value / total) * 100) : 0;
                const color = colors[i % colors.length];
                
                html += `
                    <div class="legend-item" data-index="${i}" data-label="${label}">
                        <span class="legend-color" style="background-color: ${color};"></span>
                        <span class="legend-label">${truncateLabel(label, 12)}</span>
                        <span class="legend-value">${formatNumber(value)} (${percent}%)</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        html += '</div></div>';
        el.innerHTML = html;

        // Add click handlers
        if (options.onClick) {
            el.querySelectorAll('.legend-item').forEach(item => {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    const idx = parseInt(item.dataset.index);
                    options.onClick(item.dataset.label, values[idx], idx);
                });
            });
        }
    }

    /**
     * Render a simple line chart
     * @param {HTMLElement|string} container
     * @param {Object} data - { labels: [], values: [] }
     * @param {Object} options - { title, showDots, showArea, color }
     */
    function renderLineChart(container, data, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const { labels = [], values = [] } = data;
        
        // Handle empty data gracefully
        if (!values || values.length === 0) {
            el.innerHTML = `<div class="chart-container line-chart">
                ${options.title ? `<div class="chart-title">${options.title}</div>` : ''}
                <div class="chart-body" style="display: flex; align-items: center; justify-content: center; height: 150px; color: #94a3b8;">
                    No data available
                </div>
            </div>`;
            return;
        }
        
        const maxValue = Math.max(...values, 1);
        const minValue = Math.min(...values, 0);
        const range = maxValue - minValue || 1;
        const color = options.color || COLORS.primary[0];

        // Build SVG path
        const width = 400;
        const height = 150;
        const padding = 40;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        let pathD = '';
        let areaD = '';
        const points = [];

        values.forEach((value, i) => {
            const x = padding + (i / (values.length - 1 || 1)) * chartWidth;
            const y = height - padding - ((value - minValue) / range) * chartHeight;
            points.push({ x, y, value, label: labels[i] });
            
            if (i === 0) {
                pathD = `M ${x} ${y}`;
                areaD = `M ${padding} ${height - padding} L ${x} ${y}`;
            } else {
                pathD += ` L ${x} ${y}`;
                areaD += ` L ${x} ${y}`;
            }
        });

        areaD += ` L ${width - padding} ${height - padding} Z`;

        let html = `<div class="chart-container line-chart">`;
        
        if (options.title) {
            html += `<div class="chart-title">${options.title}</div>`;
        }

        html += `
            <div class="chart-body">
                <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg">
                    <!-- Grid lines -->
                    <g class="grid-lines">
                        ${[0, 0.25, 0.5, 0.75, 1].map(pct => {
                            const y = height - padding - pct * chartHeight;
                            const val = minValue + pct * range;
                            return `
                                <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" 
                                      stroke="#e2e8f0" stroke-width="1"/>
                                <text x="${padding - 5}" y="${y + 4}" text-anchor="end" 
                                      fill="#64748b" font-size="10">${formatNumber(val)}</text>
                            `;
                        }).join('')}
                    </g>
                    
                    <!-- Area fill -->
                    ${options.showArea !== false ? 
                        `<path d="${areaD}" fill="${color}" fill-opacity="0.1"/>` : ''}
                    
                    <!-- Line -->
                    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" 
                          stroke-linecap="round" stroke-linejoin="round"/>
                    
                    <!-- Dots -->
                    ${options.showDots !== false ? points.map(p => `
                        <circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}" stroke="white" stroke-width="2"/>
                    `).join('') : ''}
                </svg>
                
                <!-- X-axis labels -->
                <div class="line-x-labels">
                    ${labels.filter((_, i) => i % Math.ceil(labels.length / 6) === 0).map((label, i) => 
                        `<span>${truncateLabel(label, 8)}</span>`
                    ).join('')}
                </div>
            </div>
        </div>`;

        el.innerHTML = html;
    }

    /**
     * Render an activity heatmap
     * @param {HTMLElement|string} container
     * @param {Object} data - { heatmap: [][number], dayLabels: [] }
     * @param {Object} options - { title, showHourLabels }
     */
    function renderHeatmap(container, data, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const { heatmap = [], dayLabels = [] } = data;
        const maxValue = Math.max(...heatmap.flat(), 1);

        // Get intensity color
        function getColor(value) {
            if (value === 0) return '#f1f5f9';
            const intensity = value / maxValue;
            if (intensity < 0.25) return '#d1fae5';
            if (intensity < 0.5) return '#6ee7b7';
            if (intensity < 0.75) return '#10b981';
            return '#047857';
        }

        let html = `<div class="chart-container heatmap-chart">`;
        
        if (options.title) {
            html += `<div class="chart-title">${options.title}</div>`;
        }

        html += '<div class="chart-body"><div class="heatmap-grid">';

        // Hour labels (top)
        if (options.showHourLabels !== false) {
            html += '<div class="heatmap-row hour-labels"><div class="heatmap-day-label"></div>';
            for (let h = 0; h < 24; h += 3) {
                html += `<div class="heatmap-hour-label">${formatHour(h)}</div>`;
            }
            html += '</div>';
        }

        // Data rows
        dayLabels.forEach((day, dayIndex) => {
            html += `<div class="heatmap-row">`;
            html += `<div class="heatmap-day-label">${day}</div>`;
            
            for (let h = 0; h < 24; h++) {
                const value = heatmap[dayIndex]?.[h] || 0;
                html += `
                    <div class="heatmap-cell" 
                         style="background-color: ${getColor(value)};"
                         title="${day} ${formatHour(h)}: ${value} events">
                    </div>
                `;
            }
            html += '</div>';
        });

        html += '</div></div></div>';
        el.innerHTML = html;
    }

    /**
     * Render stat cards with trend indicators
     * @param {HTMLElement|string} container
     * @param {Array} stats - [{ label, value, trend?, icon?, color? }]
     * @param {Object} options - { columns }
     */
    function renderStatCards(container, stats, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const columns = options.columns || 4;

        let html = `<div class="stat-cards-grid" style="grid-template-columns: repeat(${columns}, 1fr);">`;
        
        stats.forEach(stat => {
            const trendIcon = stat.trend?.direction === 'up' ? '↑' : 
                             stat.trend?.direction === 'down' ? '↓' : '→';
            const trendClass = stat.trend?.direction || 'flat';
            const color = stat.color || COLORS.primary[0];
            
            html += `
                <div class="stat-card" style="--accent-color: ${color};">
                    ${stat.icon ? `<div class="stat-icon">${stat.icon}</div>` : ''}
                    <div class="stat-content">
                        <div class="stat-label">${stat.label}</div>
                        <div class="stat-value">${formatNumber(stat.value)}</div>
                        ${stat.trend ? `
                            <div class="stat-trend trend-${trendClass}">
                                <span class="trend-icon">${trendIcon}</span>
                                <span class="trend-value">${stat.trend.percent}%</span>
                                <span class="trend-period">vs prev period</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div>';
        el.innerHTML = html;
    }

    /**
     * Render a mini sparkline
     * @param {HTMLElement|string} container
     * @param {Array} values - number[]
     * @param {Object} options - { color, height }
     */
    function renderSparkline(container, values, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const width = 100;
        const height = options.height || 30;
        const color = options.color || COLORS.primary[0];
        
        const maxVal = Math.max(...values, 1);
        const minVal = Math.min(...values, 0);
        const range = maxVal - minVal || 1;

        let pathD = '';
        values.forEach((v, i) => {
            const x = (i / (values.length - 1 || 1)) * width;
            const y = height - ((v - minVal) / range) * height;
            pathD += (i === 0 ? 'M' : 'L') + ` ${x} ${y}`;
        });

        el.innerHTML = `
            <svg viewBox="0 0 ${width} ${height}" class="sparkline">
                <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>
            </svg>
        `;
    }

    /**
     * Render a progress ring
     * @param {HTMLElement|string} container
     * @param {number} percent - 0-100
     * @param {Object} options - { label, color, size }
     */
    function renderProgressRing(container, percent, options = {}) {
        const el = typeof container === 'string' ? document.getElementById(container) : container;
        if (!el) return;

        const size = options.size || 80;
        const strokeWidth = options.strokeWidth || 8;
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        const color = options.color || COLORS.primary[0];

        el.innerHTML = `
            <div class="progress-ring-container" style="width: ${size}px; height: ${size}px;">
                <svg viewBox="0 0 ${size} ${size}" class="progress-ring">
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}" 
                            fill="none" stroke="#e2e8f0" stroke-width="${strokeWidth}"/>
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}"
                            fill="none" stroke="${color}" stroke-width="${strokeWidth}"
                            stroke-dasharray="${circumference}" 
                            stroke-dashoffset="${offset}"
                            stroke-linecap="round"
                            transform="rotate(-90 ${size/2} ${size/2})"/>
                </svg>
                <div class="progress-ring-text">
                    <div class="progress-value">${percent}%</div>
                    ${options.label ? `<div class="progress-label">${options.label}</div>` : ''}
                </div>
            </div>
        `;
    }

    // Helper functions
    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    function formatHour(hour) {
        if (hour === 0) return '12a';
        if (hour === 12) return '12p';
        return hour < 12 ? `${hour}a` : `${hour - 12}p`;
    }

    function truncateLabel(label, maxLen) {
        if (!label) return '';
        return label.length > maxLen ? label.substring(0, maxLen - 1) + '…' : label;
    }

    // Public API
    return {
        renderBarChart,
        renderPieChart,
        renderLineChart,
        renderHeatmap,
        renderStatCards,
        renderSparkline,
        renderProgressRing,
        COLORS
    };

})();
