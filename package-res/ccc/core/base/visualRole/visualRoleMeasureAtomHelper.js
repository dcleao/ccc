/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

def
.type('pvc.visual.MeasureRoleAtomHelper')
.type()
.add({
    createGetBoundDimensionName: function(measureRole, isChartMode) {
        var grouping = measureRole.grouping;
        if(!isChartMode && grouping.isSingleDimension) {
            return def.fun.constant(grouping.lastDimensionName());
        }

        var roleDiscrimDimName = measureRole.discriminatorDimensionFullName;
        var roleBoundDimsDataSet = measureRole.boundDimensionsDataSet;

        return function(groupData) {
            var discrimAtom = groupData.atoms[roleDiscrimDimName];
            if(discrimAtom === undefined) {
                if(isChartMode) {
                    return null;
                }

                throw new def.error.operationInvalid("Must bind the measure discriminator dimension '" + roleDiscrimDimName + "'.");
            }

            // Is the value dimension one of the visual role's bound dimensions?
            // If multi-chart is bound to the discriminator dimensions and multiple plots with different value role bindings are used,
            // it can happen.
            var dimName = discrimAtom.value;
            if(!roleBoundDimsDataSet.datumByKey(dimName)) {
                return null;
            }

            return dimName;
        };
    },

    getBoundDimensionName: function(measureRole, groupData, isChartMode) {
        var getBoundDimensionName = this.createGetBoundDimensionName(measureRole, isChartMode);
        return getBoundDimensionName(groupData);
    },

    hasCompatibleBoundDimensionName: function(measureRole, groupData) {
        var roleDiscrimDimName = measureRole.discriminatorDimensionFullName;
        var roleBoundDimsDataSet = measureRole.boundDimensionsDataSet;

        var discrimAtom = groupData.atoms[roleDiscrimDimName];
        if(discrimAtom === undefined) {
            return true;
        }

        var dimName = discrimAtom.value;
        return !!roleBoundDimsDataSet.datumByKey(dimName);
    },

    getCompatibleBoundDimensionNames: function(measureRole, groupData) {
        var roleDiscrimDimName = measureRole.discriminatorDimensionFullName;
        var roleBoundDimsDataSet = measureRole.boundDimensionsDataSet;

        var discrimAtom = groupData.atoms[roleDiscrimDimName];
        if(discrimAtom === undefined) {
            return measureRole.grouping.dimensionNames();
        }

        var dimName = discrimAtom.value;
        return roleBoundDimsDataSet.datumByKey(dimName) !== null ? [dimName] : [];
    }
});
