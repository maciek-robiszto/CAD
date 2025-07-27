var CADApp = CADApp || {};
CADApp.historyManager = {
                saveState: function() {
                    const { state } = CADApp;
                    state.history.length = state.historyIndex + 1; // Trim redo stack
                    state.history.push(JSON.parse(JSON.stringify(state.shapes)));
                    state.historyIndex++;
                    CADApp.ui.updateHistoryButtons();
                },
                undo: function() {
                    const { state } = CADApp;
                    if (state.historyIndex > 0) {
                        state.historyIndex--;
                        state.shapes = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
                        CADApp.drawing.draw();
                        CADApp.ui.updateHistoryButtons();
                    }
                },
                redo: function() {
                    const { state } = CADApp;
                    if (state.historyIndex < state.history.length - 1) {
                        state.historyIndex++;
                        state.shapes = JSON.parse(JSON.stringify(state.history[state.historyIndex]));
                        CADApp.drawing.draw();
                        CADApp.ui.updateHistoryButtons();
                    }
                }
};
