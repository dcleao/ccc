define([
    'ccc/cdo',
    'ccc/pvc',
    'ccc/def',
    'test/utils',
    'test/data-1'
], function(cdo, pvc, def, utils, datas) {

    describe("Sliding Window object for cartesian charts ", function() {

        describe("1) If no options are specified: ", function() {

            it("should not create a sliding window options object", function() {
                var slidingWindow = createSlidingWindow({
                    timeSeries: true,
                    timeSeriesFormat: "%Y-%m-%d",
                    slidingWindow: true
                }, pvc.LineChart);

                expect(slidingWindow == null).toBe(true);
            });
        });

        describe("2) If no options but `slidingWindowLength` are specified: ", function() {

            var slidingWindow = createSlidingWindow({
                        timeSeries: true,
                        timeSeriesFormat: "%Y-%m-%d",
                        slidingWindow: true,
                        slidingWindowLength: 'y'
                    }, pvc.LineChart);

            it("should create a sliding window options object", function() {
                expect(!!slidingWindow).toBe(true);
            });

            it("should create a sliding window options object with default values", function() {
                expect(slidingWindow.dimension).toBe("category");
                expect(slidingWindow.length).toBe(pvc.time.intervals.y);
                expect(typeof slidingWindow.score).toBe("function");
                expect(typeof slidingWindow.select).toBe("function");
            });
        });

         describe("3) If some other options are specified: ", function() {
            var options, slidingWindow;

            beforeEach(function() {
                options = {
                    timeSeries: true,
                    timeSeriesFormat: "%Y-%m-%d",
                    slidingWindow: true
                };
                slidingWindow = undefined;
            });

            it("should be created with correct specified options", function() {
                options['slidingWindowLength'] = 'w';
                options['slidingWindowDimension'] = 'series';
                options['slidingWindowScore'] = function(d) { return 1; };

                slidingWindow = createSlidingWindow(options, pvc.LineChart);

                expect(slidingWindow.length).toBe(pvc.time.intervals.w);
                expect(slidingWindow.dimension).toBe(options.slidingWindowDimension);
                expect(slidingWindow.score).toBe(options.slidingWindowScore);
            });

            it("should ignore incorrect length", function() {
                options['slidingWindowLength'] = 'InvalidStringFormat';

                slidingWindow = createSlidingWindow(options, pvc.LineChart);

                expect(slidingWindow.length).toBe(null);
            });

            it("should ignore incorrect dimension", function() {
                options['slidingWindowLength'] = 'w';
                options['slidingWindowDimension']  = 'InexistentDimension';

                slidingWindow = createSlidingWindow(options, pvc.LineChart);

                expect(slidingWindow.length).toBe(pvc.time.intervals.w);
                expect(slidingWindow.dimension).toBe(null);
            });

            describe("evaluating datums ", function() {
                describe("with default scoring functions - ", function() {
                    it("should discard datums outside the window", function() {

                        options['slidingWindowLength'] = 'y';

                        slidingWindow = createSlidingWindow(options, pvc.LineChart);

                        var data = slidingWindow.chart.data,
                            dimension = data.dimensions(slidingWindow.dimension),
                            datum1 = new cdo.Datum(data, {
                                        category: "2011-02-12",
                                        series:   "London",
                                        value:    45
                                    }),
                            datum2 = new cdo.Datum(data, {
                                        category: "2014-02-12",
                                        series:   "Lisbon",
                                        value:    70
                                    });

                        data.add([datum1, datum2]);

                        var remove = []
                        slidingWindow.select([datum1, datum2], remove);

                        expect(slidingWindow.score(datum1)).toEqual(datum1.atoms[dimension.name].value);
                        expect(remove.length).toEqual(1);
                        expect(remove[0]).toEqual(datum1);
                    });

                    it("should discard no datum if interval is unspecified", function() {

                        slidingWindow = createSlidingWindow(options, pvc.LineChart);

                        var data = slidingWindow.chart.data,
                            dimension = data.dimensions(slidingWindow.dimension),
                            datum1 = new cdo.Datum(data, {
                                        category: "2011-02-12",
                                        series:   "London",
                                        value:    45
                                    }),
                            datum2 = new cdo.Datum(data, {
                                        category: "2014-02-12",
                                        series:   "Lisbon",
                                        value:    70
                                    });

                        data.add([datum1, datum2]);

                        var remove = [];
                        slidingWindow.select([datum1, datum2], remove);

                        expect(slidingWindow.score(datum1)).toEqual(datum1.atoms[dimension.name].value);
                        expect(remove.length).toEqual(0);
                    });
                });

                describe("with different score and select functions - ", function() {

                    var data;

                    it("should discard all datums if scoring function always returns null", function() {
                        options['slidingWindowLength'] = 'y';
                        options['slidingWindowScore'] = function(d) { return null; } ;

                        slidingWindow = createSlidingWindow(options, pvc.LineChart);
                        data = slidingWindow.chart.data;

                        var datum1 = new cdo.Datum(data, {
                                    category: "2011-02-12",
                                    series:   "London",
                                    value:    45
                                }),
                            datum2 = new cdo.Datum(data, {
                                        category: "2014-02-12",
                                        series:   "Lisbon",
                                        value:    70
                                    });

                        data.add([datum1, datum2]);

                        var remove = [];
                        slidingWindow.select([datum1, datum2], remove);

                        expect(slidingWindow.score(datum1)).toEqual(null);
                        expect(slidingWindow.score(datum2)).toEqual(null);
                        expect(remove.length).toEqual(2);
                        expect(remove[0]).toEqual(datum1);
                        expect(remove[1]).toEqual(datum2);
                    });

                    it("should ignore score if select is default and score has no meaning", function() {
                        options['slidingWindowLength'] = 'y';
                        options['slidingWindowScore'] = function(d) { return "noMeaningScore"; } ;

                        slidingWindow = createSlidingWindow(options, pvc.LineChart);
                        data = slidingWindow.chart.data;

                        var datum1 = new cdo.Datum(data, {
                                        category: "2011-02-12",
                                        series:   "London",
                                        value:    45
                                    }),
                            datum2 = new cdo.Datum(data, {
                                        category: "2014-02-12",
                                        series:   "Lisbon",
                                        value:    70
                                    });

                        data.add([datum1, datum2]);

                        var remove = [];
                        slidingWindow.select([datum1, datum2], remove);

                        expect(remove.length).toEqual(0);
                    });
                });
            });

            describe("setting axis defaults ", function() {
                it("should set axis options' defaults", function() {
                    options['slidingWindowLength'] = 'w';
                    slidingWindow = createSlidingWindow(options, pvc.LineChart);
                    slidingWindow.setAxisDefaults();

                    slidingWindow.chart.axesByType.color.forEach(function(axis) {
                        expect(axis.option.defaultValue('PreserveMap')).toEqual(true);
                        var dim = axis.role.grouping.firstDimension;
                        //expect(dim.comparer).toEqual(def.ascending);
                    }, slidingWindow);

                    expect(slidingWindow.chart.options.preserveLayout).toEqual(true);

                    var axes = slidingWindow.chart.axesList.filter(function(axis) {
                        var dim = axis.role.grouping.firstDimension;
                        return dim.name == this.dimension;
                    }, slidingWindow);

                    axes.forEach(function(axis) {
                         expect(axis.option.defaultValue('FixedLength')).toEqual(this.length);
                         expect(axis.option('FixedLength')).toEqual(this.length);
                    }, slidingWindow);
                });

                it("should set axis options' defaults except for fixed length", function() {
                    slidingWindow = createSlidingWindow(options, pvc.LineChart);
                    slidingWindow.setAxisDefaults();

                    slidingWindow.chart.axesByType.color.forEach(function(axis) {
                        expect(axis.option.defaultValue('PreserveMap')).toEqual(true);
                        var dim = axis.role.grouping.firstDimension;
                        //expect(dim.comparer).toEqual(def.ascending);
                    }, slidingWindow);

                    expect(slidingWindow.chart.options.preserveLayout).toEqual(true);

                    var axes = slidingWindow.chart.axesList.filter(function(axis) {
                        var dim = axis.role.grouping.firstDimension;
                        return dim.name == this.dimension;
                    }, slidingWindow);

                    axes.forEach(function(axis) {
                         expect(axis.option.defaultValue('FixedLength')).toBe(undefined);
                         expect(axis.option('FixedLength')).toBe(undefined);
                    }, slidingWindow);
                });
            });
        });
    });

    function createChart(options, type) {
        var dataSpec = datas['relational, series=city|category=date|value=qty, square form'];
        return utils.createChart(type, options, dataSpec);
    }

    function createSlidingWindow(chartOptions, chartType) {
        var chart = createChart(chartOptions, chartType);
        return chart.slidingWindow;
    }
});
