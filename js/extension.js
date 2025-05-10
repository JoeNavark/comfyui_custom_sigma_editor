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

// --- Curve Generator Functions ---
function generateSimpleCurve(numPoints = 10) {
    return Array.from({length: numPoints}, (_, i) => {
        const t = i / (numPoints - 1);
        return {
            x: t,
            y: 1.0 - t
        };
    });
}

function generateKarrasCurve(numPoints = 10) {
    const sigma_min = 0.1;
    const sigma_max = 10.0;
    const rho = 7.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const t = 1.0 - (i / (numPoints - 1));
        const sigma = sigma_max * Math.pow(sigma_min/sigma_max, t * rho);
        const normalized = 1.0 - Math.min(1.0, Math.max(0.0, 
            (sigma - sigma_min) / (sigma_max - sigma_min)));
        
        return {
            x: i / (numPoints - 1),
            y: normalized
        };
    });
}

function generateExponentialCurve(numPoints = 10) {
    const sigma_min = 0.1;
    const sigma_max = 10.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const t = 1.0 - (i / (numPoints - 1));
        const sigma = Math.pow(sigma_min, 1-t) * Math.pow(sigma_max, t);
        const normalized = Math.min(1.0, Math.max(0.0, 
            (sigma - sigma_min) / (sigma_max - sigma_min)));
        
        return {
            x: i / (numPoints - 1),
            y: normalized
        };
    });
}

function generateVPCurve(numPoints = 10) {
    const beta_d = 19.9;
    const beta_min = 0.1;
    const beta_max = 20.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const t = 1.0 - (i / (numPoints - 1));
        const beta = beta_min + t * (beta_max - beta_min);
        const alpha = Math.exp(-beta);
        const alpha_cumprod = Math.exp(-(beta + 0.5 * t * t * beta_d));
        const sigma = Math.sqrt((1 - alpha_cumprod) / alpha_cumprod);
        const max_sigma = 10.0;
        const normalized = Math.min(1.0, sigma / max_sigma);
        
        return {
            x: i / (numPoints - 1),
            y: normalized
        };
    });
}

function generateVECurve(numPoints = 10) {
    const sigma_min = 0.02;
    const sigma_max = 100.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const x_pos = i / (numPoints - 1);
        const t = x_pos;
        const sigma = Math.pow(sigma_min, t) * Math.pow(sigma_max, 1-t);
        const normalized = 1.0 - Math.min(1.0, Math.max(0.0, 
            (sigma - sigma_min) / (sigma_max - sigma_min)));
        
        return {
            x: x_pos,
            y: normalized
        };
    });
}

function generateLinearCurve(numPoints = 10) {
    const sigma_min = 0.1;
    const sigma_max = 10.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const t = 1.0 - (i / (numPoints - 1));
        const sigma = sigma_min + t * (sigma_max - sigma_min);
        const normalized = Math.min(1.0, sigma / sigma_max);
        
        return {
            x: i / (numPoints - 1),
            y: normalized
        };
    });
}

function generatePolyexponentialCurve(numPoints = 10) {
    const sigma_min = 0.1;
    const sigma_max = 10.0;
    const rho = 3.0;
    
    return Array.from({length: numPoints}, (_, i) => {
        const t = 1.0 - (i / (numPoints - 1));
        const sigma = sigma_min + (sigma_max - sigma_min) * (t ** (1.0 / rho));
        const normalized = Math.min(1.0, sigma / sigma_max);
        
        return {
            x: i / (numPoints - 1),
            y: normalized
        };
    });
}

function generateDPMSolverFastCurve(numPoints = 10) {
    return Array.from({length: numPoints}, (_, i) => {
        const t = i / (numPoints - 1);
        let noise_level;
        
        if (t < 0.5) {
            noise_level = 1.0 - 0.75 * (2 * t);
        } else {
            noise_level = 0.25 * (2.0 - 2 * t);
        }
        
        return {
            x: t,
            y: noise_level
        };
    });
}

