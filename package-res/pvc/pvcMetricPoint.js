/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * MetricPointAbstract is the base class of metric dot and line.
 */
def
.type('pvc.MetricPointAbstract', pvc.MetricXYAbstract)
.add({
    _trendable: true,

    _initPlotsCore: function(){
        var pointPlot = this._createPointPlot();
        
        var trend = pointPlot.option('Trend');
        if((this._trendable = !!trend)) {
            // Trend Plot
            new pvc.visual.MetricPointPlot(this, {
                name: 'trend',
                fixed: {
                    DataPart: 'trend',
                    TrendType: 'none',
                    NullInterpolatioMode: 'none',
                    ColorRole: 'series', // one trend per series
                    SizeRole:  null,
                    SizeAxis:  null,
                    OrthoAxis:    1
                },
                defaults: {
                    ColorAxis:    2,
                    LinesVisible: true,
                    DotsVisible:  false
                }
            });
        }
    },
    
    //_createPointPlot: function(){},
    
    /* Required because of trends */
    _hasDataPartRole: function(){
        return true;
    },
    
    _getColorRoleSpec: function(){
        return {
            //isMeasure: true, // TODO: not being set as measure when continuous...
            defaultSourceRole: 'series',
            defaultDimension:  'color*',
            dimensionDefaults: {
                valueType: Number
            }
        };
    },
    
    /**
     * Initializes each chart's specific roles.
     * @override
     */
    _initVisualRoles: function(){
        
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
    
    _getTranslationClass: function(translOptions) {
        return def
            .type(this.base(translOptions))
            .add(pvc.data.MetricPointChartTranslationOper);
    },
    
     /** @override */
    _createContent: function(parentPanel, contentOptions) {
        
        this.base(parentPanel, contentOptions);
        
        // TODO: integrate these options in the MetricPointPlot or in the SizeAxis?
        var options = this.options;
        var panelOptions = def.set(
            Object.create(contentOptions),
            'sizeAxisRatio',        options.sizeAxisRatio,
            'sizeAxisRatioTo',      options.sizeAxisRatioTo,
            'autoPaddingByDotSize', options.autoPaddingByDotSize);
        
        var scatterPlot = this.plots.scatter;
            this.scatterChartPanel = // V1 property 
            new pvc.MetricPointPanel(this, parentPanel, scatterPlot, panelOptions);

        var trendPlot = this.plots.trend;
        if(trendPlot) {
            new pvc.MetricPointPanel(
                this, 
                parentPanel, 
                trendPlot, 
                Object.create(panelOptions));
        }
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
    _createPointPlot: function(){
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
    _createPointPlot: function(){
        return new pvc.visual.MetricPointPlot(this, {
            fixed: {LinesVisible: true}
        });
    }
});