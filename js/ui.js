var CADApp = CADApp || {};
CADApp.ui = {
    canvas: null, ctx: null, canvasContainer: null, coordsDisplay: null,
    lengthInput: null, widthInput: null, lengthLabel: null,
    snapEndpoint: null, snapMidpoint: null, deleteButton: null,
    undoBtn: null, redoBtn: null,

    init: function() {
        Object.assign(this, {
            canvas: document.getElementById('cad-canvas'),
            ctx: document.getElementById('cad-canvas').getContext('2d'),
            canvasContainer: document.getElementById('canvas-container'),
            coordsDisplay: document.getElementById('coords'),
            lengthInput: document.getElementById('input-length'),
            widthInput: document.getElementById('input-width'),
            lengthLabel: document.getElementById('label-length'),
            snapEndpoint: document.getElementById('snap-endpoint'),
            snapMidpoint: document.getElementById('snap-midpoint'),
            deleteButton: document.getElementById('delete-button'),
            undoBtn: document.getElementById('undo-btn'),
            redoBtn: document.getElementById('redo-btn'),
        });
    },

    setActiveTool: function(tool) {
        CADApp.state.currentTool = tool;
        CADApp.state.selectedShape = null;
        CADApp.events.cancelCurrentCommand();
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`${tool}-tool`).classList.add('active');

        const isRect = tool === 'rect';
        const isDrawingTool = tool === 'line' || tool === 'rect' || tool === 'circle';
        this.lengthInput.disabled = !isDrawingTool && tool !== 'fillet' && tool !== 'chamfer';
        this.widthInput.disabled = !isRect;
        if(tool === 'circle') this.lengthLabel.textContent = 'Promień:';
        else if(tool === 'fillet' || tool === 'chamfer') this.lengthLabel.textContent = 'Wartość:';
        else this.lengthLabel.textContent = 'Długość:';

        this.updateCursor();
        this.updateDeleteButtonState();
        CADApp.drawing.draw();
    },

    updateCursor: function() {
        const { currentTool, mouseX, mouseY, selectedShape, activeCommand, isShiftPressed } = CADApp.state;
        const { selection, modification } = CADApp;
        if (activeCommand) {
            this.canvas.style.cursor = 'crosshair';
        } else if (currentTool === 'select') {
            const hoverShape = selection.findShapeAtPoint(mouseX, mouseY);
            if (selectedShape && hoverShape === selectedShape) this.canvas.style.cursor = 'move';
            else if (isShiftPressed && hoverShape && hoverShape.type === 'line') this.canvas.style.cursor = 'copy';
            else this.canvas.style.cursor = 'default';
        } else if (currentTool === 'dim' && selection.findEdgeAtPoint(mouseX, mouseY)) {
             this.canvas.style.cursor = 'copy';
        } else if ((currentTool === 'fillet' || currentTool === 'chamfer') && modification.findVertexAtPoint(mouseX, mouseY)) {
            this.canvas.style.cursor = 'pointer';
        }
        else {
            this.canvas.style.cursor = 'default';
        }
    },

    updateDeleteButtonState: function() { this.deleteButton.disabled = !CADApp.state.selectedShape; },
    updateHistoryButtons: function() {
        const { history, historyIndex } = CADApp.state;
        this.undoBtn.disabled = historyIndex <= 0;
        this.redoBtn.disabled = historyIndex >= history.length - 1;
    },
    clearCanvas: function() { Object.assign(CADApp.state, { shapes: [], tempShape: null, selectedShape: null, activeCommand: null, firstPoint: null, currentPolylinePoints: [], isDragging: false, shapeIdCounter: 1 }); this.updateDeleteButtonState(); CADApp.historyManager.saveState(); },
    resizeCanvas: function() { this.canvas.width = this.canvasContainer.clientWidth; this.canvas.height = this.canvasContainer.clientHeight; CADApp.drawing.draw(); },
    exportSVG: function() {
        const { shapes } = CADApp.state;
        const { canvas } = CADApp.ui;
        let svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svgContent += `  <rect width="100%" height="100%" fill="#f0f4f8" />\n`;

        shapes.forEach(shape => {
            if (shape.type === 'line') {
                svgContent += `  <line x1="${shape.x1}" y1="${shape.y1}" x2="${shape.x2}" y2="${shape.y2}" stroke="#0f172a" stroke-width="2" />\n`;
            } else if (shape.type === 'rect') {
                svgContent += `  <rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" stroke="#0f172a" stroke-width="2" fill="rgba(59, 130, 246, 0.05)" />\n`;
            } else if (shape.type === 'circle') {
                svgContent += `  <circle cx="${shape.cx}" cy="${shape.cy}" r="${shape.r}" stroke="#0f172a" stroke-width="2" fill="rgba(59, 130, 246, 0.05)" />\n`;
            } else if (shape.type === 'polygon') {
                const hasFillets = shape.points.some(p => p.isFillet);

                if (hasFillets) {
                    let pathData = '';
                    const points = shape.points;

                    if (points.length > 0) {
                        let startPoint;
                        if (points[0].isFillet && points[0].p2) {
                            startPoint = points[0].p2;
                        } else {
                            startPoint = points[0];
                        }

                        pathData += `M ${startPoint.x} ${startPoint.y} `;

                        for (let i = 0; i < points.length; i++) {
                            const nextIndex = (i + 1) % points.length;
                            const nextPoint = points[nextIndex];

                            if (nextPoint.isFillet && nextPoint.p1 && nextPoint.p2 && nextPoint.radius > 0) {
                                pathData += `L ${nextPoint.p1.x} ${nextPoint.p1.y} `;
                                pathData += `Q ${nextPoint.x} ${nextPoint.y} ${nextPoint.p2.x} ${nextPoint.p2.y} `;
                            } else {
                                pathData += `L ${nextPoint.x} ${nextPoint.y} `;
                            }
                        }

                        pathData += 'Z';
                        svgContent += `  <path d="${pathData}" stroke="#0f172a" stroke-width="2" fill="rgba(59, 130, 246, 0.05)" />\n`;
                    }
                } else {
                    const points = shape.points.map(p => `${p.x},${p.y}`).join(' ');
                    svgContent += `  <polygon points="${points}" stroke="#0f172a" stroke-width="2" fill="rgba(59, 130, 246, 0.05)" />\n`;
                }
            }
        });

        svgContent += '</svg>';

        const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rysunek.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