// --- Node Implementation ---
class CustomGraphNode {
    onNodeCreated() {
        if (!this.size) this.size = [340, 260];

        // --- Graph area margins ---
        this.graph_side_margin = 25;
        this.graph_bottom_margin = 20;

        // --- Widget for curve data ---
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

        // Add preset selector widget
        if (!this.widgets.find(w => w.name === "preset_selector")) {
            this.addWidget("combo", "preset_selector", "Simple", (value) => {
                if (value === "Custom") return;
                
                // Apply the selected preset
                switch(value) {
                    case "Simple":
                        this.points = generateSimpleCurve(10);
                        break;
                    case "Karras":
                        this.points = generateKarrasCurve(10);
                        break;
                    case "Exponential":
                        this.points = generateExponentialCurve(10);
                        break;
                    case "VP":
                        this.points = generateVPCurve(10);
                        break;
                    case "VE":
                        this.points = generateVECurve(10);
                        break;
                    case "Linear":
                        this.points = generateLinearCurve(10);
                        break;
                    case "Polyexponential":
                        this.points = generatePolyexponentialCurve(10);
                        break;
                    case "DPM-Solver-Fast":
                        this.points = generateDPMSolverFastCurve(10);
                        break;
                    default:
                        return;
                }
                
                // Store the last selected preset for potential reset
                this.lastSelectedPreset = value;
                
                // Update the curve and curve_data widget
                this._ensureValidPoints();
                this.updateCurve();
                
                this.setDirtyCanvas(true, true);
                app.graph.change();
            }, {
                values: ["Simple", "Karras", "Exponential", "VP", "VE", "Linear", 
                        "Polyexponential", "DPM-Solver-Fast", "Custom"]
            });
        }

        // --- Try to load points from the widget value (JSON) ---
        const widget = this.widgets.find(w => w.name === "curve_data");
        let loaded = false;
        if (widget && widget.value) {
            try {
                const data = JSON.parse(widget.value);
                if (data && Array.isArray(data.control_points) && data.control_points.length >= 2) {
                    this.points = data.control_points.map(pt => ({
                        x: Number(pt.x),
                        y: Number(pt.y)
                    }));
                    loaded = true;
                } else if (data && Array.isArray(data.samples) && data.samples.length >= 2) {
                    // Use endpoints as fallback
                    this.points = [
                        {x: Number(data.samples[0][0]), y: Number(data.samples[0][1])},
                        {x: Number(data.samples[data.samples.length-1][0]), y: Number(data.samples[data.samples.length-1][1])}
                    ];
                    loaded = true;
                }
            } catch (e) {
                // ignore parse error, will use default points below
            }
        }
        if (!loaded) {
            if (!this.points || !Array.isArray(this.points)) {
                this.points = [
                    { x: 0, y: 1 },
                    { x: 1, y: 0 }
                ];
            }
        }

        // --- React to widget value changes ---
        if (widget) {
            widget.callback = (value) => {
                let loaded = false;
                if (value) {
                    try {
                        const data = JSON.parse(value);
                        if (data && Array.isArray(data.control_points) && data.control_points.length >= 2) {
                            this.points = data.control_points.map(pt => ({
                                x: Number(pt.x),
                                y: Number(pt.y)
                            }));
                            loaded = true;
                        } else if (data && Array.isArray(data.samples) && data.samples.length >= 2) {
                            this.points = [
                                {x: Number(data.samples[0][0]), y: Number(data.samples[0][1])},
                                {x: Number(data.samples[data.samples.length-1][0]), y: Number(data.samples[data.samples.length-1][1])}
                            ];
                            loaded = true;
                        }
                    } catch (e) {}
                }
                if (!loaded) {
                    this.points = [
                        { x: 0, y: 1 },
                        { x: 1, y: 0 }
                    ];
                }
                this.updateCurve();
                this.setDirtyCanvas(true, true);
            };
        }

        this.dragState = null;
        this.smoothedPoints = null;
        this.hitRadius = 0.05;

        this._ensureValidPoints();
        this.updateCurve();
        this._updateCurveWidget();
    }

    calcGraphArea() {
        // Calculate the exact position where widgets end
        let widgets_bottom = 10; // Space for node title
        
        if (this.widgets && this.widgets.length) {
            this.widgets.forEach(w => {
                let widget_height = 30; // Default height
                
                if (w.type === "combo") widget_height = 30;
                else if (w.type === "number") widget_height = 30;
                else if (w.type === "string" && w.options && w.options.multiline) {
                    widget_height = 80; 
                }
                else if (w.type === "string") widget_height = 30;
                
                widgets_bottom += widget_height;
            });
            
            widgets_bottom += 10; 
        }
        
        // Reduced from 20px to 5px for less spacing
        const extra_clearance = 5;
        this.graph_area_top = widgets_bottom + extra_clearance;
        
        // Calculate available space for graph
        this.graph_area_height = this.size[1] - this.graph_area_top - this.graph_bottom_margin;
        this.graph_area_width = this.size[0] - this.graph_side_margin * 2;
        this.graph_area_left = this.graph_side_margin;
        
        // Ensure minimum graph height
        const min_graph_height = 10;
        if (this.graph_area_height < min_graph_height) {
            const additional_height = min_graph_height - this.graph_area_height;
            this.size[1] += additional_height;
            this.graph_area_height = min_graph_height;
            
            if (this.setSize) {
                this.setSize(this.size);
            }
        }
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

    // --- Coordinate transforms for the graph area ---
    toScreenCoords(point) {
        this.calcGraphArea();
        return [
            this.graph_area_left + point.x * this.graph_area_width,
            this.graph_area_top + (1 - point.y) * this.graph_area_height
        ];
    }

    toGraphCoords(pos) {
        this.calcGraphArea();
        return {
            x: Math.max(0, Math.min(1, (pos[0] - this.graph_area_left) / this.graph_area_width)),
            y: Math.max(0, Math.min(1, 1 - (pos[1] - this.graph_area_top) / this.graph_area_height))
        };
    }

    onDrawForeground(ctx) {
        this.calcGraphArea();
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
                    this._setPresetToCustom();
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
            this._setPresetToCustom();
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
        
        this._setPresetToCustom();
        
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

    onConfigure(info) {
        if (info.curve_state && Array.isArray(info.curve_state)) {
            try {
                this.points = info.curve_state.map(pt => ({
                    x: Number(pt.x),
                    y: Number(pt.y)
                }));
                this._ensureValidPoints();
                this.updateCurve();
            } catch (e) {
                console.error("Failed to load curve state:", e);
            }
        }
    }

    onSerialize(info) {
        info.curve_state = this.points;
    }
    
    _setPresetToCustom() {
        const presetWidget = this.widgets.find(w => w.name === "preset_selector");
        if (presetWidget && presetWidget.value !== "Custom") {
            presetWidget.value = "Custom";
            if (this.onWidgetChanged) {
                this.onWidgetChanged(presetWidget.name, presetWidget.value, presetWidget.last_value);
            }
        }
    }
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

            const oldOnNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (oldOnNodeCreated) oldOnNodeCreated.call(this);
                instance.onNodeCreated.call(this);
            };
        }
    }
});