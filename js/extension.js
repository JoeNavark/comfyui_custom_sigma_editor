import { app } from "../../scripts/app.js";

// --- Centripetal Catmull-Rom Spline Implementation ---
function centripetalCatmullRomSpline(points, numSamples = 100) {
    const n = points.length;
    if (n < 2) return points.map(p => [p.x, p.y]);
    const out = [];
    const pts = [
        points[0],
        ...points,
        points[points.length - 1]
    ];
    function tj(ti, pi, pj) {
        const dx = pj.x - pi.x, dy = pj.y - pi.y;
        return ti + Math.sqrt(Math.hypot(dx, dy));
    }
    for (let i = 1; i < pts.length - 2; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
        const t0 = 0;
        const t1 = tj(t0, p0, p1);
        const t2 = tj(t1, p1, p2);
        const t3 = tj(t2, p2, p3);
        for (let j = 0; j < numSamples; j++) {
            const t = t1 + (t2 - t1) * (j / numSamples);
            function lerp(pa, pb, ta, tb) {
                if (tb - ta === 0) return { x: pa.x, y: pa.y };
                const ratio = (t - ta) / (tb - ta);
                return {
                    x: pa.x + (pb.x - pa.x) * ratio,
                    y: pa.y + (pb.y - pa.y) * ratio
                };
            }
            const A1 = lerp(p0, p1, t0, t1);
            const A2 = lerp(p1, p2, t1, t2);
            const A3 = lerp(p2, p3, t2, t3);
            const B1 = lerp(A1, A2, t0, t2);
            const B2 = lerp(A2, A3, t1, t3);
            const C = lerp(B1, B2, t1, t2);
            out.push([
                Math.max(0, Math.min(1, C.x)),
                Math.max(0, Math.min(1, C.y))
            ]);
        }
    }
    out.push([points[points.length - 1].x, points[points.length - 1].y]);
    return out;
}

// --- Node Implementation ---
class CustomGraphNode {
    // No constructor! All node setup is done in onNodeCreated

    onNodeCreated() {
        // Node size
        if (!this.size) this.size = [340, 260];

        // --- Graph area config (proportions only) ---
        this.graph_area_height_frac = 0.7;
        this.graph_side_margin = 25;
        this.graph_bottom_margin = 20;

        // --- Widget for curve data ---
        // Always add the visible, enabled curve_data widget if missing
        if (!this.widgets) this.widgets = [];
        if (!this.widgets.find(w => w.name === "curve_data")) {
            this.addWidget(
                "string",
                "curve_data",
                "",
                null,
                { multiline: false, disabled: false }
            );
        }

        // --- Control points and state ---
        if (!this.points || !Array.isArray(this.points)) {
            this.points = [
                { x: 0, y: 1 },
                { x: 1, y: 0 }
            ];
        }
        this.dragState = null;
        this.smoothedPoints = null;
        this.hitRadius = 0.05;

        this._ensureValidPoints();
        this.updateCurve();
        this._updateCurveWidget();
    }

    // Now calcGraphArea uses current this.size every time it's called
    calcGraphArea() {
        this.graph_area_top = Math.round(this.size[1] * (1 - this.graph_area_height_frac));
        this.graph_area_height = Math.round(this.size[1] * this.graph_area_height_frac) - this.graph_bottom_margin;
        this.graph_area_width = this.size[0] - this.graph_side_margin * 2;
        this.graph_area_left = this.graph_side_margin;
    }

    _ensureValidPoints() {
        if (!Array.isArray(this.points) || this.points.length < 2) {
            this.points = [
                { x: 0, y: 1 },
                { x: 1, y: 0 }
            ];
        }
        this.points = this.points
            .map(p => ({
                x: Math.max(0, Math.min(1, p.x)),
                y: Math.max(0, Math.min(1, p.y))
            }))
            .sort((a, b) => a.x - b.x);
        this.points = this.points.filter((pt, idx, arr) =>
            idx === 0 || pt.x !== arr[idx - 1].x
        );
        this.points[0].x = 0;
        this.points[this.points.length - 1].x = 1;
        if (this.points.length < 2) {
            this.points = [
                { x: 0, y: 1 },
                { x: 1, y: 0 }
            ];
        }
    }

