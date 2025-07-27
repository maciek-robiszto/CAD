var CADApp = CADApp || {};
CADApp.snapping = {
                getSnapPoint: function(x, y) { let bestSnap = { x, y, dist: Infinity, isSnapped: false, snapType: null }; const { snapTolerance, shapes, activeCommand, currentPolylinePoints } = CADApp.state; const { snapEndpoint, snapMidpoint } = CADApp.ui; if (!snapEndpoint.checked && !snapMidpoint.checked) return bestSnap; 
                    if (activeCommand === 'drawing_line' && currentPolylinePoints.length > 1) {
                        const firstPoint = currentPolylinePoints[0];
                        const d = Math.hypot(x - firstPoint.x, y - firstPoint.y);
                        if (d < snapTolerance) {
                             bestSnap = { x: firstPoint.x, y: firstPoint.y, dist: d, isSnapped: true, snapType: 'endpoint' };
                        }
                    }
                    shapes.forEach(shape => { if (shape.type !== 'line' && shape.type !== 'rect' && shape.type !== 'circle' && shape.type !== 'polygon') return; const points = []; if (shape.type === 'line') { if (snapEndpoint.checked) { points.push({ x: shape.x1, y: shape.y1, type: 'endpoint' }, { x: shape.x2, y: shape.y2, type: 'endpoint' }); } if (snapMidpoint.checked) { points.push({ x: (shape.x1 + shape.x2) / 2, y: (shape.y1 + shape.y2) / 2, type: 'midpoint' }); } } else if (shape.type === 'rect') { if (snapEndpoint.checked) { const pts = CADApp.modification.getRectVertices(shape); pts.forEach(p => points.push({...p, type: 'endpoint'})); } } else if (shape.type === 'circle') { if (snapMidpoint.checked) { points.push({x: shape.cx, y: shape.cy, type: 'midpoint'}); } } else if (shape.type === 'polygon') { 
                        if (snapEndpoint.checked) { 
                            shape.points.forEach(p => {
                                if (p.isFillet) {
                                    // Dla punktów fillet dodaj punkty styczne
                                    if (p.p1) points.push({x: p.p1.x, y: p.p1.y, type: 'endpoint'});
                                    if (p.p2) points.push({x: p.p2.x, y: p.p2.y, type: 'endpoint'});
                                } else {
                                    points.push({x: p.x, y: p.y, type: 'endpoint'});
                                }
                            });
                        }
                        if (snapMidpoint.checked) {
                            shape.points.forEach(p => {
                                if (p.isFillet) {
                                    // Środek łuku fillet
                                    points.push({x: p.x, y: p.y, type: 'midpoint'});
                                }
                            });
                        }
                    } points.forEach(p => { const d = Math.hypot(x - p.x, y - p.y); if (d < snapTolerance && d < bestSnap.dist) { bestSnap = { x: p.x, y: p.y, dist: d, isSnapped: true, snapType: p.type }; } }); }); return bestSnap; },
                drawSnapIndicator: function(x, y, type) { const { ctx } = CADApp.ui; ctx.fillStyle = '#ec4899'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); if (type === 'endpoint') ctx.rect(x - 5, y - 5, 10, 10); else if (type === 'midpoint') { ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y + 3); ctx.lineTo(x - 6, y + 3); ctx.closePath(); } ctx.fill(); ctx.stroke(); }
            };
