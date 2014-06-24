/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * CategoricalAbstract is the base class for all categorical or timeseries
 */
def
.type('pvc.CategoricalAbstract', pvc.CartesianAbstract)
.add({
    _interpolatable: true,

    /** @override */
    _interpolateDataCell: function(dataCell, baseData) {
        var InterpType = this._getNullInterpolationOperType(dataCell.nullInterpolationMode);
        if(InterpType) {
            this._warnSingleContinuousValueRole(dataCell.role);
            var partValue   = dataCell.dataPartValue,
                partData    = this.partData(partValue, baseData),
                visibleData = this.visiblePlotData(dataCell.plot, partValue, {baseData: baseData});// [ignoreNulls=true]
            if(visibleData.childCount() > 0) {
                new InterpType(
                    baseData,
                    partData,
                    visibleData,
                    this.visualRoles.category,
                    this.visualRoles.series,
                    /*valRole*/dataCell.role,
                    /*stretchEnds*/true) // dataCell.isStacked
                .interpolate();
            }
        }
    },

    _getNullInterpolationOperType: function(nim) {
        switch(nim) {
            case 'linear': return cdo.LinearInterpolationOper;
            case 'zero':   return cdo.ZeroInterpolationOper;
            case 'none':   break;
            default: throw def.error.argumentInvalid('nullInterpolationMode', '' + nim);
        }
    },

    /** @override */
    _generateTrendsDataCell: function(newDatums, dataCell, baseData) {
        var serRole = this.visualRoles.series,
            xRole   = this.visualRoles.category,
            yRole   = dataCell.role,
            trendOptions = dataCell.trend,
            trendInfo = trendOptions.info;

        this._warnSingleContinuousValueRole(yRole);

        var yDimName = yRole.lastDimensionName(),
            xDimName,
            isXDiscrete = xRole.isDiscrete();
        if(!isXDiscrete) xDimName = xRole.lastDimensionName();

        var sumKeyArgs = {zeroIfNone: false},
            partData = this.partData(dataCell.dataPartValue, baseData),
            // Visible data grouped by category and then series
            data = this.visiblePlotData(dataCell.plot, dataCell.dataPartValue, {baseData: baseData}), // [ignoreNulls=true]
            dataPartAtom = this._getTrendDataPartAtom(),
            dataPartDimName = dataPartAtom.dimension.name,
            // TODO: It is usually the case, but not certain, that the base axis'
            // dataCell(s) span "all" data parts.
            allCatDatas = xRole.flatten(baseData, {visible: true}).childNodes,
            qVisibleSeries = serRole && serRole.isBound()
                    ? serRole.flatten(partData, {visible: true}).children()
                    : def.query([null]); // null series

        qVisibleSeries.each(genSeriesTrend, this);

        function genSeriesTrend(serData1) {
            var funX = isXDiscrete
                    ? null  // means: "use *index* as X value"
                    : function(allCatData) { return allCatData.atoms[xDimName].value;},

                funY = function(allCatData) {
                        var group = data.child(allCatData.key);
                        if(group && serData1) group = group.child(serData1.key);
                        // When null, the data point ends up being ignored
                        return group ? group.dimensions(yDimName).value(sumKeyArgs) : null;
                    },

                options = def.create(trendOptions, {
                    rows: def.query(allCatDatas),
                    x: funX,
                    y: funY
                }),
                trendModel = trendInfo.model(options);

            if(trendModel) {
                // At least one point...
                // Sample the line on each x and create a datum for it
                // on the 'trend' data part
                allCatDatas.forEach(function(allCatData, index) {
                    var trendX = isXDiscrete ?
                                 index :
                                 allCatData.atoms[xDimName].value,
                        trendY = trendModel.sample(trendX, funY(allCatData), index);

                    if(trendY != null) {
                        var catData   = data.child(allCatData.key),
                            efCatData = catData || allCatData,
                            atoms;
                        if(serData1) {
                            var catSerData = catData && catData.child(serData1.key);
                            if(catSerData) {
                                atoms = Object.create(catSerData._datums[0].atoms);
                            } else {
                                // Missing data point
                                atoms = Object.create(efCatData._datums[0].atoms);

                                // Now copy series atoms
                                def.copyOwn(atoms, serData1.atoms);
                            }
                        } else {
                            // Series is unbound
                            atoms = Object.create(efCatData._datums[0].atoms);
                        }

                        atoms[yDimName] = trendY;
                        atoms[dataPartDimName] = dataPartAtom;

                        newDatums.push(new cdo.TrendDatum(efCatData.owner, atoms, trendOptions));
                    }
                }, this);
            }
        }
    }
});
