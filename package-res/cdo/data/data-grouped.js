/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

def.type('cdo.GroupingData', cdo.Data)
.init(function(keyArgs) {

    if(keyArgs == null) throw def.error.argumentRequired('keyArgs');

    this.base(keyArgs);

    /**
     * The grouping operation that created this data.
     *
     * @type {!cdo.GroupingOper}
     * @private
     */
    this.groupingOper = keyArgs.groupingOper || def.fail.argumentRequired('keyArgs.groupingOper');

    // The main reason for only parents having the groupingSpec and groupingLevel is
    // that a data set which is at the border between two groupingSpecs is both a leaf of a previous grouping
    // and a root of the following grouping.
    // Not wanting/needing to have properties for both, we chose those where the data set plays the parent role.

    /**
     * The grouping specification that was used to group the child data sets of this data set.
     *
     * Only set on parent data sets.
     *
     * @type {cdo.GroupingSpec}
     * @private
     */
    this.groupingSpec = keyArgs.groupingSpec || null;

    /**
     * The grouping level specification used to group the child data sets of this data set.
     *
     * Only set on parent data sets.
     *
     * @type {cdo.GroupingLevelSpec}
     * @private
     */
    this.groupingLevelSpec = keyArgs.groupingLevelSpec || null;
});

def.type('cdo.GroupingRootData', cdo.GroupingData)
.init(function(keyArgs) {

    // Always a root, linked data.
    if(keyArgs == null || keyArgs.parent != null || keyArgs.linkParent == null) {
        throw def.error.argumentRequired('keyArgs.linkParent');
    }

    this.base(keyArgs);
})
.add(/** @lends cdo.GroupingRootData# */{

    _addDatumsSimple: function(newDatums) {

        // This data gets its datums, possibly filtered (_groupOper.executeAdd calls _addDatumsLocal).
        // Children get their new datums.
        // Linked children of children get their new datums.
        newDatums = this.groupingOper.executeAdd(this, newDatums);

        this._onDatumsAdded(newDatums);
    }
});

def.type('cdo.GroupData', cdo.GroupingData)
.init(function(keyArgs) {

    // Always a non-root data.
    if(keyArgs == null || keyArgs.parent == null) {
        throw def.error.argumentRequired('keyArgs.parent');
    }

    this.base(keyArgs);
});
