/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Normalized Bar Panel.
 */
def
.type('pvc.NormalizedBarPanel', pvc.BarAbstractPanel)
.add({
    plotType: 'bar',

    _barVerticalMode: function(){
        return 'expand';
    }
});

// TODO: pvc.PlotPanel.registerClass(pvc.NormalizedBarPanel);