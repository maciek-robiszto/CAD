var CADApp = CADApp || {};
CADApp.modification = {
                findVertexAtPoint: function(x, y) {
                    const { shapes, snapTolerance } = CADApp.state;
                    for (const shape of shapes) {
                        if (shape.type === 'polygon' || shape.type === 'rect') {
                            const vertices = (shape.type === 'rect') ? this.getRectVertices(shape) : shape.points;
                            for (let i = 0; i < vertices.length; i++) {
                                const v = vertices[i];
                                if (Math.hypot(x - v.x, y - v.y) < snapTolerance) {
                                    return { shape, vertexIndex: i };
                                }
                            }
                        }
                    }
                    return null;
                },
                getRectVertices: function(rect) {
                    return [
                        { x: rect.x, y: rect.y },
                        { x: rect.x + rect.w, y: rect.y },
                        { x: rect.x + rect.w, y: rect.y + rect.h },
                        { x: rect.x, y: rect.y + rect.h }
                    ];
                },
                applyModification: function(target, value, type) {
                    let { shape, vertexIndex } = target;

                    // Konwersja prostokąta na polygon
                    if (shape.type === 'rect') {
                        const newPolygon = { type: 'polygon', id: shape.id, points: this.getRectVertices(shape) };
                        CADApp.state.shapes[CADApp.state.shapes.indexOf(shape)] = newPolygon;
                        shape = newPolygon;
                    }

                    const points = shape.points;
                    const len = points.length;
                    const pPrev = points[(vertexIndex - 1 + len) % len];
                    const pCurr = points[vertexIndex];
                    const pNext = points[(vertexIndex + 1) % len];

                    let existingDimension = null;
                    if (pCurr.isFillet) {
                        existingDimension = CADApp.state.shapes.find(s => s.type === 'dimension' && s.filletPoint === pCurr);
                    }

                    // wektory do poprzedniego i następnego wierzchołka
                    const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
                    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

                    const len1 = Math.hypot(v1.x, v1.y);
                    const len2 = Math.hypot(v2.x, v2.y);

                    // Oblicz kąt między wektorami
                    const dir1 = { x: v1.x / len1, y: v1.y / len1 };
                    const dir2 = { x: v2.x / len2, y: v2.y / len2 };
                    const dotProduct = dir1.x * dir2.x + dir1.y * dir2.y;
                    const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
                    
                    // Dla małych kątów fillet nie ma sensu
                    if (angle < 0.1) return;
                    
                    // Oblicz odległość punktów stycznych od wierzchołka dla arcTo()
                    const tangentDistance = value / Math.tan(angle / 2);
                    
                    // Ogranicz odległość żeby nie wyjść poza krawędzie
                    const maxDist = Math.min(tangentDistance, len1 / 2, len2 / 2);
                    
                    if (maxDist < 0.1 || isNaN(maxDist)) return;

                    // Wyznacz punkty styczne łuku
                    const newP1 = {
                        x: pCurr.x + (v1.x / len1) * maxDist,
                        y: pCurr.y + (v1.y / len1) * maxDist
                    };
                    const newP2 = {
                        x: pCurr.x + (v2.x / len2) * maxDist,
                        y: pCurr.y + (v2.y / len2) * maxDist
                    };

                    if (type === 'chamfer') {
                        // Zamiana wierzchołka na dwa punkty (ścięcie)
                        points.splice(vertexIndex, 1, newP1, newP2);
                    } else if (type === 'fillet') {
                        // Oblicz rzeczywisty promień dla arcTo() na podstawie odległości stycznych
                        const actualRadius = maxDist * Math.tan(angle / 2);
                        
                        // Dla arcTo() potrzebujemy oryginalnego wierzchołka jako punktu kontrolnego
                        const filletPoint = {
                            x: pCurr.x,
                            y: pCurr.y,
                            isFillet: true,
                            radius: actualRadius,
                            p1: newP1,
                            p2: newP2
                        };
                        points.splice(vertexIndex, 1, filletPoint);

                        // Automatycznie dodaj/aktualizuj wymiar promienia filleta
                        this.createFilletDimension(shape, filletPoint, actualRadius, existingDimension);
                    }
                },
                createFilletDimension: function(shape, filletPoint, radius, existingDimension) {
                    // Utwórz lub zaktualizuj wymiar promienia dla filleta
                    const dimension = existingDimension || {
                        type: 'dimension',
                        id: CADApp.state.shapeIdCounter++,
                        targetId: shape.id,
                        dimType: 'radius',
                        offset: 0 // Kąt dla promienia
                    };

                    dimension.text = `R ${radius.toFixed(1)}`;
                    // Pozycje będą obliczone przez updateDimensionGeometry
                    dimension.p1x = filletPoint.x;
                    dimension.p1y = filletPoint.y;
                    dimension.p2x = filletPoint.x + radius;
                    dimension.p2y = filletPoint.y;
                    dimension.extP1x = filletPoint.x;
                    dimension.extP1y = filletPoint.y;
                    dimension.extP2x = filletPoint.x + radius;
                    dimension.extP2y = filletPoint.y;
                    dimension.textX = filletPoint.x + radius / 2;
                    dimension.textY = filletPoint.y - 10;
                    dimension.filletPoint = filletPoint; // Referencja do punktu fillet

                    if (!existingDimension) {
                        CADApp.state.shapes.push(dimension);
                    }
                }
            };
