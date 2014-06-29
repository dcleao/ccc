/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global pvc_Sides:true, pvc_Size:true */
def
.type('pvc.BaseChart', pvc.Abstract)
.add(pvc.visual.Interactive)
.init(function(options) {
    var originalOptions = options;
    
    var parent = this.parent = def.get(options, 'parent') || null;
    if(parent) {
        /*jshint expr:true */
        options || def.fail.argumentRequired('options');
    } else {
        if(pvc_initChartClassDefaults) pvc_initChartClassDefaults();
        options = def.mixin.copy({}, this.defaults, options);
    }

    this.options = options;

    if(parent) {
        this.root = parent.root;
        this.smallColIndex = options.smallColIndex; // required for the logId mask, setup in base
        this.smallRowIndex = options.smallRowIndex;
    } else {
        this.root = this;
        this._format = cdo.format();
    }

    this.base();
    
    if(pvc.debug >= 3)
        this._info("NEW CHART\n" + pvc.logSeparator.replace(/-/g, '=') + 
                "\n  DebugLevel: " + pvc.debug);
    
    /* DEBUG options */
    if(pvc.debug >= 3 && !parent && originalOptions) {
        this._info("OPTIONS:\n", originalOptions);
        if(pvc.debug >= 5)
            // Log also as text, for easy copy paste of options JSON
            this._trace(pvc.stringify(originalOptions, {ownOnly: false, funs: true}));
    }
    
    if(parent) parent._addChild(this);

    this._constructData(options);
    this._constructVisualRoles(options);
})
.add({
    /**
     * Indicates if the chart has been disposed.
     */
    _disposed: false,

    /**
     * The chart's parent chart.
     * 
     * <p>
     * The root chart has null as the value of its parent property.
     * </p>
     * 
     * @type pvc.BaseChart
     */
    parent: null,
    
    /**
     * The chart's child charts.
     * 
     * @type pvc.BaseChart[]
     */
    children: null,
    
    /**
     * The chart's root chart.
     * 
     * <p>
     * The root chart has itself as the value of the root property.
     * </p>
     * 
     * @type pvc.BaseChart
     */
    root: null,

    /**
     * Indicates if the chart has been created.
     * <p>
     * This field is set to <tt>false</tt>
     * at the beginning of the {@link #_create} method
     * and set to <tt>true</tt> at the end.
     * </p>
     * <p>
     * When a chart is re-rendered it can, 
     * optionally, also repeat the creation phase. 
     * </p>
     * 
     * @type boolean
     */
    isCreated: false,

    /**
     * The version value of the current/last creation.
     * 
     * <p>
     * This value is changed on each creation of the chart.
     * It can be useful to invalidate cached information that 
     * is only valid for each creation.
     * </p>
     * <p>
     * Version values can be compared using the identity operator <tt>===</tt>.
     * </p>
     * 
     * @type any
     */
    _createVersion: 0,
    
    /**
     * A callback function that is called 
     * when the protovis' panel render is about to start.
     * 
     * <p>
     * Note that this is <i>after</i> the creation phase.
     * </p>
     * 
     * <p>
     * The callback is called with no arguments, 
     * but having the chart instance as its context (<tt>this</tt> value). 
     * </p>
     * 
     * @function
     */
    renderCallback: undefined,

    /**
     * Contains the number of pages that a multi-chart contains
     * when rendered with the previous render options.
     * <p>
     * This property is updated after a render of a chart
     * where the visual role "multiChart" is assigned and
     * the option "multiChartPageIndex" has been specified. 
     * </p>
     * 
     * @type number|null
     */
    multiChartPageCount: null,
    
    /**
     * Contains the currently rendered multi-chart page index, 
     * relative to the previous render options.
     * <p>
     * This property is updated after a render of a chart
     * where the visual role "multiChart" is assigned and
     * the <i>option</i> "multiChartPageIndex" has been specified. 
     * </p>
     * 
     * @type number|null
     */
    multiChartPageIndex: null,
    
    _multiChartOverflowClipped: false,

    left: 0,
    top:  0,
    
    width: null,
    height: null,
    margins:  null,
    paddings: null,

    _allowV1SecondAxis: false, 
        
    //------------------
    compatVersion: function(options) { return (options || this.options).compatVersion; },
    
    _createLogInstanceId: function() {
        return "" + this.constructor + this._createLogChildSuffix();
    },
    
    _createLogChildSuffix: function() {
        return this.parent ? 
               (" (" + (this.smallRowIndex + 1) + "," + 
                       (this.smallColIndex + 1) + ")") : 
               "";
    },
    
    _addChild: function(childChart) {
        /*jshint expr:true */
        (childChart.parent === this) || def.assert("Not a child of this chart.");
        
        this.children.push(childChart);
    },
    
    /**
     * Building the visualization is made in 2 stages:
     * First, the {@link #_create} method prepares and builds 
     * every object that will be used.
     * 
     * Later the {@link #render} method effectively renders.
     */
    _create: function(keyArgs) {
        this._createPhase1(keyArgs);
        this._createPhase2(keyArgs);
    },
    
    _createPhase1: function(keyArgs) {
        /* Increment create version to allow for cache invalidation  */
        this._createVersion++;
        
        this.isCreated = false;
        
        if(pvc.debug >= 3) this._log("Creating");
        
        this.children = [];

        // Now's as good a time as any to completely clear out all tipsy tooltips
        if(!this.parent) pvc.removeTipsyLegends();
        
        // Options may be changed between renders
        this._processOptions();
        
        // Any data exists or throws
        // (must be done AFTER processing options
        //  because of width, height properties and noData extension point...)
        if(!this.parent) this._checkNoDataI();

        // Initialize chart-level/root visual roles.
        if(!this.parent && !this.data) this._initVisualRoles();

        // Initialize plots. These also define own visualRoles.
        this._initPlots();

        // Gather potential plots' data cells:
        //   {plot, visualRole, dataPart, axisType, axisIndex}
        //  The visual role of some may not become bound.
        this._initPlotsDataCells();

        // The Complex Type gets defined on the first load of data.
        if(!this.parent && !this.data) {
            this._bindVisualRolesPreI();
            
            this._complexTypeProj = this._createComplexTypeProject();
            
            this._bindVisualRolesPreII();
        }
        
        // Initialize the data (and _bindVisualRolesPost)
        this._initData(keyArgs);

        // When data is excluded, there may be no data after all
        if(!this.parent) this._checkNoDataII();
        
        var hasMultiRole = this.visualRoles.multiChart.isBound(),
            // 1 = root, 2 = leaf, 1 | 2 = 3 = everywhere
            chartLevel = this._chartLevel();
        
        this._initAxes(hasMultiRole);

        if(hasMultiRole && !this.parent) this._initMultiCharts();

        // Trends and Interpolation on Root Chart only
        if(!this.parent) {
            // Interpolated data affects generated trends
            this._interpolate(hasMultiRole);
            this._generateTrends(hasMultiRole);
        }
        
        this._setAxesScales(chartLevel);
    },

    _createPhase2: function(/*keyArgs*/) {
        var hasMultiRole = this.visualRoles.multiChart.isBound();
        
        // Initialize chart panels
        this._initChartPanels(hasMultiRole);
        
        this.isCreated = true;
    },

    _setSmallLayout: function(keyArgs) {
        if(keyArgs) {
            var me = this, basePanel = me.basePanel;

            function setProp(p) {
                var v = keyArgs[p];
                if(v != null) return (me[p] = v), true;
            }

            // NOTE: bitwise or is on purpose so that both are always evaluated
            //noinspection JSBitwiseOperatorUsage
            if((setProp('left') | setProp('top')) && basePanel)
                def.set(basePanel.position, 'left', this.left, 'top', this.top);
            
            //noinspection JSBitwiseOperatorUsage
            if((setProp('width') | setProp('height')) && basePanel)
                basePanel.size = new pvc_Size(this.width, this.height);
            
            if(setProp('margins' ) && basePanel) basePanel.margins  = new pvc_Sides(this.margins );
            if(setProp('paddings') && basePanel) basePanel.paddings = new pvc_Sides(this.paddings);
        }
    },

    /**
     * Processes options after user options and defaults have been merged.
     * Applies restrictions,
     * performs validations and
     * options values implications.
     */
    _processOptions: function() {
        var options = this.options;
        if(!this.parent) {
            this.width    = options.width;
            this.height   = options.height;
            this.margins  = options.margins;
            this.paddings = options.paddings;
        }

        if(this.compatVersion() <= 1) options.plot2 = this._allowV1SecondAxis && !!options.secondAxis;

        this._processFormatOptions(options);

        this._processDataOptions(options);

        this._processOptionsCore(options);

        this._processExtensionPoints();

        return options;
    },

    /**
     * Processes options after user options and default options have been merged.
     * Override to apply restrictions, perform validation or
     * options values implications.
     * When overridden, the base implementation should be called.
     * The implementation must be idempotent -
     * its successive application should yield the same results.
     * @virtual
     */
    _processOptionsCore: function(options) {
        if(!this.parent) {
            var interactive = (pv.renderer() !== 'batik');
            if(interactive && (interactive = options.interactive) == null) interactive = true;

            var ibits = 0;
            if(interactive) {
                var I = pvc.visual.Interactive;
                ibits = I.Interactive | I.ShowsInteraction;

                if(this._processTooltipOptions(options)) ibits |= I.ShowsTooltip;

                // NOTE: VML animations perform really bad,
                //  and so its better for the user experience to be deactivated.
                if(options.animate && $.support.svg) ibits |= I.Animatable;

                var preventUnselect = false;
                if(options.selectable) {
                    ibits |= I.Selectable;

                    switch(pvc.parseSelectionMode(options.selectionMode)) {
                        case 'rubberband':
                            ibits |= (I.SelectableByRubberband | I.SelectableByClick);
                            break;

                        case 'focuswindow':
                            ibits |= I.SelectableByFocusWindow;
                            preventUnselect = true;
                            break;
                    }
                }

                if(!preventUnselect && pvc.parseClearSelectionMode(options.clearSelectionMode) === 'emptyspaceclick')
                    ibits |= I.Unselectable;

                if(options.hoverable) ibits |= I.Hoverable;
                if(options.clickable) ibits |= (I.Clickable | I.DoubleClickable);
            }
        } else {
            ibits = this.parent._ibits;
            this._tooltipOptions = this.parent._tooltipOptions;
        }
        this._ibits = ibits;
    },

    _tooltipDefaults: {
        gravity:     's',
        delayIn:      200,
        delayOut:     80, // smoother moving between marks with tooltips, possibly slightly separated
        offset:       2,
        opacity:      0.9,
        html:         true,
        fade:         true,
        useCorners:   false,
        arrowVisible: true,
        followMouse:  false,
        format:       undefined,
        className:    ''
    },

    _processTooltipOptions: function(options) {
        var isV1Compat = this.compatVersion() <= 1,
            tipOptions = options.tooltip,
            tipEnabled = options.tooltipEnabled;

        if(tipEnabled == null) {
            if(tipOptions) tipEnabled = tipOptions.enabled;
            if(tipEnabled == null) {
                if(isV1Compat) tipEnabled = options.showTooltips;
                if(tipEnabled == null) tipEnabled = true;
            }
        }

        if(tipEnabled) {
            if(!tipOptions) tipOptions = {};
            else tipOptions = def.copy(tipOptions);

            if(isV1Compat) this._importV1TooltipOptions(tipOptions, options);

            def.eachOwn(this._tooltipDefaults, function(dv, p) {
                var value = options['tooltip' + def.firstUpperCase(p)];
                if(value !== undefined)
                    tipOptions[p] = value;
                else if(tipOptions[p] === undefined)
                    tipOptions[p] = dv;
            });
        } else {
            tipOptions = {};
        }

        this._tooltipOptions = tipOptions;

        return tipEnabled;
    },

    _importV1TooltipOptions: function(tipOptions, options) {
        var v1TipOptions = options.tipsySettings;
        if(v1TipOptions) {
            this.extend(v1TipOptions, 'tooltip');

            for(var p in v1TipOptions) if(tipOptions[p] === undefined) tipOptions[p] = v1TipOptions[p];

            // Force V1 html default
            if(tipOptions.html == null) tipOptions.html = false;
        }
    },

    _processFormatOptions: function(options) {
        if(!this.parent) {
            var format = options.format;
            if(format != undefined) this.format(format);

            var fp = this._format;
            this._processFormatOption(options, fp, 'number',  'valueFormat');
            this._processFormatOption(options, fp, 'percent', 'percentValueFormat');
        }
    },

    _processFormatOption: function(options, formatProvider, formatName, optionName) {
        // Was the format explicitly set through the new interface?
        var format = formatProvider[formatName]();
        if(format !== cdo.format.defaults[formatName]()) {
            // The new interface takes precedence over the legacy options property.
            options[optionName] = format;
        } else {
            // Was it explicitly set through the old interface?
            var optionFormat = options[optionName];
            if(optionFormat && optionFormat !== format) {
                if(!optionFormat._nullWrapped) {
                    // Force no null handling, as in V1's valueFormat.
                    options[optionName] = optionFormat = pv.Format.createFormatter(optionFormat);
                    optionFormat._nullWrapped = 1;
                }

                // Set it in the chart's default format.
                formatProvider[formatName](optionFormat);
            }
        }
    },

    _processDataOptions: function(options) {
        if(!this.parent) {
            var dataSeparator = options.dataSeparator;
            if(dataSeparator === undefined) {
                var dataOptions = options.dataOptions;
                if(dataOptions) dataSeparator = dataOptions.separator;
            }
            options.dataSeparator = dataSeparator || '~';
        }
    },

    // --------------

    /**
     * Gets, sets or configures the chart-level format provider.
     *
     * Always affects the root chart's format provider.
     *
     * @param {cdo.FormatProvider|object|any} [_] The new format provider,
     * a configuration object, or any other configuration value supported by
     * the format provider class.
     *
     * @return {pvc.BaseChart|cdo.FormatProvider} <tt>this</tt> or the current format provider.
     */
    format: function(_) {
        var r = this.root;
        if(r !== this) return r.format.apply(r, arguments);

        var v1 = this._format;
        if(arguments.length) {
            if(!_) throw def.error.argumentRequired('format');
            if(_ !== v1) {
                if(!def.is(_, formProvider)) {
                    if(v1) return def.configure(v1, _), this;

                    _ = formProvider(_);
                }
                this._format = _;
            }
            return this;
        }
        return v1;
    },

    // --------------

    /**
     * Render the visualization.
     * If not created, do it now.
     */
    render: function(bypassAnimation, recreate, reloadData) {
        var hasError;

        /*global console:true*/
        if(pvc.debug > 1) pvc.group("CCC RENDER");

        // Don't let selection change events to fire before the render is finished
        this._suspendSelectionUpdate();
        try {
            this.useTextMeasureCache(function() {
                try {
                    while(true) {
                        if(!this.isCreated || recreate)
                            this._create({reloadData: reloadData});
                        else if(!this.parent && this.isCreated)
                            pvc.removeTipsyLegends();

                        // TODO: Currently, the following always redirects the call
                        // to topRoot.render;
                        // so why should BaseChart.render not do the same?
                        this.basePanel.render({
                            bypassAnimation: bypassAnimation,
                            recreate: recreate
                        });

                        // Check if it is necessary to retry the create
                        // due to multi-chart clip overflow.
                        if(!this._isMultiChartOverflowClip) {
                            // NO
                            this._isMultiChartOverflowClipRetry = false;
                            break;
                        }

                        // Overflowed & Clip
                        recreate   = true;
                        reloadData = false;
                        this._isMultiChartOverflowClipRetry = true;
                        this._isMultiChartOverflowClip = false;
                        this._multiChartOverflowClipped = true;
                    }
                } catch (e) {
                    /*global NoDataException:true*/
                    if(e instanceof NoDataException) {
                        if(pvc.debug > 1) this._log("No data found.");
                        this._addErrorPanelMessage("No data found", true);
                    } else {
                        hasError = true;

                        // We don't know how to handle this
                        pvc.logError(e.message);

                        if(pvc.debug > 0) this._addErrorPanelMessage("Error: " + e.message, false);
                        //throw e;
                    }
                }
            });
        } finally {
            if(!hasError) this._resumeSelectionUpdate();
            if(pvc.debug > 1) pvc.groupEnd();
        }
        return this;
    },

    _addErrorPanelMessage: function(text, isNoData) {
        var options = this.options,
            pvPanel = new pv.Panel()
                        .canvas(options.canvas)
                        .width(this.width)
                        .height(this.height),
            pvMsg = pvPanel.anchor("center").add(pv.Label)
                        .text(text);

        if(isNoData) this.extend(pvMsg, "noDataMessage");

        pvPanel.render();
    },

    useTextMeasureCache: function(fun, ctx) {
        var root = this.root,
            textMeasureCache = root._textMeasureCache ||
                               (root._textMeasureCache = pv.Text.createCache());

        return pv.Text.usingCache(textMeasureCache, fun, ctx || this);
    },

    /**
     * Animation
     */
    animate: function(start, end) { return this.basePanel.animate(start, end); },

    /**
     * Indicates if the chart is currently
     * rendering the animation start phase.
     * <p>
     * Prefer using this function instead of {@link #animate}
     * whenever its <tt>start</tt> or <tt>end</tt> arguments
     * involve a non-trivial calculation.
     * </p>
     *
     * @type boolean
     */
    animatingStart: function() { return this.basePanel.animatingStart(); },

    isOrientationVertical: function(orientation) {
        return (orientation || this.options.orientation) === pvc.orientation.vertical;
    },

    isOrientationHorizontal: function(orientation) {
        return (orientation || this.options.orientation) === pvc.orientation.horizontal;
    },

    /**
     * Disposes the chart, any of its panels and child charts.
     */
    dispose: function() {
        if(!this._disposed) {

            // TODO: implement chart dispose

            this._disposed = true;
        }
    },

    defaults: {
//        canvas: null,

        width:  400,
        height: 300,

//      margins:  undefined,
//      paddings: undefined,
//      contentMargins:  undefined,
//      contentPaddings: undefined,
//      leafContentOverflow: 'auto',
//      multiChartMax: undefined,
//      multiChartColumnsMax: undefined,
//      multiChartSingleRowFillsHeight: undefined,
//      multiChartSingleColFillsHeight: undefined,
//      multiChartOverflow: 'grow',

//      smallWidth:       undefined,
//      smallHeight:      undefined,
//      smallAspectRatio: undefined,
//      smallMargins:     undefined,
//      smallPaddings:    undefined,

//      smallContentMargins:  undefined,
//      smallContentPaddings: undefined,
//      smallTitlePosition: undefined,
//      smallTitleAlign:    undefined,
//      smallTitleAlignTo:  undefined,
//      smallTitleOffset:   undefined,
//      smallTitleKeepInBounds: undefined,
//      smallTitleSize:     undefined,
//      smallTitleSizeMax:  undefined,
//      smallTitleMargins:  undefined,
//      smallTitlePaddings: undefined,
//      smallTitleFont:     undefined,

        orientation: 'vertical',

//        extensionPoints:   undefined,
//
//        visualRoles:       undefined,
//        dimensions:        undefined,
//        dimensionGroups:   undefined,
//        calculations:      undefined,
//        readers:           undefined,

        ignoreNulls:       true, // whether to ignore or keep "null"-measure datums upon loading
        crosstabMode:      true,
//        multiChartIndexes: undefined,
        isMultiValued:     false,
        seriesInRows:      false,
        groupedLabelSep:   undefined,
//        measuresIndexes:   undefined,
//        dataOptions:       undefined,
//        dataSeparator
//        dataMeasuresInColumns
//        dataCategoriesCount
//        dataIgnoreMetadataLabels: false

//        timeSeries:        undefined,
//        timeSeriesFormat:  undefined,

        animate: true,

//        title:         null,

        titlePosition: "top", // options: bottom || left || right
        titleAlign:    "center", // left / right / center
//        titleAlignTo:  undefined,
//        titleOffset:   undefined,
//        titleKeepInBounds: undefined,
//        titleSize:     undefined,
//        titleSizeMax:  undefined,
//        titleMargins:  undefined,
//        titlePaddings: undefined,
//        titleFont:     undefined,

        legend:           false, // Show Legends
        legendPosition:   "bottom",
//        legendFont:       undefined,
//        legendSize:       undefined,
//        legendSizeMax:    undefined,
//        legendAlign:      undefined,
//        legendAlignTo:    undefined,
//        legendOffset:     undefined,
//        legendKeepInBounds:   undefined,
//        legendMargins:    undefined,
//        legendPaddings:   undefined,
//        legendTextMargin: undefined,
//        legendItemPadding:    undefined, // ATTENTION: this is different from legendPaddings
//        legendMarkerSize: undefined,

//        colors: null,

        v1StyleTooltipFormat: function(s, c, v, datum) {
            return s + ", " + c + ":  " + this.chart.options.valueFormat(v) +
                   (datum && datum.percent ? ( " (" + datum.percent.label + ")") : "");
        },

        // Initialized lazily, upon first chart creation.
        //valueFormat:        cdo.numberFormat("#,0.##"),
        //percentValueFormat: cdo.numberFormat("#,0.#%"),
        
        //interactive: true,
        
        // Content/Plot area clicking
        clickable:  false,
//        clickAction: null,
//        doubleClickAction: null,
        doubleClickMaxDelay: 300, //ms
//      
        hoverable:  false,
        
        selectable:    false,
        selectionMode: 'rubberband', // focuswindow, // single (click-only) // custom (by code only)
        //selectionCountMax: 0, // <= 0 -> no limit
        
//        selectionChangedAction: null,
//        userSelectionAction: null, 
            
        // Use CTRL key to make fine-grained selections
        ctrlSelectMode: true,
        clearSelectionMode: 'emptySpaceClick', // or null <=> 'manual' (i.e., by code)
        
//        renderCallback: undefined,

        compatVersion: Infinity // numeric, 1 currently recognized
    }
});

var pvc_initChartClassDefaults = function() {
    var defaults = pvc.BaseChart.prototype.defaults;

    // Initialize CCC global defaults for valueFormat and percentValueFormat.
    // Lazy initialization of formats allows changing global default styles after ccc files' loading.
    if(!defaults.valueFormat)        defaults.valueFormat        = formProvider.defaults.number ();
    if(!defaults.percentValueFormat) defaults.percentValueFormat = formProvider.defaults.percent();
    pvc_initChartClassDefaults = null;
};
