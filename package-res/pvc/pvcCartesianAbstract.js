/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * CartesianAbstract is the base class for all 2D cartesian space charts.
 */
def
.type('pvc.CartesianAbstract', pvc.BaseChart)
.init(function(options) {
    
    this.axesPanels = {};
    
    this.base(options);
})
.add({
    _gridDockPanel: null,
    
    axesPanels: null, 
    
    // V1 properties
    yAxisPanel: null,
    xAxisPanel: null,
    secondXAxisPanel: null,
    secondYAxisPanel: null,
    yScale: null,
    xScale: null,

    /** @override */    
    _hasDataPartRole: def.retTrue,

    _getSeriesRoleSpec: function() {
        return {isRequired: true, defaultDimension: 'series*', autoCreateDimension: true, requireIsDiscrete: true};
    },
    
    _getColorRoleSpec: function() {
        return {isRequired: true, defaultDimension: 'color*', defaultSourceRole: 'series', requireIsDiscrete: true};
    },
    
    /**
     * Creates a scale for a given axis, with domain applied, but no range yet,
     * assigns it to the axis and assigns the scale to special v1 chart instance fields.
     * 
     * @param {pvc.visual.Axis} axis The axis.
     * @param {number} chartLevel The chart level.
     */
    _setAxisScale: function(axis, chartLevel) {

        this.base(axis, chartLevel);
        
        var isOrtho = axis.type === 'ortho';
        var isCart  = isOrtho || axis.type === 'base';
        if(isCart) {
            /* V1 fields xScale, yScale, secondScale */
            if(isOrtho && axis.index === 1)
                this.secondScale = axis.scale;
            else if(!axis.index)
                this[axis.orientation + 'Scale'] = axis.scale;
        }
    },
    
    _createContent: function(parentPanel, contentOptions) {
        
        this._createFocusWindow();
        
        // Create the grid/docking panel
        this._gridDockPanel = new pvc.CartesianGridDockingPanel(this, parentPanel, {
            margins:  contentOptions.margins,
            paddings: contentOptions.paddings
        });
        
        // Create child axis panels.
        // The order is relevant because of docking order.
        ['base', 'ortho'].forEach(function(type) {
            var typeAxes = this.axesByType[type];
            if(typeAxes) def.query(typeAxes)
                .reverse()
                .each(function(axis) { this._createAxisPanel(axis); }, this);
        }, this);
        
        // Create plot content panels inside the grid docking panel
        this.base(this._gridDockPanel, {
            clickAction:       contentOptions.clickAction,
            doubleClickAction: contentOptions.doubleClickAction
        });
    },
    
    _createFocusWindow: function() {
        if(this.selectableByFocusWindow()) {
            // In case we're being re-rendered,
            // capture the axes' focusWindow, if any.
            // and set it as the next focusWindow.
            var fwData, fw = this.focusWindow;
            if(fw) fwData = fw._exportData();
            
            fw = this.focusWindow = new pvc.visual.CartesianFocusWindow(this);
            
            if(fwData) fw._importData(fwData);
            
            fw._initFromOptions();
            
        } else if(this.focusWindow) {
            delete this.focusWindow;
        }
    },
    
    /**
     * Creates an axis panel, if it is visible.
     * @param {pvc.visual.CartesianAxis} axis The cartesian axis.
     * @type pvc.AxisPanel
     */
    _createAxisPanel: function(axis) {
        if(axis.option('Visible')) {
            var titlePanel,
                title = axis.option('Title');

            if(!def.empty(title)) {
                titlePanel = new pvc.AxisTitlePanel(this, this._gridDockPanel, axis, {
                    title:        title,
                    font:         axis.option('TitleFont') || axis.option('Font'),
                    anchor:       axis.option('Position'),
                    align:        axis.option('TitleAlign'),
                    margins:      axis.option('TitleMargins'),
                    paddings:     axis.option('TitlePaddings'),
                    titleSize:    axis.option('TitleSize'),
                    titleSizeMax: axis.option('TitleSizeMax')
                });
            }
            
            var panel = new pvc.AxisPanel(this, this._gridDockPanel, axis, {
                anchor:            axis.option('Position'),
                size:              axis.option('Size'),
                sizeMax:           axis.option('SizeMax'),
                clickAction:       axis.option('ClickAction'),
                doubleClickAction: axis.option('DoubleClickAction'),
                useCompositeAxis:  axis.option('Composite'),
                font:              axis.option('Font'),
                labelSpacingMin:   axis.option('LabelSpacingMin'),
                grid:              axis.option('Grid'),
                gridCrossesMargin: axis.option('GridCrossesMargin'),
                ruleCrossesMargin: axis.option('RuleCrossesMargin'),
                zeroLine:          axis.option('ZeroLine'),
                desiredTickCount:  axis.option('DesiredTickCount'),
                showTicks:         axis.option('Ticks'),
                showMinorTicks:    axis.option('MinorTicks')
            });
            
            if(titlePanel) panel.titlePanel = titlePanel;
            
            this.axesPanels[axis.id] = panel;
            this.axesPanels[axis.orientedId] = panel;
            
            // Legacy fields
            if(axis.v1SecondOrientedId) this[axis.v1SecondOrientedId + 'AxisPanel'] = panel;
            
            return panel;
        }
    },
    
    _onLaidOut: function() {
        if(this.plotPanelList && this.plotPanelList[0]) { // not the root of a multi chart
            /* Set scale ranges, after layout */
            ['base', 'ortho'].forEach(function(type) {
                var axes = this.axesByType[type];
                if(axes) axes.forEach(this._setCartAxisScaleRange, this);
            }, this);
        }
    },
    
    _setCartAxisScaleRange: function(axis) {
        var info   = this.plotPanelList[0]._layoutInfo,
            size   = info.clientSize,
            length = (axis.orientation === 'x') ? size.width : size.height;
        
        axis.setScaleRange(length);

        return axis.scale;
    },
        
    _getAxesRoundingPaddings: function() {
        var axesPaddings = {};
        
        var axesByType = this.axesByType;
        ['base', 'ortho'].forEach(function(type) {
            var typeAxes = axesByType[type];
            if(typeAxes) typeAxes.forEach(processAxis);
        });
        
        return axesPaddings;
        
        function setSide(side, pct, locked) {
            var value = axesPaddings[side];
            if(value == null || pct > value) {
                axesPaddings[side] = pct;
                axesPaddings[side + 'Locked'] = locked;
            } else if(locked) {
                axesPaddings[side + 'Locked'] = locked;
            }
        }
        
        function processAxis(axis) {
            if(axis) {
                // {begin: , end: , beginLocked: , endLocked: }
                var tickRoundPads = axis.getScaleRoundingPaddings();
                if(tickRoundPads) {
                    var isX = axis.orientation === 'x';
                    setSide(isX ? 'left'  : 'bottom', tickRoundPads.begin, tickRoundPads.beginLocked);
                    setSide(isX ? 'right' : 'top'   , tickRoundPads.end,   tickRoundPads.endLocked);
                }
            }
        }
    },
    
    markEventDefaults: {
        strokeStyle: "#5BCBF5",        /* Line Color */
        lineWidth: "0.5",              /* Line Width */
        textStyle: "#5BCBF5",          /* Text Color */
        verticalOffset: 10,            /* Distance between vertical anchor and label */
        verticalAnchor: "bottom",      /* Vertical anchor: top or bottom */
        horizontalAnchor: "right",     /* Horizontal anchor: left or right */
        forceHorizontalAnchor: false,  /* Horizontal anchor position will be respected if true */
        horizontalAnchorSwapLimit: 80, /** @deprecated  Horizontal anchor will switch if less than this space available */
        font: '10px sans-serif'
    },
    
    // TODO: chart orientation 
    // TODO: horizontal lines 
    // TODO: discrete scales
    markEvent: function(sourceValue, label, options) {
        var me = this,
            baseAxis  = me.axes.base,
            orthoAxis = me.axes.ortho,
            baseRole  = baseAxis.role,
            baseScale = baseAxis.scale,
            baseDim   = me.data.owner.dimensions(baseRole.grouping.lastDimensionName());

        if(baseAxis.isDiscrete()) {
            me._warn("Can only mark events in charts with a continuous base scale.");
            return me;
        }

        var o = $.extend({}, me.markEventDefaults, options),
            pseudoAtom = baseDim.read(sourceValue, label),
            basePos    = baseScale(pseudoAtom.value),
            baseRange  = baseScale.range(),
            baseEndPos = baseRange[1];
        if(basePos < baseRange[0] || basePos > baseEndPos) {
            me._warn("Cannot mark event because it is outside the base scale's domain.");
            return me;
        }
        
        // Chart's main plot
        var pvPanel = this.plotPanelList[0].pvPanel,
            h = orthoAxis.scale.range()[1];

        // Detect where to place the label
        var ha = o.horizontalAnchor;
        if(!o.forceHorizontalAnchor) {
            var alignRight    = ha === "right",
                availableSize = alignRight ? (baseEndPos - basePos) : basePos,
                labelSize = pv.Text.measureWidth(pseudoAtom.label, o.font);
            if(availableSize < labelSize) ha = alignRight ? "left" : "right";
        }
        
        var topPos = o.verticalAnchor === "top" ? o.verticalOffset : (h - o.verticalOffset);
        
        // Shouldn't this be a pv.Rule?
        var line = pvPanel.add(pv.Line)
            .data([0, h])
            .bottom(def.identity) // from 0 to h
            .left  (basePos)
            .lineWidth  (o.lineWidth)
            .strokeStyle(o.strokeStyle);

        line.anchor(ha)
            .visible(function() { return !this.index; })
            .top(topPos)
            .add(pv.Label)
            .font(o.font)
            .text(pseudoAtom.label)
            .textStyle(o.textStyle);
        
        return me;
    },
    
    defaults: {
        /* Percentage of occupied space over total space in a discrete axis band */
        panelSizeRatio: 0.9,

        // Indicates that the *base* axis is a timeseries
        timeSeries: false,
        timeSeriesFormat: "%Y-%m-%d"
        
        // Show a frame around the plot area
        // plotFrameVisible: undefined
    }
});
