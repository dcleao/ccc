/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initializes an abstract categorical plot.
 * 
 * @name pvc.visual.CategoricalPlot
 * @class Represents an abstract categorical plot.
 * @extends pvc.visual.CartesianPlot
 */
def
.type('pvc.visual.CategoricalPlot', pvc.visual.CartesianPlot)
.add({
    /** @override */
    createVisibleData: function(baseData, ka) {
        var serRole = this.chart.visualRoles.series,
            serGrouping = serRole && serRole.flattenedGrouping(),
            catGrouping = this.chart.visualRoles.category.flattenedGrouping();

        return serGrouping 
            // <=> One multi-dimensional, two-levels data grouping
            ? baseData.groupBy(def.get(ka, 'inverted', false) 
                    ? [serGrouping, catGrouping] 
                    : [catGrouping, serGrouping], 
                    ka)
            : baseData.groupBy(catGrouping, ka);
    },

    _getOptionsDefinition: function(){
        return pvc.visual.CategoricalPlot.optionsDef;
    }
});

pvc.visual.CategoricalPlot.optionsDef = def.create(
    pvc.visual.CartesianPlot.optionsDef, {
    
    Stacked: {
        resolve: '_resolveFull',
        cast:    Boolean,
        value:   false
    },
    
    BaseRole: {
        value: 'category'
    },
    
    OrthoRole: { // override 
        value: 'value'
    }
});
