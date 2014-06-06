/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A NormalizedBarChart is a 100% stacked bar chart.
 */
def
.type('pvc.NormalizedBarChart', pvc.BarAbstract)
.add({
    
    /**
     * Processes options after user options and default options have been merged.
     * @override
     */
    _processOptionsCore: function(options){
        // Still affects default data cell settings
        options.stacked = true;

        this.base(options);
    },

    /**
     * @override
     */
    _getContinuousVisibleExtentConstrained: function(axis, min, max){
        if(axis.type === 'ortho') {
            /* 
             * Forces showing 0-100 in the axis.
             * Note that the bars are stretched automatically by the band layout,
             * so this scale ends up being ignored by the bars.
             * Note also that each category would have a different scale,
             * so it isn't possible to provide a single correct scale,
             * that would satisfy all the bars...
             */
            return {min: 0, max: 100, minLocked: true, maxLocked: true};
        }

        return this.base(axis, min, max);
    },
    
    _initPlotsCore: function(hasMultiRole){
        
        new pvc.visual.NormalizedBarPlot(this);
    },
    
    /* @override */
    _createContent: function(parentPanel, contentOptions) {
        
        this.base(parentPanel, contentOptions);
        
        var barPlot = this.plots.bar;
        
        this.barChartPanel = 
            new pvc.NormalizedBarPanel(
                this, 
                parentPanel, 
                barPlot, 
                Object.create(contentOptions));
    }
});