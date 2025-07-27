var CADApp = CADApp || {};
CADApp.selection = {
                findShapeAtPoint: function(x, y, types = ['line', 'rect', 'circle', 'dimension', 'polygon']) {
                    for (let i = CADApp.state.shapes.length - 1; i >= 0; i--) {
                        const shape = CADApp.state.shapes[i];
                        if (types.includes(shape.type) && this.isPointOnShape(x, y, shape)) return shape;
                    }
                    return null;
                },
                findEdgeAtPoint: function(x, y) {
                    const { shapes } = CADApp.state;
                    for (const shape of shapes) {
                        let edges = [];
                        if (shape.type === 'rect') {
                            const v = CADApp.modification.getRectVertices(shape);
                            edges = [{p1: v[0], p2: v[1]}, {p1: v[1], p2: v[2]}, {p1: v[2], p2: v[3]}, {p1: v[3], p2: v[0]}];
                        } else if (shape.type === 'polygon') {
                            for (let i = 0; i < shape.points.length; i++) {
                                const currentPoint = shape.points[i];
                                const nextPoint = shape.points[(i + 1) % shape.points.length];
                                
                                let p1, p2;
                                
                                // Określ punkt początkowy krawędzi
                                if (currentPoint.isFillet && currentPoint.p2) {
                                    p1 = currentPoint.p2;
                                } else {
                                    p1 = currentPoint;
                                }
                                
                                // Określ punkt końcowy krawędzi
                                if (nextPoint.isFillet && nextPoint.p1) {
                                    p2 = nextPoint.p1;
                                } else {
                                    p2 = nextPoint;
                                }
                                
                                // Dodaj krawędź tylko jeśli punkty są różne
                                if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1) {
                                    edges.push({p1: p1, p2: p2});
                                }
                            }
                        } else if (shape.type === 'line') {
                            edges.push({p1: {x: shape.x1, y: shape.y1}, p2: {x: shape.x2, y: shape.y2}});
                        } else if (shape.type === 'circle') {
                             if (this.isPointOnShape(x, y, shape)) return { shape, edge: null };
                        }

                        for (let i = 0; i < edges.length; i++) {
                            const edge = edges[i];
                            if (this.isPointOnShape(x, y, {type: 'line', x1: edge.p1.x, y1: edge.p1.y, x2: edge.p2.x, y2: edge.p2.y})) {
                                return { shape, edge: {...edge, index: i} };
                            }
                        }
                    }
                    return null;
                },
                isPointOnShape: function(x, y, shape) {
                    const tolerance = 5;
                    if (shape.type === 'line') {
                        const { x1, y1, x2, y2 } = shape;
                        const distSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
                        if (distSq === 0) return Math.hypot(x - x1, y - y1) <= tolerance;
                        let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / distSq;
                        t = Math.max(0, Math.min(1, t));
                        const projX = x1 + t * (x2 - x1);
                        const projY = y1 + t * (y2 - y1);
                        return Math.hypot(x - projX, y - projY) <= tolerance;
                    } else if (shape.type === 'rect') {
                        return (x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h);
                    } else if (shape.type === 'circle') {
                        const dist = Math.hypot(x - shape.cx, y - shape.cy);
                        return Math.abs(dist - shape.r) <= tolerance;
                    } else if (shape.type === 'dimension') {
                        return x > Math.min(shape.p1x, shape.p2x) - tolerance && x < Math.max(shape.p1x, shape.p2x) + tolerance &&
                               y > Math.min(shape.p1y, shape.p2y) - tolerance && y < Math.max(shape.p1y, shape.p2y) + tolerance;
                    } else if (shape.type === 'polygon') {
                        for (let i = 0; i < shape.points.length; i++) {
                            const currentPoint = shape.points[i];
                            const nextPoint = shape.points[(i + 1) % shape.points.length];
                            
                            // Sprawdź kliknięcie na łuku fillet
                            if (currentPoint.isFillet && currentPoint.radius) {
                                const dist = Math.hypot(x - currentPoint.x, y - currentPoint.y);
                                if (Math.abs(dist - currentPoint.radius) <= tolerance) {
                                    return true;
                                }
                            }
                            
                            // Sprawdź kliknięcie na krawędzi
                            let p1, p2;
                            if (currentPoint.isFillet && currentPoint.p2) {
                                p1 = currentPoint.p2;
                            } else {
                                p1 = currentPoint;
                            }
                            
                            if (nextPoint.isFillet && nextPoint.p1) {
                                p2 = nextPoint.p1;
                            } else {
                                p2 = nextPoint;
                            }
                            
                            // Sprawdź kliknięcie na linii między punktami
                            if (Math.hypot(p2.x - p1.x, p2.y - p1.y) > 1) {
                                if (this.isPointOnShape(x, y, { type: 'line', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y })) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    }
                    return false;
                },
                moveShape: function(shape, dx, dy) {
                    if (shape.type === 'line') {
                        shape.x1 += dx; shape.y1 += dy; shape.x2 += dx; shape.y2 += dy;
                    } else if (shape.type === 'rect') {
                        shape.x += dx; shape.y += dy;
                    } else if (shape.type === 'circle') {
                        shape.cx += dx; shape.cy += dy;
                    } else if (shape.type === 'polygon') {
                        shape.points.forEach(p => { 
                            p.x += dx; p.y += dy; 
                            if(p.isFillet) {
                                p.p1.x += dx; p.p1.y += dy;
                                p.p2.x += dx; p.p2.y += dy;
                            }
                        });
                    } 
                    // Update all associated dimensions
                    CADApp.state.shapes.forEach(s => { 
                        if (s.type === 'dimension' && s.targetId === shape.id) {
                            CADApp.drawing.updateDimensionGeometry(s); 
                        }
                    });
                },
                deleteSelectedShape: function() {
                    const { state, ui, drawing, historyManager } = CADApp;
                    if (!state.selectedShape) return;
                    const shapeToDelete = state.selectedShape;
                    state.shapes = state.shapes.filter(s => s !== shapeToDelete);
                    if (shapeToDelete.id) {
                        state.shapes = state.shapes.filter(s => !(s.type === 'dimension' && s.targetId === shapeToDelete.id));
                    }
                    state.selectedShape = null;
                    ui.updateDeleteButtonState();
                    drawing.draw();
                    historyManager.saveState();
                },
                
                editDimension: function(dimension) {
                    const currentValue = parseFloat(dimension.text);
                    const newValue = prompt(`Wprowadź nowy wymiar (obecny: ${currentValue}):`, currentValue);
                    
                    if (newValue === null || newValue === '' || isNaN(parseFloat(newValue))) {
                        return; // Anulowano lub nieprawidłowa wartość
                    }
                    
                    const targetShape = CADApp.state.shapes.find(s => s.id === dimension.targetId);
                    if (!targetShape) return;
                    
                    const ratio = parseFloat(newValue) / currentValue;
                    
                    // Skaluj obiekt w zależności od typu
                    if (targetShape.type === 'line') {
                        this.scaleLine(targetShape, ratio, dimension);
                    } else if (targetShape.type === 'rect') {
                        this.scaleRect(targetShape, ratio, dimension);
                    } else if (targetShape.type === 'circle') {
                        this.scaleCircle(targetShape, ratio);
                    } else if (targetShape.type === 'polygon') {
                        this.scalePolygon(targetShape, ratio, dimension);
                    }
                    
                    // Aktualizuj wszystkie wymiary dla tego obiektu
                    CADApp.state.shapes.forEach(s => {
                        if (s.type === 'dimension' && s.targetId === targetShape.id) {
                            CADApp.drawing.updateDimensionGeometry(s);
                        }
                    });
                    
                    CADApp.drawing.draw();
                    CADApp.historyManager.saveState();
                },
                
                scaleLine: function(line, ratio, dimension) {
                    const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
                    const newLength = length * ratio;
                    const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
                    
                    line.x2 = line.x1 + newLength * Math.cos(angle);
                    line.y2 = line.y1 + newLength * Math.sin(angle);
                },
                
                scaleRect: function(rect, ratio, dimension) {
                    if (dimension.dimType === 'horizontal') {
                        rect.w *= ratio;
                    } else if (dimension.dimType === 'vertical') {
                        rect.h *= ratio;
                    } else {
                        // Proporcjonalne skalowanie
                        rect.w *= ratio;
                        rect.h *= ratio;
                    }
                },
                
                scaleCircle: function(circle, ratio) {
                    circle.r *= ratio;
                },
                
                scalePolygon: function(polygon, ratio, dimension) {
                    // Znajdź środek polygonu
                    const centroid = this.getPolygonCentroid(polygon);
                    
                    // Skaluj wszystkie punkty względem środka
                    polygon.points.forEach(point => {
                        if (point.isFillet) {
                            // Skaluj punkty fillet
                            point.x = centroid.x + (point.x - centroid.x) * ratio;
                            point.y = centroid.y + (point.y - centroid.y) * ratio;
                            point.p1.x = centroid.x + (point.p1.x - centroid.x) * ratio;
                            point.p1.y = centroid.y + (point.p1.y - centroid.y) * ratio;
                            point.p2.x = centroid.x + (point.p2.x - centroid.x) * ratio;
                            point.p2.y = centroid.y + (point.p2.y - centroid.y) * ratio;
                            point.radius *= ratio;
                        } else {
                            point.x = centroid.x + (point.x - centroid.x) * ratio;
                            point.y = centroid.y + (point.y - centroid.y) * ratio;
                        }
                    });
                },
                
                getPolygonCentroid: function(polygon) {
                    let x = 0, y = 0;
                    polygon.points.forEach(point => {
                        x += point.x;
                        y += point.y;
                    });
                    return { x: x / polygon.points.length, y: y / polygon.points.length };
                }
            };