    // --- Coordinate transforms for the graph area only ---
    toScreenCoords(point) {
        this.calcGraphArea(); // <<<< recalc on every call for resizing
        return [
            this.graph_area_left + point.x * this.graph_area_width,
            this.graph_area_top + (1 - point.y) * this.graph_area_height
        ];
    }

    toGraphCoords(pos) {
        this.calcGraphArea(); // <<<< recalc on every call for resizing
        return {
            x: Math.max(0, Math.min(1, (pos[0] - this.graph_area_left) / this.graph_area_width)),
            y: Math.max(0, Math.min(1, 1 - (pos[1] - this.graph_area_top) / this.graph_area_height))
        };
    }

    onDrawForeground(ctx) {
        this.calcGraphArea(); // <<<< recalc on every draw for resizing
        this._ensureValidPoints();
        this.updateCurve();

        // --- White background for the graph area ---
        ctx.fillStyle = "#fff";
        ctx.fillRect(
            this.graph_area_left,
            this.graph_area_top,
            this.graph_area_width,
            this.graph_area_height
        );

        // --- Draw grid ---
        ctx.strokeStyle = "#eee";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0.25; i < 1; i += 0.25) {
            // Vertical grid lines
            let x = this.graph_area_left + i * this.graph_area_width;
            ctx.moveTo(x, this.graph_area_top);
            ctx.lineTo(x, this.graph_area_top + this.graph_area_height);
            // Horizontal grid lines
            let y = this.graph_area_top + i * this.graph_area_height;
            ctx.moveTo(this.graph_area_left, y);
            ctx.lineTo(this.graph_area_left + this.graph_area_width, y);
        }
        ctx.stroke();

        // --- Draw axes ---
        ctx.strokeStyle = "#aaa";
        ctx.beginPath();
        // X axis (bottom)
        ctx.moveTo(this.graph_area_left, this.graph_area_top + this.graph_area_height);
        ctx.lineTo(this.graph_area_left + this.graph_area_width, this.graph_area_top + this.graph_area_height);
        // Y axis (left)
        ctx.moveTo(this.graph_area_left, this.graph_area_top + this.graph_area_height);
        ctx.lineTo(this.graph_area_left, this.graph_area_top);
        ctx.stroke();

        // --- Draw the spline curve ---
        if (this.smoothedPoints && this.smoothedPoints.length > 1) {
            ctx.strokeStyle = "#3366FF";
            ctx.lineWidth = 2;
            ctx.beginPath();
            let start = this.toScreenCoords({ x: this.smoothedPoints[0][0], y: this.smoothedPoints[0][1] });
            ctx.moveTo(start[0], start[1]);
            for (let i = 1; i < this.smoothedPoints.length; i++) {
                let p = this.toScreenCoords({ x: this.smoothedPoints[i][0], y: this.smoothedPoints[i][1] });
                ctx.lineTo(p[0], p[1]);
            }
            ctx.stroke();
        }

        // --- Draw control polygon ---
        ctx.strokeStyle = "#FF8888";
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (this.points.length > 1) {
            let first = this.toScreenCoords(this.points[0]);
            ctx.moveTo(first[0], first[1]);
            for (let i = 1; i < this.points.length; i++) {
                let pt = this.toScreenCoords(this.points[i]);
                ctx.lineTo(pt[0], pt[1]);
            }
        }
        ctx.stroke();

        // --- Draw points ---
        ctx.fillStyle = "#FF5555";
        for (const point of this.points) {
            const [x, y] = this.toScreenCoords(point);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#880000";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        // --- Draw user instruction just below the graph area ---
        ctx.fillStyle = "#222";
        ctx.font = "11px sans-serif";
        ctx.fillText(
            "Shift+Click to delete point",
            this.graph_area_left + 5,
            this.graph_area_top + this.graph_area_height + 16
        );
    }

    updateCurve() {
        this._ensureValidPoints();
        this.smoothedPoints = centripetalCatmullRomSpline(this.points, 100);
        this._updateCurveWidget();
    }

