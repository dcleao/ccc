/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global pvc_Sides:true */

def
.type('pvc.CartesianAbstractPanel', pvc.PlotPanel)
.init(function(chart, parent, plot, options) {

    // Prevent the border from affecting the box model,
    // providing a static 0 value, independently of the actual drawn value...
    //this.borderWidth = 0;

    this.base(chart, parent, plot, options);

    var axes = this.axes;

    function addAxis(axis) {
        axes[axis.type] = axis;

        // TODO: are these really needed??
        axes[axis.orientedId] = axis;
        if(axis.v1SecondOrientedId) axes[axis.v1SecondOrientedId] = axis;
    }

    addAxis(chart._getAxis('base',  plot.option('BaseAxis' ) - 1));
    addAxis(chart._getAxis('ortho', plot.option('OrthoAxis') - 1));

    // ----------------

    // Initialize paddings from **chart** axes offsets
    // TODO: move this to the chart??
    var pctPaddings = {};
    var hasAny = false;

    function setSide(side, pct) {
        var value = pctPaddings[side];
        if(value == null || pct > value) {
            hasAny = true;
            pctPaddings[side] = pct;
        }
    }

    function processAxis(axis) {
        var offset = axis && axis.option('Offset');
        if(offset != null && offset > 0 && offset < 1) {
            if(axis.orientation === 'x') {
                setSide('left',  offset);
                setSide('right', offset);
            } else {
                setSide('top',    offset);
                setSide('bottom', offset);
            }
        }
    }

    var chartAxes = chart.axesByType;

    ['base', 'ortho'].forEach(function(type) {
        var typeAxes = chartAxes[type];
        if(typeAxes) typeAxes.forEach(processAxis);
    });

    if(hasAny) this.offsetPaddings = pctPaddings;
})
.add({

    offsetPaddings: null,

    _calcLayout: function(layoutInfo) {
        layoutInfo.requestPaddings = this._calcRequestPaddings(layoutInfo);
    },

    _calcRequestPaddings: function(layoutInfo) {
        var reqPads;
        var offPads = this.offsetPaddings;
        if(offPads) {
            var tickRoundPads = this.chart._getAxesRoundingPaddings();
            var clientSize = layoutInfo.clientSize;
            var pads       = layoutInfo.paddings;

            pvc_Sides.names.forEach(function(side) {
                var len_a = pvc.BasePanel.orthogonalLength[side],
                    clientLen  = clientSize[len_a],
                    paddingLen = pads[len_a],
                    len = clientLen + paddingLen;

                // Only request offset-padding if the tickRoundPads.side is not locked
                if(!tickRoundPads[side + 'Locked']) {
                    // Offset paddings are a percentage of the outer length
                    // (there are no margins in this panel).
                    var offLen = len * (offPads[side] || 0),

                        // Rounding paddings are the percentage of the
                        // client length that already actually is padding
                        // due to domain rounding.
                        roundLen = clientLen * (tickRoundPads[side] || 0);

                    // So, if the user wants offLen padding but the
                    // client area already contains roundLen of padding,
                    // request only the remaining, if any.
                    (reqPads || (reqPads = {}))[side] = Math.max(offLen - roundLen, 0);
                }
            }, this);
        }

        return reqPads;
    },

    /**
     * @override
     */
    _createCore: function() {
        // Send the panel behind the axis, title and legend, panels
        this.pvPanel.zOrder(-10);

        var hideOverflow;
        var contentOverflow = this.chart.options.leafContentOverflow || 'auto';
        if(contentOverflow === 'auto') {
            // Overflow
            hideOverflow =
                def
                .query(['ortho', 'base'])
                .select(function(axisType) { return this.axes[axisType]; }, this)
                .any(function(axis) {
                    return axis.option('FixedMin') != null ||
                           axis.option('FixedMax') != null;
                });
        } else {
            hideOverflow = (contentOverflow === 'hidden');
        }

        if(hideOverflow) {
            // Padding area is used by bubbles and other vizs without problem
            this.pvPanel.borderPanel.overflow('hidden');
        }
    }
});