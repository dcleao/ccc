/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * MetricPointAbstract is the base class of metric dot and line.
 */
def
.type('pvc.MetricPointAbstract', pvc.MetricXYAbstract)
.add({
    _axisClassByType: {
        'size': pvc.visual.MetricPointSizeAxis
    },
    
    _trendable: true,

    /** @override */
    _createPlotsInternal: function() {
        this._addPlot(this._createPointPlot());
    },

    /** @abstract */
    _createPointPlot: function() {},

    /** @override */
    _createPlotTrend: function() {
        new pvc.visual.MetricPointPlot(this, {
            name: 'trend',
            fixed: {
                DataPart: 'trend',
                TrendType: 'none',
                NullInterpolatioMode: 'none',
                ColorRole: 'series', // one trend per series
                SizeRole:  null,
                SizeAxis:  null,
                OrthoAxis: 1
            },
            defaults: {
                ColorAxis:    2,
                LinesVisible: true,
                DotsVisible:  false
            }
        });
    },
    
    // Required because of trends
    /** @override */
    _hasDataPartRole: function() {
        return true;
    },
    
    /** @override */
    _getColorRoleSpec: function() {
        return {
            //isMeasure: true, // TODO: not being set as measure when continuous...
            defaultSourceRole: 'series',
            defaultDimension:  'color*',
            dimensionDefaults: {
                valueType: Number
            }
        };
    },
    
    /** @override */
    _initVisualRoles: function() {
        
        this.base();
        
        this._addVisualRole('size', {
            isMeasure: true,
            requireSingleDimension: true,
            requireIsDiscrete: false,
            defaultDimension: 'size',
            dimensionDefaults: {
                valueType: Number
            }
        });
    },
    
    /** @override */
    _getTranslationClass: function(translOptions) {
        return def
            .type(this.base(translOptions))
            .add(pvc.data.MetricPointChartTranslationOper);
    },
    
     /** @override */
    _createContent: function(parentPanel, contentOptions) {
        
        this.base(parentPanel, contentOptions);
        
        // Legacy fields
        this.scatterChartPanel = this.plotPanels.scatter;
    },

    
    
    defaults: {
        axisOriginIsZero: false,
        tooltipOffset: 10
    }
});

/**
 * Metric Dot Chart
 */
def
.type('pvc.MetricDotChart', pvc.MetricPointAbstract)
.add({
    /** @override */
    _createPointPlot: function() {
        return new pvc.visual.MetricPointPlot(this, {
            fixed: {DotsVisible: true}
        });
    }
});

/**
 * Metric Line Chart
 */
def
.type('pvc.MetricLineChart', pvc.MetricPointAbstract)
.add({
    /** @override */
    _createPointPlot: function() {
        return new pvc.visual.MetricPointPlot(this, {
            fixed: {LinesVisible: true}
        });
    }
});