    _updateCurveWidget() {
        if (!this.widgets) return;
        const widget = this.widgets.find(w => w.name === "curve_data");
        if (widget) {
            const newValue = JSON.stringify({
                control_points: this.points,
                samples: this.smoothedPoints
            });
            if (widget.value !== newValue) {
                widget.value = newValue;
                // Notify ComfyUI that this input has changed
                if (this.setDirtyCanvas) this.setDirtyCanvas(true, true);
                if (app && app.graph) app.graph.change();
            }
        }
    }

    onMouseDown(e, pos) {
        this.calcGraphArea();
        // --- Only allow interaction inside the graph area ---
        if (
            pos[0] < this.graph_area_left ||
            pos[0] > this.graph_area_left + this.graph_area_width ||
            pos[1] < this.graph_area_top ||
            pos[1] > this.graph_area_top + this.graph_area_height
        )
            return false;
        const graphPos = this.toGraphCoords(pos);
        const pointIndex = this.points.findIndex(p =>
            Math.hypot(p.x - graphPos.x, p.y - graphPos.y) < this.hitRadius
        );
        if (pointIndex >= 0) {
            // Delete if Shift+Left click, else drag
            if (e.button === 0 && e.shiftKey) {
                if (this.points.length > 2) {
                    this.points.splice(pointIndex, 1);
                    this.updateCurve();
                    app.graph.change();
                    this.setDirtyCanvas(true, true);
                }
                return true;
            } else if (e.button === 0) {
                this.dragState = {
                    index: pointIndex,
                    offsetX: graphPos.x - this.points[pointIndex].x,
                    offsetY: graphPos.y - this.points[pointIndex].y
                };
                app.graph.change();
                this.setDirtyCanvas(true, true);
                return true;
            }
        }
        if (e.button === 0) {
            let newX = Math.max(0, Math.min(1, graphPos.x));
            if (this.points.some(p => Math.abs(p.x - newX) < 1e-4)) return false;
            let newY = Math.max(0, Math.min(1, graphPos.y));
            this.points.push({ x: newX, y: newY });
            this.updateCurve();
            app.graph.change();
            this.setDirtyCanvas(true, true);
            return true;
        }
        return false;
    }

    onMouseMove(e, pos) {
        if (!this.dragState) return false;
        this.calcGraphArea();
        // --- Only allow interaction inside the graph area ---
        if (
            pos[0] < this.graph_area_left ||
            pos[0] > this.graph_area_left + this.graph_area_width ||
            pos[1] < this.graph_area_top ||
            pos[1] > this.graph_area_top + this.graph_area_height
        )
            return false;
        const graphPos = this.toGraphCoords(pos);
        let newX = Math.max(0, Math.min(1, graphPos.x - this.dragState.offsetX));
        let newY = Math.max(0, Math.min(1, graphPos.y - this.dragState.offsetY));
        const i = this.dragState.index;
        if (i === 0) newX = 0;
        else if (i === this.points.length - 1) newX = 1;
        else {
            if (i > 0) newX = Math.max(this.points[i - 1].x + 1e-3, newX);
            if (i < this.points.length - 1) newX = Math.min(this.points[i + 1].x - 1e-3, newX);
        }
        this.points[i] = { x: newX, y: newY };
        this.updateCurve();
        this.setDirtyCanvas(true, true);
        return true;
    }

    onMouseUp() {
        if (this.dragState) {
            this.dragState = null;
            app.graph.change();
            return true;
        }
        return false;
    }

    onExecute() {
        this.updateCurve();
    }

    onExecuted(data) {}
}

app.registerExtension({
    name: "InteractiveCentripetalCatmullRomGraph",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "CustomSplineSigma") {
            const instance = new CustomGraphNode();
            Object.getOwnPropertyNames(Object.getPrototypeOf(instance))
                .filter(prop => prop !== 'constructor')
                .forEach(method => {
                    nodeType.prototype[method] = instance[method];
                });
            Object.assign(nodeType.prototype, {
                hitRadius: instance.hitRadius
            });

            // Make sure onNodeCreated is called for each node instance
            const oldOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (oldOnNodeCreated) oldOnNodeCreated.call(this);
                instance.onNodeCreated.call(this);
            };
        }
    }
});