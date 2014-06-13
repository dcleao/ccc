/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initializes an abstract metric XY plot.
 * 
 * @name pvc.visual.MetricXYPlot
 * @class Represents an abstract metric XY plot.
 * @extends pvc.visual.CartesianPlot
 */
def
.type('pvc.visual.MetricXYPlot', pvc.visual.CartesianPlot)
.init(function(chart, keyArgs) {

    this.base(chart, keyArgs);

    this._addVisualRole('x', {
        isMeasure:  true,
        isRequired: true,
        requireSingleDimension: true,
        requireIsDiscrete: false,
        defaultDimension: 'x',
        dimensionDefaults: {
            valueType: chart.options.timeSeries ? Date : Number
        }
    });

    this._addVisualRole('y', {
        isMeasure:  true,
        isRequired: true,
        requireSingleDimension: true,
        requireIsDiscrete: false,
        defaultDimension: 'y',
        dimensionDefaults: {valueType: Number}
    });
})
.add({
    /** @override */
    _getOptionsDefinition: function() { return pvc.visual.MetricXYPlot.optionsDef; },

    /** @override */
    _getBaseRole: function() { return this.visualRole('x'); },

    /** @override */
    _getOrthoRoles: function() { return [this.visualRole('y')]; }
});

pvc.visual.MetricXYPlot.optionsDef = def.create(
    pvc.visual.CartesianPlot.optionsDef, {
        OrthoAxis: { // override -> value 1
            resolve: null
        }
    });