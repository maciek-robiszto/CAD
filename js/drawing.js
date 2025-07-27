var CADApp = CADApp || {};
CADApp.drawing = {
    draw: function() {
        const { ctx, canvas } = CADApp.ui;
        const { shapes, tempShape, selectedShape, trimSegment } = CADApp.state;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.drawGrid();
        shapes.forEach(shape => {
            const isSelected = (shape === selectedShape);
            if (shape.type === 'line' || shape.type === 'rect' || shape.type === 'circle' || shape.type === 'polygon') {
                // Ukryj tylko kształty geometryczne które są aktualnie modyfikowane
                if (tempShape && tempShape.id === shape.id && 
                    (tempShape.type === 'line' || tempShape.type === 'rect' || tempShape.type === 'circle' || tempShape.type === 'polygon')) {
                    return;
                }
                
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#0f172a';
                ctx.lineWidth = isSelected ? 3 : 2;
                if (shape.type === 'line') this.drawLine(shape);
                else if (shape.type === 'rect') this.drawRect(shape);
                else if (shape.type === 'circle') this.drawCircle(shape);
                else if (shape.type === 'polygon') this.drawPolygon(shape);
            } else if (shape.type === 'dimension') {
                // Wymiary zawsze rysuj - nigdy nie ukrywaj
                this.drawDimensionObject(shape, isSelected);
            }
        });
        if (tempShape) {
            ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
            if (tempShape.type === 'dimension') {
                this.drawDimensionObject(tempShape, true);
            } else if (tempShape.type === 'line') {
                this.drawLine(tempShape); this.drawLineLiveDimensions(tempShape.x1, tempShape.y1, tempShape.x2, tempShape.y2);
            } else if (tempShape.type === 'rect') {
                this.drawRect(tempShape);
            } else if (tempShape.type === 'circle') {
                this.drawCircle(tempShape);
            } else if (tempShape.type === 'polygon') {
                this.drawPolygon(tempShape);
            }
            ctx.setLineDash([]);
        }
        if(trimSegment) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(trimSegment.x1, trimSegment.y1);
            ctx.lineTo(trimSegment.x2, trimSegment.y2);
            ctx.stroke();
        }
    },
    drawLine: function(shape) { const { ctx } = CADApp.ui; ctx.beginPath(); ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); ctx.stroke(); },
    drawRect: function(shape) {
        const { ctx } = CADApp.ui;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    },
    drawCircle: function(shape) { 
        const { ctx } = CADApp.ui; 
        ctx.beginPath(); 
        ctx.arc(shape.cx, shape.cy, shape.r, 0, 2 * Math.PI); 
        ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.fill();
        ctx.stroke();
    },
    drawPolygon: function(shape) {
        const { ctx } = CADApp.ui;
        const { points } = shape;
        if (points.length < 3) return;

        ctx.beginPath();
        
        // Znajdź pierwszy punkt do rozpoczęcia (pierwszy punkt bez fillet lub p2 pierwszego fillet)
        let startPoint;
        if (points[0].isFillet && points[0].p2) {
            startPoint = points[0].p2;
        } else {
            startPoint = points[0];
        }
        
        ctx.moveTo(startPoint.x, startPoint.y);

        // Rysuj wszystkie segmenty
        for (let i = 0; i < points.length; i++) {
            const currentPoint = points[i];
            const nextIndex = (i + 1) % points.length;
            const nextPoint = points[nextIndex];
            
            if (nextPoint.isFillet && nextPoint.p1 && nextPoint.p2 && nextPoint.radius > 0) {
                // Następny punkt ma fillet - rysuj linię do punktu początkowego fillet
                ctx.lineTo(nextPoint.p1.x, nextPoint.p1.y);
                // Rysuj łuk fillet używając arcTo (prostsze i bardziej niezawodne)
                ctx.arcTo(nextPoint.x, nextPoint.y, nextPoint.p2.x, nextPoint.p2.y, nextPoint.radius);
            } else {
                // Następny punkt jest zwykły - rysuj linię do niego
                ctx.lineTo(nextPoint.x, nextPoint.y);
            }
        }

        ctx.closePath();
        ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
        ctx.fill();
        ctx.stroke();
    },
    drawGrid: function() { const { ctx, canvas } = CADApp.ui; const gridSize = 20; ctx.strokeStyle = '#d1d5db'; ctx.lineWidth = 0.5; for (let x = 0; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); } for (let y = 0; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }},
    drawLineLiveDimensions: function(x1, y1, x2, y2) { const { ctx } = CADApp.ui; const dx = x2 - x1, dy = y2 - y1; if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return; const length = Math.hypot(dx, dy); const midX = x1 + dx / 2, midY = y1 + dy / 2; const angle = Math.atan2(dy, dx); ctx.save(); ctx.translate(midX, midY); ctx.rotate(angle); const textOffset = (angle > 0 && angle < Math.PI) ? -15 : 25; ctx.textAlign = 'center'; ctx.font = 'bold 12px Inter'; ctx.fillStyle = '#1e293b'; ctx.textBaseline = 'bottom'; ctx.fillText(`L: ${length.toFixed(1)}`, 0, textOffset); ctx.font = '11px Inter'; ctx.fillStyle = '#4b5563'; ctx.textBaseline = 'top'; ctx.fillText(`(ΔX: ${dx.toFixed(1)}, ΔY: ${(-dy).toFixed(1)})`, 0, textOffset); ctx.restore(); },
    drawArrow: function(ctx, x1, y1, x2, y2) { 
        const headlen = 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        
        ctx.beginPath();
        // Linia główna
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        
        // Strzałka na końcu (x2, y2)
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
        
        // Strzałka na początku (x1, y1) - odwrócona
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + headlen * Math.cos(angle - Math.PI / 6), y1 + headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + headlen * Math.cos(angle + Math.PI / 6), y1 + headlen * Math.sin(angle + Math.PI / 6));
        
        ctx.stroke();
    },
    updateDimensionGeometry(dim) {
        const targetShape = CADApp.state.shapes.find(s => s.id === dim.targetId);
        if (!targetShape) return;

        let line;
        if (targetShape.type === 'line') {
            line = { p1: {x: targetShape.x1, y: targetShape.y1}, p2: {x: targetShape.x2, y: targetShape.y2} };
        } else if (targetShape.type === 'rect') {
            const v = CADApp.modification.getRectVertices(targetShape);
            line = { p1: v[dim.edgeIndex], p2: v[(dim.edgeIndex + 1) % 4] };
        } else if (targetShape.type === 'polygon') {
            const points = targetShape.points;
            line = { p1: points[dim.edgeIndex], p2: points[(dim.edgeIndex + 1) % points.length] };
        } else if (targetShape.type === 'circle') {
            const { cx, cy, r } = targetShape;
            const angle = dim.offset;
            dim.extP1x = cx; dim.extP1y = cy;
            dim.extP2x = cx + r * Math.cos(angle); dim.extP2y = cy + r * Math.sin(angle);
            dim.p1x = dim.extP1x; dim.p1y = dim.extP1y;
            dim.p2x = dim.extP2x; dim.p2y = dim.extP2y;
            dim.text = `R ${r.toFixed(1)}`;
        }
        
        if(line) {
            const { p1, p2 } = line;
            const { dimType, offset } = dim;
            if (dimType === 'horizontal') {
                dim.p1x = p1.x; dim.p2x = p2.x; dim.p1y = dim.p2y = offset;
                dim.extP1x = p1.x; dim.extP1y = p1.y; dim.extP2x = p2.x; dim.extP2y = p2.y;
                dim.text = `${Math.abs(p1.x - p2.x).toFixed(1)}`;
            } else if (dimType === 'vertical') {
                dim.p1y = p1.y; dim.p2y = p2.y; dim.p1x = dim.p2x = offset;
                dim.extP1x = p1.x; dim.extP1y = p1.y; dim.extP2x = p2.x; dim.extP2y = p2.y;
                dim.text = `${Math.abs(p1.y - p2.y).toFixed(1)}`;
            } else { // Aligned
                const lineVec = { x: p2.x - p1.x, y: p2.y - p1.y };
                const lineLength = Math.hypot(lineVec.x, lineVec.y);
                if (lineLength > 1) {
                    const perpVecNormalized = { x: -lineVec.y / lineLength, y: lineVec.x / lineLength };
                    const offsetX = perpVecNormalized.x * offset;
                    const offsetY = perpVecNormalized.y * offset;
                    dim.p1x = p1.x + offsetX; dim.p1y = p1.y + offsetY;
                    dim.p2x = p2.x + offsetX; dim.p2y = p2.y + offsetY;
                }
                dim.extP1x = p1.x; dim.extP1y = p1.y;
                dim.extP2x = p2.x; dim.extP2y = p2.y;
                dim.text = `${lineLength.toFixed(1)}`;
            }
        }
        
        dim.textX = dim.p1x + (dim.p2x - dim.p1x) / 2;
        dim.textY = dim.p1y + (dim.p2y - dim.p1y) / 2;
    },
    drawDimensionObject: function(dim, isSelected) {
        const { ctx } = CADApp.ui;
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#0f172a';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#0f172a';
        ctx.font = '12px Inter';

        // Dimension line
        if (dim.p1x !== undefined && dim.p1y !== undefined && dim.p2x !== undefined && dim.p2y !== undefined) {
            this.drawArrow(ctx, dim.p1x, dim.p1y, dim.p2x, dim.p2y);
        }

        // Extension lines
        if (dim.extP1x !== undefined && dim.dimType !== 'radius') {
            ctx.beginPath();
            ctx.moveTo(dim.extP1x, dim.extP1y);
            ctx.lineTo(dim.p1x, dim.p1y);
            ctx.moveTo(dim.extP2x, dim.extP2y);
            ctx.lineTo(dim.p2x, dim.p2y);
            ctx.stroke();
        }

        // Text
        if (dim.textX !== undefined && dim.text) {
            ctx.fillText(dim.text, dim.textX, dim.textY - 5);
        }
    }
};
