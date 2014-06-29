/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initializes a normalized bar plot.
 * 
 * @name pvc.visual.NormalizedBarPlot
 * @class Represents a normalized bar plot.
 * @extends pvc.visual.BarPlotAbstract
 */
def
.type('pvc.visual.NormalizedBarPlot', pvc.visual.BarPlotAbstract)
.add({
    type: 'bar',

    /** @override */
    _getOptionsDefinition: function() { return pvc.visual.NormalizedBarPlot.optionsDef; },


    /** @override */
    createPanel: function(parentPanel, contentOptions) {
        new pvc.NormalizedBarPanel(
                parentPanel.chart,
                parentPanel,
                this,
                Object.create(contentOptions));
    }
});

// TODO: pvc.visual.Plot.registerClass(pvc.visual.NormalizedBarPlot) cannot register under same name...

pvc.visual.NormalizedBarPlot.optionsDef = def.create(
    pvc.visual.BarPlotAbstract.optionsDef, 
    {
        Stacked: {
            resolve: null, 
            value: true
        }
    });
