/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * BarChart is the main class for generating... bar charts (another surprise!).
 */
def
.type('pvc.BarChart', pvc.BarAbstract)
.add({
    _animatable: true,
    _trendable:  true,
    _allowV1SecondAxis: true, 
    
    /** @override */
    _createPlotsInternal: function() {
        this._addPlot(new pvc.visual.BarPlot(this));

        if(this.options.plot2) {
            // Line Plot
            this._addPlot(new pvc.visual.PointPlot(this, {
                name: 'plot2',
                fixed: {
                    DataPart: '1'
                },
                defaults: {
                    ColorAxis:    2,
                    LinesVisible: true,
                    DotsVisible:  true
                }}));
        }
    },
    
    /** @override */
    _createPlotTrend: function() {
        new pvc.visual.PointPlot(this, {
            name: 'trend',
            fixed: {
                DataPart:  'trend',
                TrendType: 'none',
                ColorRole: 'series', // one trend per series
                NullInterpolatioMode: 'none'
            },
            defaults: {
                ColorAxis:    2,
                LinesVisible: true,
                DotsVisible:  false
            }
        });
    },

    /** @override */
    _hasDataPartRole: function() {
        return true;
    },
    
    /** @override */
    _createContent: function(parentPanel, contentOptions) {
        
        this.base(parentPanel, contentOptions);

        // Legacy fields
        var barPanel = this.barChartPanel = this.plotPanels.bar;

        var plot2Panel = this.plotPanels.plot2;
        if(plot2Panel && plot2Panel.plot.type === 'point') {
            if(barPanel) {
                barPanel.pvSecondLine = plot2Panel.pvLine;
                barPanel.pvSecondDot  = plot2Panel.pvDot;
            }

            plot2Panel._applyV1BarSecondExtensions = true;
        }
    }
});
