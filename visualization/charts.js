/**
 * Hiroto AI Terminal — Chart.js Visualizations Controller
 */

export const ChartManager = {
    radarChart: null,
    contributionChart: null,

    /**
     * Initialize or update the model observatory Radar chart
     */
    renderRadar(canvasId, labels, data) {
        const el = document.getElementById(canvasId);
        if (!el || !window.Chart) return;
        
        const ctx = el.getContext('2d');
        if (!ctx) return;

        if (this.radarChart) {
            this.radarChart.data.labels = labels.map(l => l.replace(/_/g, ' ').toUpperCase());
            this.radarChart.data.datasets[0].data = data;
            this.radarChart.update();
            return;
        }

        this.radarChart = new window.Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels.map(l => l.replace(/_/g, ' ').toUpperCase()),
                datasets: [{
                    label: 'Engine Contribution Score',
                    data: data,
                    backgroundColor: 'rgba(0, 191, 255, 0.12)',
                    borderColor: 'rgba(0, 191, 255, 0.75)',
                    borderWidth: 1.5,
                    pointBackgroundColor: '#00bfff',
                    pointBorderColor: '#ffffff',
                    pointRadius: 2.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(255, 255, 255, 0.06)' },
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        pointLabels: {
                            color: '#8892b0',
                            font: { family: 'Share Tech Mono', size: 9 }
                        },
                        ticks: {
                            display: false,
                            backdropColor: 'transparent'
                        },
                        suggestedMin: 0,
                        suggestedMax: 1.5
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    },

    /**
     * Render linear model performance bar chart
     */
    renderContribution(canvasId, labels, data) {
        const el = document.getElementById(canvasId);
        if (!el || !window.Chart) return;
        
        const ctx = el.getContext('2d');
        if (!ctx) return;

        if (this.contributionChart) {
            this.contributionChart.data.labels = labels.map(l => l.replace(/_/g, ' ').toUpperCase());
            this.contributionChart.data.datasets[0].data = data;
            this.contributionChart.update();
            return;
        }

        this.contributionChart = new window.Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(l => l.slice(0, 6).toUpperCase()),
                datasets: [{
                    data: data,
                    backgroundColor: 'rgba(0, 191, 255, 0.25)',
                    borderColor: 'rgba(0, 191, 255, 0.85)',
                    borderWidth: 1,
                    borderRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8892b0', font: { family: 'Share Tech Mono', size: 8 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#8892b0', font: { family: 'Share Tech Mono', size: 8 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
};
