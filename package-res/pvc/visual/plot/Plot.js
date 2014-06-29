/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/** 
 * Registry of plot classes by type.
 * @type Object.<string, function>
 */
var pvc_plotClassByType = {};

/**
 * Initializes a plot.
 * 
 * @name pvc.visual.Plot
 * @class Represents a plot.
 * @extends pvc.visual.OptionsBase
 * @constructor
 * @param {pvc.BaseChart} chart The associated chart.
 * @param {object} [keyArgs] Keyword arguments. See the base class for more information.
 * @param {string} [keyArgs.optionId] The option id to use.
 *     Defaults to the <i>id</i>.
 */
def
.type('pvc.visual.Plot', pvc.visual.OptionsBase)
.init(function(chart, keyArgs) {
    // Peek plot type-index
    var typePlots = def.getPath(chart, ['plotsByType', this.type]),
        index = typePlots ? typePlots.length : 0,
    
        // Elements of the first plot (of any type) can be accessed without prefix.
        // Peek chart's plotList (globalIndex is only set afterwards in addPlot).
        globalIndex = chart.plotList.length,
        internalPlot = def.get(keyArgs, 'isInternal', true);

    keyArgs = def.setDefaults(keyArgs, 
        'byNaked', !globalIndex,
        'byName',  internalPlot,
        'byV1',    internalPlot);
    
    // ById - always.
    // Yet, external plots get a random option id, to discourage its direct use.
    if(!internalPlot) 
        keyArgs.optionId = '_' + ((new Date()).getTime() + Math.floor(Math.random() * 100000));

    this.base(chart, this.type, index, keyArgs);
    
    // -------------
    
    // Last prefix has higher precedence.
    
    // The plot id is a valid prefix (id=type+index).
    var prefixes = this.extensionPrefixes = [this.optionId];
    
    if(internalPlot) {
        // Elements of the first plot of the chart (the main plot) can be accessed without prefix.
        if(!globalIndex) prefixes.push('');
        
        // The plot name is a valid prefix.
        if(this.name) prefixes.push(this.name);
    }
})
.add({
    /** @override */
    _buildOptionId: function(keyArgs) { return def.get(keyArgs, 'optionId', this.id); },

    /** @override */
    _getOptionsDefinition: function() { return pvc.visual.Plot.optionsDef; },
    
    collectDataCells: function(dataCells) {
        var dataCell = this._getColorDataCell();
        if(dataCell) dataCells.push(dataCell);
    },

    /** 
     * Called when added to the chart. 
     * @virtual
     */
    onAdded: function() {},

    /**
     * Creates the plots's visible data, based on a given base data,
     * and grouped according to the plot's "main grouping".
     *
     * <p>The default implementation groups data by series visual role.</p>
     *
     * @param {pvc.data.Data} [baseData=null] The base data.
     * @param {object} [ka] Keyword arguments.
     *
     * @return {pvc.data.Data} The visible data.
     * @virtual
     */
    createVisibleData: function(baseData, ka) {
        var serRole = this.chart.visualRoles.series;
        return serRole && serRole.isBound() 
            ? serRole.flatten(baseData, ka) 
            : baseData.where(null, ka); // Used?
    },
    
    /**
     * Gets the extent of the values of the specified role
     * over all datums of the visible data of this plot on the specfied chart.
     * 
     * @param {pvc.visual.BaseChart} chart The chart requesting the cell extent.
     * @param {pvc.visual.Axis} valueAxis The value axis.
     * @param {pvc.visual.Role} valueDataCell The data cell.
     * @type object
     *
     * @virtual
     */
    getContinuousVisibleCellExtent: function(chart, valueAxis, valueDataCell) {
        if(valueDataCell.plot !== this) throw def.error.operationInvalid("Datacell not of this plot.");
        
        var valueRole = valueDataCell.role;

        chart._warnSingleContinuousValueRole(valueRole);

        // not supported/implemented?
        if(valueRole.name === 'series') throw def.error.notImplemented();

        var isSumNorm = valueAxis.scaleSumNormalized(),
            data    = chart.visiblePlotData(this, valueDataCell.dataPartValue), // [ignoreNulls=true]
            dimName = valueRole.lastDimensionName();
        if(isSumNorm) {
            var sum = data.dimensionsSumAbs(dimName);
            if(sum) return {min: 0, max: sum};
        } else {
            var useAbs = valueAxis.scaleUsesAbs(),
                extent = data.dimensions(dimName).extent({abs: useAbs});
            if(extent) {
                // TODO: aren't these Math.abs repeating work??
                var minValue = extent.min.value,
                    maxValue = extent.max.value;
                return {
                    min: (useAbs ? Math.abs(minValue) : minValue),
                    max: (useAbs ? Math.abs(maxValue) : maxValue)
                };
            }
        }
    },

    _getColorDataCell: function() {
        var colorRoleName = this.option('ColorRole');
        if(colorRoleName)
            return new pvc.visual.ColorDataCell(
                    this,
                    /*axisType*/ 'color',
                    this.option('ColorAxis') - 1, 
                    colorRoleName, 
                    this.option('DataPart'));
    }
})
.addStatic({
    registerClass: function(Class) {
        pvc_plotClassByType[Class.prototype.type] = Class;
    },

    getClass: function(type) {
        return def.getOwn(pvc_plotClassByType, type);
    }
});

pvc.visual.Plot.optionsDef = {
    // Box model options?
        
    Orientation: {
        resolve: function(optionInfo) {
            return optionInfo.specify(this._chartOption('orientation') || 'vertical'), true;
        },
        cast: String
    },
    
    ValuesVisible: {
        resolve: '_resolveFull',
        data: {
            resolveV1: function(optionInfo) {
                if(this.globalIndex === 0) {
                    var show = this._chartOption('showValues');
                    if(show !== undefined) {
                        optionInfo.specify(show);
                    } else {
                        show = this.type !== 'point';
                        optionInfo.defaultValue(show);
                    }
                    return true;
                }
            }
        },
        cast:  Boolean,
        value: false
    },
    
    ValuesAnchor: {
        resolve: '_resolveFull',
        cast:    pvc.parseAnchor
    },
    
    ValuesFont: {
        resolve: '_resolveFull',
        cast:    String,
        value:   '10px sans-serif'
    },
    
    // Each plot type must provide an appropriate default mask
    // depending on its scene variable names
    ValuesMask: {
        resolve: '_resolveFull',
        cast:    String,
        value:   "{value}"
    },
    
    ValuesOptimizeLegibility: {
        resolve: '_resolveFull',
        cast:    Boolean,
        value:   false
    },

    ValuesOverflow: {
        resolve: '_resolveFull',
        cast:    pvc.parseValuesOverflow,
        value:   'hide'
    },

    DataPart: {
        resolve: '_resolveFull',
        cast:  String,
        value: '0'
    },
    
    // ---------------
    
    ColorRole: {
        resolve: '_resolveFixed',
        cast:    String,
        value:   'color'
    },
    
    ColorAxis: {
        resolve: pvc.options.resolvers([
            function(optionInfo) {
                // plot0 must use color axis 0!
                // This also ensures that the color axis 0 is created...
                if(this.globalIndex === 0) return optionInfo.specify(1), true;
            },
            '_resolveFull'
        ]),
        cast:  function(value) {
            value = pvc.castNumber(value);
            return value != null ? def.between(value, 1, 10) : 1;
        },
        value: 1
    }
};