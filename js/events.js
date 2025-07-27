var CADApp = CADApp || {};
CADApp.events = {
                setup: function() {
                    const { canvas, deleteButton, undoBtn, redoBtn } = CADApp.ui;
                    window.addEventListener('resize', () => CADApp.ui.resizeCanvas());
                    window.addEventListener('keydown', this.handleKeyDown);
                    window.addEventListener('keyup', this.handleKeyUp);
                    canvas.addEventListener('mousedown', this.handleMouseDown);
                    canvas.addEventListener('mousemove', this.handleMouseMove);
                    canvas.addEventListener('mouseup', this.handleMouseUp);
                    
                    document.getElementById('select-tool').addEventListener('click', () => CADApp.ui.setActiveTool('select'));
                    document.getElementById('line-tool').addEventListener('click', () => CADApp.ui.setActiveTool('line'));
                    document.getElementById('rect-tool').addEventListener('click', () => CADApp.ui.setActiveTool('rect'));
                    document.getElementById('circle-tool').addEventListener('click', () => CADApp.ui.setActiveTool('circle'));
                    document.getElementById('dim-tool').addEventListener('click', () => CADApp.ui.setActiveTool('dim'));
                    document.getElementById('fillet-tool').addEventListener('click', () => CADApp.ui.setActiveTool('fillet'));
                    document.getElementById('chamfer-tool').addEventListener('click', () => CADApp.ui.setActiveTool('chamfer'));
                    document.getElementById('clear-canvas').addEventListener('click', () => CADApp.ui.clearCanvas());
                    deleteButton.addEventListener('click', () => CADApp.selection.deleteSelectedShape());
                    document.getElementById('export-svg').addEventListener('click', () => CADApp.ui.exportSVG());
                    undoBtn.addEventListener('click', () => CADApp.historyManager.undo());
                    redoBtn.addEventListener('click', () => CADApp.historyManager.redo());
                },

                cancelCurrentCommand: function() {
                    CADApp.state.activeCommand = null;
                    CADApp.state.firstPoint = null;
                    CADApp.state.tempShape = null;
                    CADApp.state.currentPolylinePoints = [];
                    CADApp.state.currentPolylineSegmentIds = [];
                    CADApp.state.modificationTarget = null;
                    CADApp.drawing.draw();
                },

                handleKeyDown: function(e) {
                    if (document.activeElement.tagName === 'INPUT') return;
                    const { state, ui, historyManager } = CADApp;
                    if (e.key === 'Shift') state.isShiftPressed = true;
                    
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                        e.preventDefault();
                        historyManager.undo();
                        return;
                    }
                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                        e.preventDefault();
                        historyManager.redo();
                        return;
                    }

                    switch(e.key.toLowerCase()) {
                        case 'l': ui.setActiveTool('line'); break;
                        case 'r': ui.setActiveTool('rect'); break;
                        case 'c': ui.setActiveTool('circle'); break;
                        case 'd': ui.setActiveTool('dim'); break;
                        case 's': ui.setActiveTool('select'); break;
                        case 'f': ui.setActiveTool('fillet'); break;
                        case 'h': ui.setActiveTool('chamfer'); break;
                        case 'escape': 
                            if (state.activeCommand) {
                                CADApp.events.cancelCurrentCommand();
                            } else if (state.selectedShape) {
                                state.selectedShape = null;
                                ui.updateDeleteButtonState();
                                CADApp.drawing.draw();
                            }
                            break;
                        case 'delete':
                        case 'backspace':
                            if (state.selectedShape) { e.preventDefault(); CADApp.selection.deleteSelectedShape(); }
                            break;
                    }
                    ui.updateCursor();
                },

                handleKeyUp: function(e) {
                    if (e.key === 'Shift') {
                        CADApp.state.isShiftPressed = false;
                        CADApp.ui.updateCursor();
                    }
                },

                handleMouseDown: function(e) {
                    if (e.button !== 0) return;

                    const { state, selection, snapping, ui, drawing, events, modification } = CADApp;
                    const rect = ui.canvas.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const snappedPoint = snapping.getSnapPoint(mouseX, mouseY);
                    
                    if (state.activeCommand) {
                        const p1 = state.firstPoint;
                        const p2 = snappedPoint;
                        
                        if (state.activeCommand === 'drawing_line') {
                            const startPoint = state.currentPolylinePoints[0];
                            if (state.currentPolylinePoints.length > 1 && Math.hypot(p2.x - startPoint.x, p2.y - startPoint.y) < state.snapTolerance) {
                                state.shapes = state.shapes.filter(s => !state.currentPolylineSegmentIds.includes(s.id));
                                // Czyść punkty żeby miały tylko x i y
                                const cleanPoints = state.currentPolylinePoints.map(p => ({ x: p.x, y: p.y }));
                                const newPolygon = { type: 'polygon', id: state.shapeIdCounter++, points: cleanPoints };
                                state.shapes.push(newPolygon);
                                events.cancelCurrentCommand();
                                CADApp.historyManager.saveState();
                            } else {
                                const newLine = { type: 'line', id: state.shapeIdCounter++, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
                                state.shapes.push(newLine);
                                state.currentPolylineSegmentIds.push(newLine.id);
                                state.firstPoint = { x: p2.x, y: p2.y }; // Czyść punkt
                                state.currentPolylinePoints.push({ x: p2.x, y: p2.y }); // Czyść punkt
                                state.tempShape = null;
                            }
                        } else { 
                            let newShape = null;
                            if (state.activeCommand === 'drawing_rect') {
                                newShape = { type: 'rect', id: state.shapeIdCounter++, x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y };
                                if (newShape.w < 0) { newShape.x += newShape.w; newShape.w *= -1; }
                                if (newShape.h < 0) { newShape.y += newShape.h; newShape.h *= -1; }
                            } else if (state.activeCommand === 'drawing_circle') {
                                const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                                newShape = { type: 'circle', id: state.shapeIdCounter++, cx: p1.x, cy: p1.y, r: r };
                            } else if (state.activeCommand === 'dimensioning') {
                                if (state.tempShape) state.shapes.push(state.tempShape);
                            }
                            if (newShape) state.shapes.push(newShape);
                            events.cancelCurrentCommand();
                            CADApp.historyManager.saveState();
                        }
                    } else { 
                        state.startX = mouseX;
                        state.startY = mouseY;
                        
                        if (state.currentTool === 'select') {
                            const targetShape = selection.findShapeAtPoint(mouseX, mouseY);
                            
                            // Sprawdź podwójne kliknięcie na wymiar
                            if (targetShape && targetShape.type === 'dimension') {
                                const currentTime = Date.now();
                                const isDoubleClick = currentTime - state.lastClickTime < 300 && state.lastClickShape === targetShape;
                                
                                if (isDoubleClick) {
                                    // Podwójne kliknięcie - edytuj wymiar
                                    selection.editDimension(targetShape);
                                    state.lastClickTime = 0; // Reset czasu
                                    state.lastClickShape = null;
                                    return;
                                } else {
                                    // Pierwsze kliknięcie
                                    state.lastClickTime = currentTime;
                                    state.lastClickShape = targetShape;
                                    state.selectedShape = targetShape;
                                }
                            } else if (state.isShiftPressed && targetShape && targetShape.type === 'line') {
                                state.activeCommand = 'dimensioning';
                                state.firstPoint = {x: mouseX, y: mouseY};
                                state.dimensionTarget = {shape: targetShape, edge: {p1: {x: targetShape.x1, y: targetShape.y1}, p2: {x: targetShape.x2, y: targetShape.y2}}};
                            } else {
                                state.selectedShape = targetShape;
                                if (targetShape) state.isDragging = true;
                                // Reset podwójnego kliknięcia dla innych obiektów
                                state.lastClickTime = 0;
                                state.lastClickShape = null;
                            }
                        } else if (state.currentTool === 'dim') {
                             const target = selection.findEdgeAtPoint(mouseX, mouseY);
                             if (target) {
                                state.activeCommand = 'dimensioning';
                                state.firstPoint = {x: mouseX, y: mouseY};
                                state.dimensionTarget = target;
                             }
                        } else if (state.currentTool === 'fillet' || state.currentTool === 'chamfer') {
                            const targetVertex = modification.findVertexAtPoint(mouseX, mouseY);
                            if (targetVertex) {
                                state.activeCommand = 'modifying';
                                state.modificationTarget = targetVertex;
                            }
                        }
                        else { // Drawing tools
                            state.activeCommand = 'drawing_' + state.currentTool;
                            state.firstPoint = { x: snappedPoint.x, y: snappedPoint.y }; // Czyść punkt
                            if (state.currentTool === 'line') {
                                state.currentPolylinePoints.push({ x: snappedPoint.x, y: snappedPoint.y }); // Czyść punkt
                                state.currentPolylineSegmentIds = [];
                            }
                        }
                    }
                    
                    ui.updateDeleteButtonState();
                    drawing.draw();
                },

                handleMouseMove: function(e) {
                    const { state, ui, drawing, snapping, modification } = CADApp;
                    const rect = ui.canvas.getBoundingClientRect();
                    state.mouseX = e.clientX - rect.left;
                    state.mouseY = e.clientY - rect.top;
                    ui.coordsDisplay.textContent = `${Math.round(state.mouseX)}, ${Math.round(state.mouseY)}`;
                    
                    if (state.isDragging && state.selectedShape) {
                        const dx = state.mouseX - state.startX;
                        const dy = state.mouseY - state.startY;
                        CADApp.selection.moveShape(state.selectedShape, dx, dy);
                        state.startX = state.mouseX;
                        state.startY = state.mouseY;
                        drawing.draw();
                    } else if (state.activeCommand === 'modifying') {
                        const { shape, vertexIndex } = state.modificationTarget;
                        const vertices = (shape.type === 'rect') ? modification.getRectVertices(shape) : shape.points;
                        const vertex = vertices[vertexIndex];
                        const value = Math.hypot(state.mouseX - vertex.x, state.mouseY - vertex.y);
                        ui.lengthInput.value = value.toFixed(1);
                        
                        const tempShapeCopy = JSON.parse(JSON.stringify(shape));
                        const tempTarget = { shape: tempShapeCopy, vertexIndex };
                        const modType = (state.currentTool === 'fillet' && !state.isShiftPressed) || (state.currentTool === 'chamfer' && state.isShiftPressed) ? 'fillet' : 'chamfer';
                        modification.applyModification(tempTarget, value, modType, false);
                        state.tempShape = tempShapeCopy;
                        drawing.draw();

                    } else if (state.activeCommand) {
                        const p1 = state.firstPoint;
                        const p2 = snapping.getSnapPoint(state.mouseX, state.mouseY);

                        if (state.activeCommand === 'drawing_line') {
                            state.tempShape = { type: 'line', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
                        } else if (state.activeCommand === 'drawing_rect') {
                            state.tempShape = { type: 'rect', x: p1.x, y: p1.y, w: p2.x - p1.x, h: p2.y - p1.y };
                        } else if (state.activeCommand === 'drawing_circle') {
                            const r = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                            state.tempShape = { type: 'circle', cx: p1.x, cy: p1.y, r: r };
                        } else if (state.activeCommand === 'dimensioning') {
                            const target = state.dimensionTarget;
                            let text, offset, dimType = 'aligned';

                            if (target.shape.type === 'circle') {
                                dimType = 'radius';
                                offset = Math.atan2(state.mouseY - target.shape.cy, state.mouseX - target.shape.cx);
                                text = `R ${target.shape.r.toFixed(1)}`;
                            } else {
                                const line = target.edge;
                                const dragVec = { x: state.mouseX - p1.x, y: state.mouseY - p1.y };
                                if (Math.abs(dragVec.y) > Math.abs(dragVec.x) * 2) dimType = 'horizontal';
                                else if (Math.abs(dragVec.x) > Math.abs(dragVec.y) * 2) dimType = 'vertical';

                                if (dimType === 'horizontal') {
                                    offset = state.mouseY; text = `${Math.abs(line.p1.x - line.p2.x).toFixed(1)}`;
                                } else if (dimType === 'vertical') {
                                    offset = state.mouseX; text = `${Math.abs(line.p1.y - line.p2.y).toFixed(1)}`;
                                } else {
                                    const lineVec = { x: line.p2.x - line.p1.x, y: line.p2.y - line.p1.y };
                                    const lineLength = Math.hypot(lineVec.x, lineVec.y);
                                    const mouseVec = { x: state.mouseX - line.p1.x, y: state.mouseY - line.p1.y };
                                    const perpVecNormalized = { x: -lineVec.y / lineLength, y: lineVec.x / lineLength };
                                    offset = mouseVec.x * perpVecNormalized.x + mouseVec.y * perpVecNormalized.y;
                                    text = `${lineLength.toFixed(1)}`;
                                }
                            }
                            state.tempShape = { type: 'dimension', targetId: target.shape.id, edgeIndex: target.edge ? target.edge.index : null, dimType, offset, text };
                            drawing.updateDimensionGeometry(state.tempShape);
                        }
                        drawing.draw();
                    } else {
                        ui.updateCursor();
                        const snappedPoint = snapping.getSnapPoint(state.mouseX, state.mouseY);
                        drawing.draw();
                        if (snappedPoint.isSnapped) {
                            snapping.drawSnapIndicator(snappedPoint.x, snappedPoint.y, snappedPoint.snapType);
                        }
                    }
                },

                handleMouseUp: function(e) {
                    if (e.button !== 0) return;
                    const { state, modification, events, historyManager } = CADApp;
                    if (state.activeCommand === 'modifying') {
                        const value = parseFloat(CADApp.ui.lengthInput.value);
                        if (!isNaN(value) && value > 0) {
                            const modType = (state.currentTool === 'fillet' && !state.isShiftPressed) || (state.currentTool === 'chamfer' && state.isShiftPressed) ? 'fillet' : 'chamfer';
                            modification.applyModification(state.modificationTarget, value, modType, true);
                            historyManager.saveState();
                        }
                        events.cancelCurrentCommand();
                    }
                    if(state.isDragging) {
                        state.isDragging = false;
                        historyManager.saveState();
                    }
                }
};
