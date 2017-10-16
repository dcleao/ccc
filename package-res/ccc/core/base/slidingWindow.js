/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global axis_optionsDef:true*/

def('pvc.visual.SlidingWindow', pvc.visual.OptionsBase.extend({

    init: function(chart) {
        this.base(chart, 'slidingWindow', 0, {byNaked: false});
        this.length = this.option('Length');
    },

    methods: /** @lends pvc.visual.slidingWindow# */{
        length:    null,
        dimension: null,
        select:    slidingWindow_defaultSelect,

        // Requires axes to be initialized!
        initFromOptions: function() {
            if(this.length) {
                this.dimension = this.option('Dimension');
                this.override('select', this.option('Select'));
            }
        },

        setDataFilter: function(data) {
            data.select = this.select.bind(this);
        },

        /**
         * Sets an ascending comparer in every discrete dimension
         * that does not have an explicitly configured comparer and
         * to which at least one visual role is bound.
         *
         * @param {cdo.ComplexType} complexType - The complex type of the chart's main data.
         */
        setDimensionsOptions: function(complexType) {
            var chart = this.chart;
            var dimOpts = chart.options.dimensions;
            var dimGroupOpts = chart.options.dimensionGroups;

            complexType.dimensionsList().forEach(function(mainDimType) {
                if(!mainDimType.isDiscrete)
                    return;

                var mainDimName = mainDimType.name;

                // If a comparer is already specified don't override it.
                var dimSpecs = dimOpts && dimOpts[mainDimName];
                if(dimSpecs && dimSpecs.comparer)
                    return;

                var dimGroup = cdo.DimensionType.dimensionGroupName(mainDimName);
                var dimGroupSpecs = dimGroupOpts && dimGroupOpts[dimGroup];
                if(dimGroupSpecs && dimGroupSpecs.comparer)
                    return;

                // Is dimension playing any visual roles?
                var visualRoles = chart.visualRolesOf(mainDimName, /*includePlotLevel:*/true);
                if(!visualRoles)
                    return;

                // Apply comparer.
                // Sets `isComparable` as well.
                mainDimType.setComparer(def.ascending);
            });
        },

        setLayoutPreservation: function(chart) {
            if(chart.options.preserveLayout == null) chart.options.preserveLayout = true;
        },

        // called from Chart#_initAxesEnd
        setAxesDefaults: function(chart) {
            chart.axesList.forEach(function(axis) {
                var role = axis.role;
                if(role) {
                    // Is a sliding window axis?
                    if(role.grouping.isSingleDimension && role.grouping.firstDimensionName() === this.dimension)
                        this._setAxisFixedRatio(axis);

                    if(axis.type === "color")
                        axis.option.defaults({'PreserveMap': true});
                }
            }, this);
        },

        _setAxisFixedRatio: function(axis) {
            var axisOption = axis.option;

            // Only axes that have a meaningful length can have a ratio.
            if(axisOption.isDefined('FixedLength') && axisOption.isDefined('PreserveRatio')) {

                if(this.option.isSpecified('Length'))
                    axis.option.defaults({'FixedLength': this.length});

                axis.option.defaults({"PreserveRatio": true});
            }
        }
    },

    options: {
        Dimension:   {
            resolve: '_resolveFull',
            cast: function(name) {
                return pvc.parseDimensionName(name, this.chart);
            },
            getDefault: slidingWindow_defaultDimensionName
        },

        Length: {
            resolve: '_resolveFull',
            cast: function(interval) {
                return pv.parseDatePrecision(interval, null);
            }
        },

        Select: {
            resolve: '_resolveFull',
            cast: def.fun.as,
            getDefault: function() { return slidingWindow_defaultSelect.bind(this); }
        }
    }
}));


function slidingWindow_defaultDimensionName() {
    // Cartesian charts always have (at least) a base and ortho axis
    // Unfortunately, the sliding window is initialized while the visual roles' pre-bindings are not yet committed.
    var baseAxis = this.chart.axes.base;
    var baseGrouping = baseAxis && (baseAxis.role.grouping || baseAxis.role.preBoundGrouping());

    return baseGrouping
        ? baseGrouping.lastDimensionName()
        : this.chart.data.type.dimensionsNames()[0];
}

function slidingWindow_defaultSelect(allData) {

    var dim = this.chart.data.dimensions(this.dimension),
        maxAtom = dim.max(),
        mostRecent = maxAtom.value,
        toRemove = [];

    for(var i = 0, L = allData.length; i < L; i++) {
        var datum      = allData[i],
            datumScore = datum.atoms[this.dimension].value,
            scoreAtom  = dim.read(datumScore);

        if(datumScore == null) {
            toRemove.push(datum);
        } else if(scoreAtom == null || (typeof(datumScore) !== typeof(scoreAtom.value))) {
            // The score has to be of the same type has the dimension valueType.
            // The typeof comparison is needed when score is string and the valueType is Date.
            if(def.debug >= 2)
                def.log("[Warning] The specified scoring function has an invalid return value.");

            toRemove = [];
            break;
        } else {
            // Using the scoring function on both atoms guarantees that even if
            // the scoring function is overridden, result is still valid.
            datumScore = scoreAtom.value;
            var result = (+mostRecent) - (+datumScore);
            if(result && result > this.length)
                toRemove.push(datum);
        }
    }

    return toRemove;

}
