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
.add(/** @lends pvc.visual.CategoricalPlot# */{
    /** @override */
    createVisibleData: function(baseData, ka) {
        var serRole = this.visualRoles.series,
            serGrouping = serRole && serRole.flattenedGrouping(),
            catGrouping = this.visualRole('category').flattenedGrouping();

        return serGrouping 
            // <=> One multi-dimensional, two-levels data grouping
            ? baseData.groupBy(def.get(ka, 'inverted', false) 
                    ? [serGrouping, catGrouping] 
                    : [catGrouping, serGrouping], 
                    ka)
            : baseData.groupBy(catGrouping, ka);
    },

    _getOptionsDefinition: function() { return pvc.visual.CategoricalPlot.optionsDef; },

    /** @override */
    initEnd: function() {
        this.base();

        this._addVisualRole('category', this._getCategoryRoleSpec());
    },

    /** @virtual */
    _getCategoryRoleSpec: function() {
        return {
            isRequired: true,
            defaultDimension: 'category*',
            autoCreateDimension: true
        };
    },

    /**
     * Obtains the extent of the specified value axis' role
     * and data part values.
     *
     * <p>
     * Takes into account that values are shown grouped per category.
     * </p>
     *
     * <p>
     * The fact that values are stacked or not, per category,
     * is also taken into account.
     * Each data part can have its own stacking.
     * </p>
     *
     * <p>
     * When more than one datum exists per series <i>and</i> category,
     * the sum of its values is considered.
     * </p>
     *
     * @param {pvc.visual.CartesianAxis} valueAxis The value axis.
     * @param {pvc.visual.Role} valueDataCell The data cell.
     * @type object
     *
     * @override
     */
    getContinuousVisibleCellExtent: function(chart, valueAxis, valueDataCell) {
        var valueRole = valueDataCell.role;

        switch(valueRole.name) {
            case 'series':// (series throws in base)
            case 'category':
                /* Special case.
                 * The category role's single dimension belongs to the grouping dimensions of data.
                 * As such, the default method is adequate
                 * (gets the extent of the value dim on visible data).
                 *
                 * Continuous baseScale's, like timeSeries go this way.
                 */
                return this.base(chart, valueAxis, valueDataCell);
        }

        if(valueDataCell.plot !== this) throw def.error.operationInvalid("Datacell not of this plot.");

        chart._warnSingleContinuousValueRole(valueRole);

        var dataPartValue = valueDataCell.dataPartValue,
            valueDimName = valueRole.lastDimensionName(),
            data = chart.visiblePlotData(this, dataPartValue), // [ignoreNulls=true]
            useAbs = valueAxis.scaleUsesAbs();

        if(valueAxis.type !== 'ortho' || !valueDataCell.isStacked)
            return data.leafs()
               .select(function(serGroup) {
                   var value = serGroup.dimensions(valueDimName).value();
                   return useAbs && value < 0 ? -value : value;
                })
               .range();

        // Data is grouped by category and then by series,
        // so direct children of data are category groups.
        return data.children()
            // Obtain the value extent of each category
            .select(function(catGroup) {
                var range = this._getStackedCategoryValueExtent(catGroup, valueDimName, useAbs);
                if(range) return {range: range, group: catGroup};
            }, this)
            .where(def.notNully)

            // Combine the value extents of all categories
            .reduce(function(result, rangeInfo) {
                return this._reduceStackedCategoryValueExtent(
                            chart, 
                            result,
                            rangeInfo.range,
                            rangeInfo.group);
            }.bind(this), null);

            // The following would not work:
            //  var max = data.children()
            //     .select(function(catGroup) { return catGroup.dimensions(valueDimName).sum(); })
            //     .max();
            //
            //  return max != null ? {min: 0, max: max} : null;
    },

    /**
     * Obtains the extent of a value dimension in a given category group.
     * The default implementation determines the extent by separately
     * summing negative and positive values.
     * Supports {@link #_getContinuousVisibleExtent}.
     *
     * @virtual
     */
    _getStackedCategoryValueExtent: function(catGroup, valueDimName, useAbs) {
        var posSum = null, negSum = null;

        catGroup
            .children()
            // Sum all datum's values on the same leaf
            .select(function(serGroup) {
                var value = serGroup.dimensions(valueDimName).value();
                return useAbs && value < 0 ? -value : value;
            })
            // Add to positive or negative totals
            .each(function(value) {
                // Note: +null === 0
                if(value != null) {
                    if(value >= 0) posSum += value;
                    else           negSum += value;
                }
            });

        if(posSum == null && negSum == null) return null;

        return {max: posSum || 0, min: negSum || 0};
    },

    /**
     * Reduce operation of category ranges, into a global range.
     *
     * The default implementation performs a range "union" operation.
     *
     * Supports {@link #_getContinuousVisibleExtent}.
     * @virtual
     */
    _reduceStackedCategoryValueExtent: function(chart, result, catRange, catGroup) {
        return pvc.unionExtents(result, catRange);
    },

    /** @override */
    _getBaseRole: function() { return this.visualRoles.category; },

    /** @override */
    _getOrthoRoles: function() { return [this.visualRole('value')]; }
});

pvc.visual.CategoricalPlot.optionsDef = def.create(
    pvc.visual.CartesianPlot.optionsDef, {
    
    Stacked: {
        resolve: '_resolveFull',
        cast:    Boolean,
        value:   false
    }
});
