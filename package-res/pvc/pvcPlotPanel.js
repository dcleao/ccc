/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** 
 * Registry of plot panel classes by type.
 * @type Object.<string, function>
 */
var pvc_plotPanelClassByType = {};

def
.type('pvc.PlotPanel', pvc.BasePanel)
.init(function(chart, parent, plot, options) {
    // Prevent the border from affecting the box model,
    // providing a static 0 value, independently of the actual drawn value...
    //this.borderWidth = 0;
    
    this.base(chart, parent, options);
    
    this.plot = plot;
    this._extensionPrefix = plot.extensionPrefixes;
    this.dataPartValue  = plot.option('DataPart');
    this.axes.color     = chart._getAxis('color', (plot.option('ColorAxis') || 0) - 1);
    this.orientation    = plot.option('Orientation'  );
    this.valuesVisible  = plot.option('ValuesVisible');
    this.valuesAnchor   = plot.option('ValuesAnchor' );
    this.valuesMask     = plot.option('ValuesMask'   );
    this.valuesFont     = plot.option('ValuesFont'   );
    this.valuesOverflow = plot.option('ValuesOverflow');
    this.valuesOptimizeLegibility = plot.option('ValuesOptimizeLegibility');
    
    var roles = this.visualRoles = Object.create(chart.visualRoles),
        colorRoleName = plot.option('ColorRole');

    roles.color = colorRoleName ? chart.visualRole(colorRoleName) : null;
})
.add({
    anchor:  'fill',

    visualRoles: null,

    /** @override */
    visibleData: function(ka) { return this.chart.visiblePlotData(this.plot, this.dataPartValue, ka); },

    _getExtensionId: function() {
        // NOTE: 'chart' is deprecated. Use 'plot'.
        return ['chart', 'plot'];
    },
    
    // For setting the renderer of a group scene.
    defaultLegendGroupScene: function() {
        var colorAxis = this.axes.color;
        if(colorAxis && colorAxis.option('LegendVisible') && colorAxis.isBound()) {
            return def
                .query(colorAxis.dataCells)
                .where (function(dataCell) { return dataCell.plot === this.plot; }, this)
                .select(function(dataCell) { return dataCell.legendGroupScene(); })
                .first(def.notNully);
        }
    },

    /* @override */
    isOrientationVertical: function() {
        return this.orientation === pvc.orientation.vertical;
    },

    /* @override */
    isOrientationHorizontal: function() {
        return this.orientation === pvc.orientation.horizontal;
    }
})
.addStatic({
    registerClass: function(Class, type) {
        pvc_plotPanelClassByType[type || Class.prototype.plotType] = Class;
    },

    getClass: function(type) {
        return def.getOwn(pvc_plotPanelClassByType, type);
    }
});