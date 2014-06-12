/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pvc.BaseChart
.add({

    /**
     * The data that the chart is to show.
     * @type cdo.Data
     * @deprecated
     */
    dataEngine: null,

    /**
     * The data that the chart is to show.
     * @type cdo.Data
     */
    data: null,

    _partsDataCache: null,
    _visibleDataCache: null,

    /**
     * The data source of the chart.
     * <p>
     * The {@link #data} of a root chart
     * is loaded with the data in this array.
     * </p>
     * @type any[]
     */
    resultset: [],

    /**
     * The meta-data that describes each
     * of the data components of {@link #resultset}.
     * @type any[]
     */
    metadata: [],

    _interpolatable: false,

    _constructData: function(options) {
        if(this.parent)
            //noinspection JSDeprecatedSymbols
            this.dataEngine = this.data = options.data || def.fail.argumentRequired('options.data');
    },

    _checkNoDataI: function() {
        // Child charts are created to consume *existing* data
        // If we don't have data, we just need to set a "no data" message and go on with life.
        if(!this.allowNoData && !this.resultset.length)
            /*global NoDataException:true */
            throw new NoDataException();
    },

    _checkNoDataII: function() {
        // Child charts are created to consume *existing* data
        // If we don't have data, we just need to set a "no data" message and go on with life.
        if(!this.allowNoData && (!this.data || !this.data.count())) {

            this.data = null;

            /*global NoDataException:true */
            throw new NoDataException();
        }
    },

    /**
     * Initializes the data engine and roles.
     */
    _initData: function(ka) {
        // Root chart
        if(!this.parent) {
            var data = this.data;
            if(!data) {
                this._onLoadData();
            } else if(def.get(ka, 'reloadData', true)) {
                // This **replaces** existing data (datums also existing in the new data are kept)
                this._onReloadData();
            } else {
                // Existing data is kept.
                // This is used for re-layouting only.
                // Yet...

                // Dispose all data children and linked children (recreated as well)
                // And clears caches as well.
                data.disposeChildren();

                // Remove virtual datums (they are regenerated each time)
                data.clearVirtuals();
            }
        }

        // Cached data stuff
        delete this._partsDataCache;
        delete this._visibleDataCache;

        if(pvc.debug >= 3) this._log(this.data.getInfo());
    },

    _onLoadData: function() {
        /*jshint expr:true*/
        var data = this.data,
            translation = this._translation;

        (!data && !translation) || def.assert("Invalid state.");

        var options = this.options,
            dataPartDimName = this._getDataPartDimName(),
            complexTypeProj = this._complexTypeProj || def.assert("Invalid state."),
            dimsOptions     = this._createDimensionsOptions(options);

        // If there are any columns in the supplied data
        if(this.metadata.length) {
            var translOptions = this._createTranslationOptions(options, dimsOptions, dataPartDimName);
            translation = this._translation = this._createTranslation(translOptions);

            if(pvc.debug >= 3) this._log(translation.logSource()), this._log(translation.logTranslatorType());

            // Now the translation can also configure the type
            translation.configureType();
        }

        // If the the dataPart dimension isn't being read or calculated,
        // its value must be defaulted to 0.
        if(dataPartDimName && !complexTypeProj.isReadOrCalc(dataPartDimName))
            this._addDefaultDataPartCalculation(dataPartDimName);

        if(translation && pvc.debug >= 3) this._log(translation.logVItem());

        // ----------
        // Roles are bound before actually loading data.
        // i) roles add default properties to dimensions bound to them
        // ii) in order to be able to filter datums
        //     whose "every dimension in a measure role is null".
        this._bindVisualRolesPostI();

        // Setup the complex type from complexTypeProj;
        var complexType = new cdo.ComplexType();
        complexTypeProj.configureComplexType(complexType, dimsOptions);

        this._bindVisualRolesPostII(complexType);

        if(pvc.debug >= 3) this._log(complexType.describe()), this._logVisualRoles();

        data =
            this.dataEngine = // V1 property
            this.data = new cdo.Data({
                type:     complexType,
                labelSep: options.groupedLabelSep,
                keySep:   options.dataSeparator
            });

        // ----------

        if(translation) {
            var loadKeyArgs = {where: this._getLoadFilter(), isNull: this._getIsNullDatum()},
                resultQuery = translation.execute(data);

            data.load(resultQuery, loadKeyArgs);
        }
    },

    _onReloadData: function() {
        /*jshint expr:true*/

        var data = this.data,
            translation = this._translation;

        (data && translation) || def.assert("Invalid state.");

        // pass new resultset to the translation (metadata is maintained!).
        translation.setSource(this.resultset);

        if(pvc.debug >= 3) this._log(translation.logSource());

        var loadKeyArgs = {where: this._getLoadFilter(), isNull: this._getIsNullDatum()},
            resultQuery = translation.execute(data);

        data.load(resultQuery, loadKeyArgs);
    },

    _createComplexTypeProject: function() {
        var options = this.options,
            complexTypeProj = new cdo.ComplexTypeProject(options.dimensionGroups),
            // Add specified dimensions
            userDimsSpec = options.dimensions;

        for(var dimName in userDimsSpec) // userDimsSpec can be null; 'for' accepts null!
            complexTypeProj.setDim(dimName, userDimsSpec[dimName]);

        // Add data part dimension and
        // dataPart calculation from series values
        var dataPartDimName = this._getDataPartDimName();
        if(dataPartDimName) {
            complexTypeProj.setDim(dataPartDimName);

            this._addPlot2SeriesDataPartCalculation(complexTypeProj, dataPartDimName);
        }

        // Add specified calculations
        var calcSpecs = options.calculations;
        if(calcSpecs) calcSpecs.forEach(function(calcSpec) { complexTypeProj.setCalc(calcSpec); });

        return complexTypeProj;
    },

    _getLoadFilter: function() {
        var options = this.options,
            dataWhere = options.dataWhere,
            dataOptions;
        return dataWhere !== undefined ? dataWhere : ((dataOptions = options.dataOptions) && dataOptions.where);
    },

    _getIsNullDatum: function() {
        var measureDimNames = this.measureDimensionsNames(),
            M = measureDimNames.length;
        if(M) {
            // Must have all measure role dimensions = null
            return function(datum) {
                var atoms = datum.atoms;
                for(var i = 0 ; i < M ; i++) if(atoms[measureDimNames[i]].value != null) return false;
                return true;
            };
        }
    },

    _createTranslation: function(translOptions) {
        var TranslationClass = this._getTranslationClass(translOptions);

        return new TranslationClass(this, this._complexTypeProj, this.resultset, this.metadata, translOptions);
    },

    _getTranslationClass: function(translOptions) {
        return translOptions.crosstabMode ?
               cdo.CrosstabTranslationOper :
               cdo.RelationalTranslationOper;
    },

    // Creates the arguments required for cdo.DimensionType.extendSpec
    _createDimensionsOptions: function(options) {
        return {
            isCategoryTimeSeries: options.timeSeries,
            formatProto:          this._format,
            timeSeriesFormat:     options.timeSeriesFormat,
            dimensionGroups:      options.dimensionGroups
        };
    },

    _createTranslationOptions: function(options, dimsOptions, dataPartDimName) {
        var dataOptions = options.dataOptions || {};

        var dataMeasuresInColumns = options.dataMeasuresInColumns;
        if(dataMeasuresInColumns === undefined) dataMeasuresInColumns = dataOptions.measuresInColumns;

        var dataCategoriesCount = options.dataCategoriesCount;
        if(dataCategoriesCount === undefined) dataCategoriesCount = dataOptions.categoriesCount;

        var dataIgnoreMetadataLabels = options.dataIgnoreMetadataLabels;
        if(dataIgnoreMetadataLabels === undefined) dataIgnoreMetadataLabels = dataOptions.ignoreMetadataLabels;

        var plot2Series, plot2DataSeriesIndexes;
        var plot2 = options.plot2;
        if(plot2) {
            if(this._allowV1SecondAxis && (this.compatVersion() <= 1)) {
                plot2DataSeriesIndexes = options.secondAxisIdx;
            } else {
                plot2Series = (this.visualRoles.series != null) &&
                              options.plot2Series &&
                              def.array.as(options.plot2Series);

                // TODO: temporary implementation based on V1s secondAxisIdx's implementation
                // until a real "series visual role" based implementation exists.
                if(!plot2Series || !plot2Series.length) {
                    plot2Series = null;
                    plot2DataSeriesIndexes = options.plot2SeriesIndexes;
                }
            }

            if(!plot2Series) plot2DataSeriesIndexes = pvc.parseDistinctIndexArray(plot2DataSeriesIndexes, -Infinity) || -1;
        }

        return def.create(dimsOptions, {
            compatVersion:     this.compatVersion(),
            plot2DataSeriesIndexes: plot2DataSeriesIndexes,
            seriesInRows:      options.seriesInRows,
            crosstabMode:      options.crosstabMode,
            isMultiValued:     options.isMultiValued,
            dataPartDimName:   dataPartDimName,
            readers:           options.readers,
            measuresIndexes:   options.measuresIndexes, // relational multi-valued
            multiChartIndexes: options.multiChartIndexes,
            ignoreMetadataLabels: dataIgnoreMetadataLabels,

            // crosstab
            separator:         options.dataSeparator,
            measuresInColumns: dataMeasuresInColumns,
            categoriesCount:   dataCategoriesCount,

            // TODO: currently measuresInRows is not implemented...
            measuresIndex:     dataOptions.measuresIndex || dataOptions.measuresIdx, // measuresInRows
            measuresCount:     dataOptions.measuresCount || dataOptions.numMeasures  // measuresInRows
        });
    },

    _addPlot2SeriesDataPartCalculation: function(complexTypeProj, dataPartDimName) {
        if(this.compatVersion() <= 1) return;

        var options = this.options,
            serRole = this.visualRoles.series,
            plot2Series = (serRole != null) && options.plot2 && options.plot2Series && def.array.as(options.plot2Series);

        if(!plot2Series || !plot2Series.length) return;

        var inited = false,
            plot2SeriesSet = def.query(plot2Series).uniqueIndex(),
            dimNames, dataPartDim, part1Atom, part2Atom;

        complexTypeProj.setCalc({
            names: dataPartDimName,
            calculation: function(datum, atoms) {
                if(!inited) {
                    // LAZY init
                    if(serRole.isBound()) {
                        dimNames    = serRole.grouping.dimensionNames();
                        dataPartDim = datum.owner.dimensions(dataPartDimName);
                    }
                    inited = true;
                }

                if(dataPartDim) {
                    var seriesKey = cdo.Complex.compositeKey(datum, dimNames);
                    atoms[dataPartDimName] =
                        def.hasOwnProp.call(plot2SeriesSet, seriesKey) ?
                           (part2Atom || (part2Atom = dataPartDim.intern('1'))) :
                           (part1Atom || (part1Atom = dataPartDim.intern('0')));
                }
            }
        });
    },

    _addDefaultDataPartCalculation: function(dataPartDimName) {
        var dataPartDim, part1Atom;

        this._complexTypeProj.setCalc({
            names: dataPartDimName,
            calculation: function(datum, atoms) {
                if(!dataPartDim) dataPartDim = datum.owner.dimensions(dataPartDimName);

                atoms[dataPartDimName] = part1Atom || (part1Atom = dataPartDim.intern('0'));
            }
        });
    },

    partData: function(dataPartValues, baseData) {
        if(!baseData) baseData = this.data;
        if(dataPartValues == null) return baseData;

        if(this.parent) return this.root.partData(dataPartValues, baseData);

        // Is the visual role undefined or unbound?
        // If so, ignore dataPartValues. It should be empty, but in some cases it comes with ['0'], due to shared code.
        var partRole = this.visualRoles.dataPart;
        if(!partRole || !partRole.isBound()) return baseData;

        // Try get from cache.
        var cacheKey = '\0' + baseData.id + ':' + def.nullyTo(dataPartValues, ''), // Counting on Array.toString() implementation, when an array.
            partitionedDataCache = def.lazy(this, '_partsDataCache'),
            partData = partitionedDataCache[cacheKey];
        if(!partData) {
            // Not in cache. Create the partData result.
            partData = this._createPartData(baseData, partRole, dataPartValues);
            partitionedDataCache[cacheKey] = partData;
        }
        
        return partData;
    },

    _createPartData: function(baseData, partRole, dataPartValues) {
        // NOTE: It is not possible to use a normal whereSpec query.
        // Under the hood it uses groupBy to filter the results,
        //  and that ends changing the order of datums, to follow
        //  the group operation.
        // Changing order at this level is not acceptable.
        var dataPartDimName = partRole.lastDimensionName(),
            dataPartAtoms   = baseData.dimensions(dataPartDimName).getDistinctAtoms(def.array.to(dataPartValues)),
            where = cdo_whereSpecPredicate([def.set({}, dataPartDimName, dataPartAtoms)]);

        return baseData.where(null, {where: where});
    },

    // --------------------

    /*
     * Obtains the chart's visible data
     * grouped according to the charts "main grouping".
     *
     * The chart's main grouping is that of its main plot.
     *
     * @param {string|string[]} [dataPartValue=null] The desired data part value or values.
     * @param {object} [ka=null] Optional keyword arguments object.
     * @param {boolean} [ka.ignoreNulls=true] Indicates that null datums should be ignored.
     * Only takes effect if the global option {@link pvc.options.charts.Chart#ignoreNulls} is false.
     * @param {boolean} [ka.inverted=false] Indicates that the inverted data grouping is desired.
     * @param {cdo.Data} [baseData] The base data to use. By default the chart's {@link #data} is used.
     *
     * @type cdo.Data
     */
    visibleData: function(dataPartValue, ka) {
        var mainPlot = this.plots.main || 
            def.fail.operationInvalid("There is no main plot defined.");

        return this.visiblePlotData(mainPlot, dataPartValue, ka);
    },

    visiblePlotData: function(plot, dataPartValue, ka) {
        var baseData = def.get(ka, 'baseData') || this.data;
        if(this.parent) {
            // Caching is done at the root chart.
            ka = ka ? Object.create(ka) : {};
            ka.baseData = baseData;
            return this.root.visiblePlotData(plot, dataPartValue, ka);
        }

        // Normalize values for the cache key.
        var inverted    = !!def.get(ka, 'inverted', false),
            ignoreNulls = !!(this.options.ignoreNulls || def.get(ka, 'ignoreNulls', true)),

            // dataPartValue: relying on Array#toString, when an array
            key = [plot.id, baseData.id, inverted, ignoreNulls, dataPartValue != null ? dataPartValue : null]
                    .join("|"),
            cache = def.lazy(this, '_visibleDataCache'),
            data  = cache[key];

        if(!data) {
            var partData = this.partData(dataPartValue, baseData);

            ka = ka ? Object.create(ka) : {};
            ka.visible = true;
            ka.isNull  = ignoreNulls ? false : null;
            data = cache[key] = plot.createVisibleData(partData, ka);
        }
        return data;  
    },

    // --------------------

    _initMultiCharts: function() {
        var chart = this;

        // Options objects
        chart.multiOptions = new pvc.visual.MultiChart(chart);
        chart.smallOptions = new pvc.visual.SmallChart(chart);

        var multiOption = chart.multiOptions.option,
            data = chart.visualRoles.multiChart.flatten(chart.data, {visible: true, isNull: null}),
            smallDatas = data.childNodes,
            colCount, rowCount, multiChartMax, colsMax;

        // I - Determine how many small charts to create
        if(chart._isMultiChartOverflowClipRetry) {
            rowCount = chart._clippedMultiChartRowsMax;
            colCount = chart._clippedMultiChartColsMax;
            colsMax = colCount;
            multiChartMax = rowCount * colCount;
        } else {
            multiChartMax = multiOption('Max'); // Can be Infinity.
        }
        
        var count = Math.min(smallDatas.length, multiChartMax);
        if(count === 0) {
            // Shows no message to the user.
            // An empty chart, like when all series are hidden through the legend.
            colCount = rowCount = colsMax = 0;
        } else if(!chart._isMultiChartOverflowClipRetry) {
            // II - Determine basic layout (row and col count)
            colsMax = multiOption('ColumnsMax'); // Can be Infinity.
            colCount = Math.min(count, colsMax);
            
            // <Debug>
            /*jshint expr:true */
            colCount >= 1 && isFinite(colCount) || def.assert("Must be at least 1 and finite");
            // </Debug>

            rowCount = Math.ceil(count / colCount);
            // <Debug>
            /*jshint expr:true */
            rowCount >= 1 || def.assert("Must be at least 1");
            // </Debug>
        }

        chart._multiInfo = {
          data:       data,
          smallDatas: smallDatas,
          count:      count,
          rowCount:   rowCount,
          colCount:   colCount,
          colsMax:    colsMax
        };
    },

    // --------------------

    _interpolate: function(hasMultiRole) {
        if(!this._interpolatable) return;

        var dataCells = def
            .query(this.axesList)
            .selectMany(def.propGet('dataCells'))
            .where(function(dataCell) {
                var nim = dataCell.nullInterpolationMode;
                return !!nim && nim !== 'none';
             })
             .distinct(function(dataCell) {
                 return dataCell.role.name  + '|' + (dataCell.dataPartValue || '');
             })
             .array();

        this._eachLeafDatasAndDataCells(hasMultiRole, dataCells, this._interpolateDataCell, this);
    },

    _generateTrends: function(hasMultiRole) {
        var dataPartDimName = this._getDataPartDimName();
        if(!dataPartDimName || !this.plots.trend) return;
        
        var dataCells = def.query(this.axesList)
            .selectMany(def.propGet('dataCells'))
            .where(def.propGet('trend'))
            .distinct(function(dataCell) {
                 return dataCell.role.name  + '|' + (dataCell.dataPartValue || '');
            })
            .array();

        var newDatums = [];
        
        this._eachLeafDatasAndDataCells(hasMultiRole, dataCells, function(dataCell, data) {
            this._generateTrendsDataCell(newDatums, dataCell, data);
        }, this);
        
        newDatums.length && this.data.owner.add(newDatums);
    },

    _eachLeafDatasAndDataCells: function(hasMultiRole, dataCells, f, x) {
        var C = dataCells.length;
        if(!C) return;
        
        var leafDatas, D;
        if(hasMultiRole) {
            leafDatas = this._multiInfo.smallDatas;
            D = this._multiInfo.count;
        } else {
            leafDatas = [this.data];
            D = 1;
        }

        for(var d = 0; d < D; d++) {
            var leafData = leafDatas[d];
            for(var c = 0; c < C; c++) f.call(x, dataCells[c], leafData, c, d);
        }
    },

    _interpolateDataCell: function(/*dataCell, baseData*/) {},

    _generateTrendsDataCell: function(/*dataCell, baseData*/) {},

    _getTrendDataPartAtom: function() {
        var dataPartDimName = this._getDataPartDimName();
        if(dataPartDimName) return this.data.owner.dimensions(dataPartDimName).intern('trend');
    },

    // ---------------

    /**
     * Method to set the data to the chart.
     * Expected object is the same as what comes from the CDA:
     * {metadata: [], resultset: []}
     */
    setData: function(data, options) {
        this.setResultset(data && data.resultset);
        this.setMetadata (data && data.metadata);

        // TODO: Danger!
        $.extend(this.options, options);

        return this;
    },

    /**
     * Sets the resultset that will be used to build the chart.
     */
    setResultset: function(resultset) {
        /*jshint expr:true */
        !this.parent || def.fail.operationInvalid("Can only set resultset on root chart.");

        this.resultset = resultset || [];
        if(!this.resultset.length) this._warn("Resultset is empty");

        return this;
    },

    /**
     * Sets the metadata that, optionally,
     * will give more information for building the chart.
     */
    setMetadata: function(metadata) {
        /*jshint expr:true */
        !this.parent || def.fail.operationInvalid("Can only set metadata on root chart.");

        this.metadata = metadata || [];
        if(!this.metadata.length) this._warn("Metadata is empty");

        return this;
    }
});

