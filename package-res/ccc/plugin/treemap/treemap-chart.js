/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

def
.type('pvc.TreemapChart', pvc.BaseChart)
.add({
    _axisClassByType: {
        'size': pvc.visual.NormalizedAxis
    },

    // Create color axis, even if the role is unbound
    // cause we need to check the axis options any way
    _axisCreateIfUnbound: {
        'color': true
    },
    
    _getTranslationClass: function(translOptions) {
        return def.type(this.base(translOptions)).add(pvc.data.TreemapChartTranslationOper);
    },
    
    // Consider all datums to be not-null.
    // All measures are optional...
    // @override
    _getIsNullDatum: def.fun.constant(),
    
    _createPlotsInternal: function() {
        var treemapPlot = new pvc.visual.TreemapPlot(this);
        
        this._addPlot(treemapPlot);
        
        if(this.options.legend == null)
            // Only show the legend by default if color mode is byparent
            this.options.legend = treemapPlot.option('ColorMode') === 'byparent';
        
        var rootCategoryLabel = treemapPlot.option('RootCategoryLabel');
        this.visualRoles.category.setRootLabel(rootCategoryLabel);
        this.visualRoles.color   .setRootLabel(rootCategoryLabel);
    },
    
    _initAxes: function(hasMultiRole) {
        if(this.visualRoles.color.isDiscrete()) {
            // Switch to custom Treemap color-axis class
            //  that handles derived colors calculation.
            // Class shared object. Take care to inherit from it before changing.
            if(!def.hasOwnProp.call(this, '_axisClassByType'))
                this._axisClassByType = Object.create(this._axisClassByType);

            this._axisClassByType.color = pvc.visual.TreemapDiscreteColorAxis;
        } else {
            // Revert to default color axis class
            delete this._axisClassByType;
        }
        
        return this.base(hasMultiRole);
    },
    
    defaults: {
        legend: null  // dynamic default, when nully
    }
});
