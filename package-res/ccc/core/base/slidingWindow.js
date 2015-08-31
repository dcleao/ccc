/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global axis_optionsDef:true*/


//CDF603

def('pvc.visual.SlidingWindow', pvc.visual.OptionsBase.extend({
    init: function(chart) {

        this.base(chart, 'slidingWindow', 0, {byNaked: false});

        var o = this.option;

        this.length = o('Length');
        if(this.length != null) {
            this.dimension = o('Dimension');
            this.score = o('Score');
            this.select = o('Select');
        }
    },

    methods: /** @lends pvc.visual.SlidingWindow# */{

        length: null,
        dimension: null,
        select: null,
        score: null,

        setAxesDefaults: function() {
            var colorAxes = this.chart.axesByType.color;
            if(colorAxes) colorAxes.forEach(function(axis) { axis.setPreserveColorMap(); });

            // TODO: Why all axes? The way this is done,
            //   all bound dimensions that do not have a specified comparer end up
            //   having a default comparer set, independently of the axis.
            //
            // TODO: This way of detecting if a comparer was specified is not the best.
            // `dimensionGroups` can also be used to specify a comparer.
            this.chart.axesList.forEach(function(axis) {
                var dimOptions = this.chart.options.dimensions;

                axis.role.grouping.dimensionNames().forEach(function(dimName) {
                    var dimComp = dimOptions && dimOptions[dimName];
                    if(!dimComp || !dimComp.comparer) {
                        this.chart.data.dimensions(dimName)
                            .type.setComparer(def.ascending);
                    }
                }, this);
            }, this);

            if(this.length != null) {
                this.chart.axesList.forEach(function(axis) {
                    // Axis is bound to the sliding window dimension
                    // and has a FixedLength option?
                    if(axis.role.firstDimensionName() === this.dimension &&
                       axis.option.isDefined('FixedLength')) {

                        axis.setInitialLength(this.length); //review

                        if(axis.option.isDefined('PreserveRatio') &&
                           !(axis.option.isSpecified('Ratio') || axis.option.isSpecified('PreserveRatio'))) {
                            axis.option.specify({PreserveRatio: true});
                        }
                    }
                }, this);
            }

            // This has nothing to do with axes' defaults...
            this.chart.options.preserveLayout = true;
        }
    },

    options: {
        // The dimension of data to which the window is applied.
        // Axes bound to this dimension and that have a "FixedLength" option
        // have "FixedLength" defaulted to `Length`.
        Dimension:   {
            resolve: '_resolveFull',
            cast: slidingWindow_castDimension,
            getDefault: slidingWindow_defaultDimension
        },

        // The length of the window, a number (after parsing).
        Length: {
            resolve: '_resolveFull',
            cast: function(interval) {
                // TODO: What about numeric domains?
                return pv.parseDatePrecision(interval, null);
            },
            value: null
        },

        // The datum scoring function.
        // Must return values of, or derived from, `Dimension`.
        Score: {
            resolve: '_resolveFull',
            cast: def.fun.as,
            getDefault: function() { return slidingWindow_defaultScore.bind(this); }
        },

        // Selects the datums to _remove_,
        // based on the score of each datum,
        // the length and dimension of the window,
        // and some custom logic.
        Select: {
            resolve: '_resolveFull',
            cast: def.fun.as,
            getDefault: function() { return slidingWindow_defaultSelect.bind(this); }
        }
    }
}));

function slidingWindow_defaultDimension() {
    // Cartesian charts always have a base and ortho axis.
    var baseAxis = this.chart.axes.base;
    return baseAxis
        ? baseAxis.role.grouping.lastDimensionName()
        : this.chart.data.type.dimensionsNames()[0];
}

function slidingWindow_castDimension(name) {
    if(name) {
        var dimType = this.chart.data.type.dimensions(name, {assertExists: false});
        if(dimType) return name;

        if(def.debug >= 2)
            def.warn(def.format("Undefined sliding window dimension with name '{0}'.", [name]));
    }
}

function slidingWindow_defaultScore(datum) {
    return datum.atoms[this.dimension].value;
}

function slidingWindow_defaultSelect(allData, remove) {
    var dim = this.chart.data.dimensions(this.dimension),
        mostRecent = dim.max().value;

    allData.forEach(function(datum) {
        var datumScore = this.score(datum);
        if(datumScore == null) {
            remove.push(datum);
        } else {
            var scoreAtom = dim.read(datumScore);
            if(scoreAtom == null) {
                if(def.debug >= 2)
                    def.warn("The default sliding window functions are only applicable to timeseries or numeric scales. Datum not removed.");
                return;
            }

            datumScore = scoreAtom.value;

            var result = mostRecent - datumScore;
            if(result && result > this.length)
                remove.push(datum);
        }
    }, this);
}
