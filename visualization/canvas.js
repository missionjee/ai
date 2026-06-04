/**
 * Hiroto AI Terminal — Background Neural Web Canvas & Particle System
 */

export class NeuralCanvas {
    constructor() {
        this.canvas = document.getElementById('neuralCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.nodes = [];
        this.initNodes();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initNodes() {
        const count = Math.floor((this.canvas.width * this.canvas.height) / 20000);
        this.nodes = [];
        for (let i = 0; i < count; i++) {
            this.nodes.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 2 + 0.8,
                opacity: Math.random() * 0.35 + 0.15
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid overlay lines directly on canvas for background matrix depth
        this.drawDepthGrid();

        // Update positions
        this.nodes.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;
            if (n.x < 0 || n.x > this.canvas.width) n.vx *= -1;
            if (n.y < 0 || n.y > this.canvas.height) n.vy *= -1;
        });

        // Draw connections
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const dx = this.nodes[i].x - this.nodes[j].x;
                const dy = this.nodes[i].y - this.nodes[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    const alpha = (1.0 - dist / 120) * 0.08;
                    this.ctx.strokeStyle = `rgba(0, 191, 255, ${alpha})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.nodes[i].x, this.nodes[i].y);
                    this.ctx.lineTo(this.nodes[j].x, this.nodes[j].y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw nodes
        this.nodes.forEach(n => {
            this.ctx.fillStyle = `rgba(0, 191, 255, ${n.opacity})`;
            this.ctx.beginPath();
            this.ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });

        requestAnimationFrame(() => this.animate());
    }

    drawDepthGrid() {
        const step = 60;
        this.ctx.strokeStyle = 'rgba(0, 191, 255, 0.02)';
        this.ctx.lineWidth = 0.5;
        
        // Vertical grid lines
        for (let x = 0; x < this.canvas.width; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let y = 0; y < this.canvas.height; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
}
