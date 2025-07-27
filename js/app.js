var CADApp = CADApp || {};
CADApp.init = function() {
    this.ui.init();
    this.ui.resizeCanvas();
    this.events.setup();
    this.ui.updateHistoryButtons();
    this.ui.setActiveTool('select');
};
window.onload = () => CADApp.init();
