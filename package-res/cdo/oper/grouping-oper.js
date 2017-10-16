/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initializes a grouping operation.
 *
 * @name cdo.GroupingOper
 *
 * @class Performs one grouping operation according to a grouping specification.
 * @extends cdo.DataOper
 *
 * @constructor
 *
 * @param {cdo.Data} linkParent The link parent data.
 *
 * @param {string|string[]|cdo.GroupingSpec|cdo.GroupingSpec[]} groupingSpecs A grouping specification as a string, an object or array of either.
 *
 * @param {object} [keyArgs] Keyword arguments.
 * See {@link cdo.DataOper} for any additional arguments.
 *
 * @param {Object.<string, !cdo.Data>|Array.<Object.<string, !cdo.Data>>} [keyArgs.extensionDataSetsMap] -
 * A data sets map, or an array of, one per provided grouping specification.
 * Each map should contain a data set for each of its grouping specification's required extension complex types:
 * {@link cdo.GroupingSpec#extensionComplexTypeNames}.
 *
 * @param {boolean} [keyArgs.reverse=false] Reverts the sorting order of the dimensions of the given grouping specifications.
 * @param {boolean} [keyArgs.inverted=false] Inverts the given grouping specification array.
 * @param {boolean} [keyArgs.isNull=null] Only considers datums with the specified isNull attribute.
 * @param {boolean} [keyArgs.visible=null] Only considers datums that have the specified visible state.
 * @param {boolean} [keyArgs.selected=null] Only considers datums that have the specified selected state.
 * @param {function} [keyArgs.where] A datum predicate.
 * @param {string} [keyArgs.whereKey] A key for the specified datum predicate.
 * If <tt>keyArgs.where</tt> is specified and this argument is not, the results will not be cached,
 * in which case the new grouping operation will have a null {@link #key} property value.
 */
def.type('cdo.GroupingOper', cdo.DataOper)
.init(function(linkParent, groupingSpecs, keyArgs) {

    groupingSpecs || def.fail.argumentRequired('groupingSpecs');

    this.base(linkParent, keyArgs);

    // Pre-filters
    var where = def.get(keyArgs, 'where');
    var whereKey = (where && def.get(keyArgs, 'whereKey')) || '';
    var isVisible  = def.get(keyArgs, 'visible',  null);
    var isSelected = def.get(keyArgs, 'selected', null);

    this._preFilter = data_wherePredicate(null, {visible: isVisible, selected: isSelected, where: where});

    // Post-filters
    // Must be performed last so that the order of results is not changed.
    // TODO: explain why.
    var isNull = def.get(keyArgs, 'isNull', null);

    this._postFilter = data_wherePredicate(null, {isNull: isNull});

    // GroupingOper key
    // When a grouping operation has no key, its results are not cached.
    // TODO: Selected state changes do not yet invalidate cache...
    var hasKey = isSelected == null && !(where && !whereKey);

    var groupSpecKeys = hasKey ? [] : null;

    groupingSpecs = def.array.as(groupingSpecs);
    if(def.get(keyArgs, 'inverted', false)) {
        groupingSpecs = groupingSpecs.slice().reverse();
    }

    this._extensionDataSetsMaps = def.array.as(def.get(keyArgs, 'extensionDataSetsMap') || []);

    var reverse = def.get(keyArgs, 'reverse', false);

    this._groupSpecs = groupingSpecs.map(function(groupSpec) {

        if(groupSpec instanceof cdo.GroupingSpec) {
            if(groupSpec.complexType !== linkParent.type)
                throw def.error.argumentInvalid('groupingSpecText', "Invalid associated complex type.");
        } else {
            // Must be a non-empty string, or throws
            groupSpec = cdo.GroupingSpec.parse(groupSpec, linkParent.type);
        }

        if(groupSpec.flatteningMode === cdo.FlatteningMode.SingleLevel) {
            groupSpec = groupSpec.toSingleLevel();
        }

        if(reverse) {
            groupSpec = groupSpec.reverse();
        }

        if(hasKey) {
            groupSpecKeys.push(groupSpec.key);
        }

        return groupSpec;
    });

    if(hasKey) {
        this.key = groupSpecKeys.join('!!') + "$" + [isVisible, isNull, whereKey].join('||');
    }
}).
add(/** @lends cdo.GroupingOper# */{

    /**
     * Performs the grouping operation.
     *
     * @return {cdo.Data} The resulting root data.
     */
    execute: function() {
        // Setup a priori datum filters

        var datums = this._linkParent._datums || [];

        var datumsQuery = def.query(datums).where(this._preFilter);

        // Group datums.
        var rootNode = this._group(datumsQuery);

        // Render resulting node into a new linked child data set.
        return this._generateData(rootNode, null, this._linkParent);
    },

    executeAdd: function(rootData, newDatums) {

        var newDatumsQuery = def.query(newDatums).where(this._preFilter);

        // Group new datums
        var newRootNode = this._group(newDatumsQuery);

        // Render resulting node into specified root data.
        this._generateData(newRootNode, null, this._linkParent, rootData);

        return newRootNode.datums;
    },

    _group: function(datumsQuery) {

        // Create the root node
        var rootNode = {
            isRoot: true,
            treeHeight: def
                .query(this._groupSpecs)
                .select(function(spec) {
                    var levelCount = spec.levels.length;
                    if(!levelCount) { return 0; }
                    return (spec.flatteningMode & cdo.FlatteningMode.Dfs) ? 1 : levelCount;
                })
                .reduce(def.add, 0),

            datums: []
            // children
            // atoms       // not on rootNode
            // isFlattenGroup // on parents of a flattened group spec
        };

        if(rootNode.treeHeight > 0) this._groupSpecRecursive(rootNode, def.query(datumsQuery).array(), 0);

        return rootNode;
    },


    _groupSpecRecursive: function(groupParentNode, groupDatums, groupIndex) {

        var groupSpec = this._groupSpecs[groupIndex];
        if(groupSpec.flatteningMode & cdo.FlatteningMode.Dfs)
            this._groupSpecRecursiveFlattened(groupParentNode, groupDatums, groupSpec, groupIndex);
        else
            this._groupSpecRecursiveNormal(groupParentNode, groupDatums, groupSpec, groupIndex);
    },

    _groupSpecRecursiveNormal: function(groupParentNode, groupDatums, groupSpec, groupIndex) {
        var levelSpecs  = groupSpec.levels,
            L           = levelSpecs.length,
            isLastGroup = (groupIndex === this._groupSpecs.length - 1);

        if(groupParentNode.isRoot) groupParentNode.label = groupSpec.rootLabel;

        groupLevelRecursive.call(this, groupParentNode, groupDatums, 0);

        function groupLevelRecursive(levelParentNode, levelDatums, levelIndex) {

            var levelSpec = levelSpecs[levelIndex],
                isLastLevel = (levelIndex === L - 1),
                isLastLevelOfLastGroupSpec = isLastGroup && isLastLevel;

            levelParentNode.groupSpec = groupSpec;
            levelParentNode.groupLevelSpec = levelSpec;

            // ---------------

            var childNodes =
                levelParentNode.children =
                // Child nodes will not yet have been added to levelParentNode.
                this._groupLevelDatums(levelSpec, levelParentNode, levelDatums, /*doFlatten*/false);

            for(var i = 0, C = childNodes.length ; i < C ; i++) {
                var childNode = childNodes[i];

                // `levelParentNode.datums` are set to the datums of its children, in post order.
                // This way, datums order of non-leaf levels will
                //  reflect the grouping "pattern".
                // NOTE: levelParentNode.datums is initially empty

                // Any more levels or grouping specs?
                if(!isLastLevelOfLastGroupSpec) {

                    // Backup child datums, as just grouped.
                    var childDatums = childNode.datums;

                    // Reset datums.
                    childNode.datums = [];

                    // By the end of the following recursive call,
                    // childNode.datums will have been filled again, in post-order.
                    if(!isLastLevel)
                        // NEXT LEVEL
                        groupLevelRecursive.call(this, childNode, childDatums, levelIndex + 1);
                    else /*if(!isLastGroup) */
                        // NEXT GROUPING SPEC
                        this._groupSpecRecursive(childNode, childDatums, groupIndex + 1);
                }

                // Datums were already added to _childNode_.
                def.array.append(levelParentNode.datums, childNode.datums);
            }
        }
    },

    _groupSpecRecursiveFlattened: function(realGroupParentNode, groupDatums, group, groupIndex) {
        var isPostOrder = group.flatteningMode === cdo.FlatteningMode.DfsPost,
            levels = group.levels,
            L      = levels.length,
            isLastGroup = (groupIndex === this._groupSpecs.length - 1),
            flatChildren      = [],
            flatChildrenByKey = {}, // Don't create children with equal keys

            // Must create a rootNode for the grouping operation
            // Cannot be realGroupParentNode. TODO: Why???
            groupParentNode = {
                key:      '', // Key is local to group
                absKey:   '',
                atoms:    {},
                datums:   [],
                label:    group.rootLabel,
                dimNames: []
            },

            addFlatChild = function(child) {
                flatChildren.push(child);
                flatChildrenByKey[child.key] = child;
            };

        realGroupParentNode.children = flatChildren;
        realGroupParentNode.childrenByKey = flatChildrenByKey;

        if(!isPostOrder) addFlatChild(groupParentNode);

        // Group datums
        groupLevelRecursive.call(this, groupParentNode, groupDatums, 0);

        if(isPostOrder) addFlatChild(groupParentNode);

        realGroupParentNode.datums = groupParentNode.datums;

        function groupLevelRecursive(levelParentNode, levelDatums, levelIndex) {
            var level = levels[levelIndex],
                isLastLevel = (levelIndex === L - 1),
                isLastLevelOfLastGroupSpec = isLastGroup && isLastLevel,

                childNodes = this._groupLevelDatums(level, levelParentNode, levelDatums, /*doFlatten*/true),

                // Add children's datums to levelParentNode, in post order.
                // This way, datums are reordered to follow the grouping "pattern".
                //
                // NOTE: levelParentNode.datums is initially empty
                levelParentNodeDatums = !isLastGroup ? [] : levelParentNode.datums;

            for(var i = 0, C = childNodes.length ; i < C ; i++) {
                var childNode = childNodes[i],

                    // `levelParentNode.datums` are set to the datums of its children, in post order.
                    // This way, datums order of non-leaf levels will
                    //  reflect the grouping "pattern".
                    // NOTE: levelParentNode.datums is initially empty
                    childDatums = childNode.datums; // backup original datums

                // Add children at a "hidden" property
                // so that the test "if(!childNode._children.length)"
                // below, can be done.
                def.array.lazy(levelParentNode, '_children').push(childNode);

                if(def.hasOwn(flatChildrenByKey, childNode.key)) {
                    // Duplicate key.
                    // Don't add as child of realGroupParentNode.
                    //
                    // We need to add its datums to group parent, anyway.
                    def.array.append(levelParentNodeDatums, childDatums);
                    continue;
                }

                var specParentChildIndex = flatChildren.length;
                if(!isPostOrder) {
                    addFlatChild(childNode);
                    levelParentNode.isFlattenGroup = true;
                }

                if(!isLastLevelOfLastGroupSpec) {
                    childNode.datums = [];

                    if(!isLastLevel)
                        groupLevelRecursive.call(this, childNode, childDatums, levelIndex + 1);
                    else /*if(!isLastGroup)*/
                        this._groupSpecRecursive(childNode, childDatums, groupIndex + 1);
                }

                // Datums are now already added to 'childNode'.
                def.array.append(levelParentNodeDatums, childNode.datums);

                if(isPostOrder) {
                    if(def.hasOwn(flatChildrenByKey, childNode.key)) {
                        /*jshint expr:true*/
                        childNode.isFlattenGroup || def.assert("Must be a parent for duplicate keys to exist.");

                        // TODO: how I whish I could understand any of this now...
                        //  explain this better, when possible.

                        // A child of childNode
                        // was registered with the same key,
                        // because it is all-nulls (in descending level's keys).
                        // But it is better to show the parent instead of the child,
                        // so we remove the child and add the parent.
                        // Yet, we cannot show only the parent
                        // if *child* has more than one child,
                        // cause then, the datums of the null child.child
                        // would only be in *child*, but
                        // the datums of the non-null child.child
                        // would be both in *child* and in child.child.
                        // This would mess up the scales and waterfall control code,
                        // not knowing whether to ignore the flatten group or not.
                        if(childNode._children.length === 1) {
                            flatChildren.splice(
                                    specParentChildIndex,
                                    flatChildren.length - specParentChildIndex);

                            // A total group that must be accounted for
                            // because it has own datums.
                            childNode.isDegenerateFlattenGroup = true;
                        }
                        // else, both are added to realGroupParentNode,
                        // and their datas will be given separate keys
                        // they will both be shown.
                        // Below, we overwrite anyway, with no harmful effect
                    }

                    addFlatChild(childNode);
                    levelParentNode.isFlattenGroup = true;
                }
            }

            // datums can no longer change
            if(!isLastGroup) this._groupSpecRecursive(levelParentNode, levelParentNodeDatums, groupIndex + 1);
        }
    },

    _groupLevelDatums: function(level, levelParentNode, levelDatums, doFlatten) {
        // The first child is inserted here at the same index as that of
        // the first datum in levelDatums; uses nodeComparer to insertSort.
        var childNodeList = [];
        var childNodeMap  = {};

        var mainDatumComparer = level.mainDatumComparer;
        var nodeComparer = function(na, nb) { return mainDatumComparer(na.firstDatum, nb.firstDatum); };

        var postFilter = this._postFilter;
        var keySep; // for flattened nodes

        // Group levelDatums By the level#buildDatumKey(.)
        for(var i = 0, L = levelDatums.length ; i < L ; i++) {

            var datum = levelDatums[i];
            var key = level.buildDatumKey(datum);
            var childNode = def.hasOwnProp.call(childNodeMap, key) && childNodeMap[key];

            if(childNode) {
                // Add datum to existing childNode of same key
                if(!postFilter || postFilter(datum)) {
                    childNode.datums.push(datum);
                }
            } else {
                // First datum with key -> new child
                /*  childNode = { atoms: {}, dimNames: [] } */
                childNode = level.atomsInfo(datum);
                childNode.key = key;
                childNode.firstDatum = datum;
                childNode.datums = !postFilter || postFilter(datum) ? [datum] : [];

                if(doFlatten) {
                    if(!keySep) keySep = datum.owner.keySep;
                    this._onNewChildNodeFlattened(key, keySep, childNode, level, levelParentNode);
                }

                def.array.insert(childNodeList, childNode, nodeComparer);
                childNodeMap[key] = childNode;
            }
        }

        if(postFilter) {
            // remove nodes that ended up with no datums passing the filter
            i = childNodeList.length;
            while(i--) if(!childNodeList[i].datums.length) childNodeList.splice(i, 1);
        }

        return childNodeList;
    },

    _onNewChildNodeFlattened: function(key, keySep, childNode, level, levelParentNode) {
        // `childNode.atoms` must contain (locally) those of the levelParentNode,
        // so that when flattened, they have a unique key.
        // TODO: this seems buggy. What about null atoms, do they get copied as well?
        // Also, does this need to be done when !levelParentNode.dimNames.atoms.
        def.copy(childNode.atoms, levelParentNode.atoms);

        childNode.dimNames = level.accDimensionNames();

        // The _key_ is the _absKey_, trimmed of keySep at the end.
        // Foo~Bar~~~~ <--- this happens because of null values.
        if(levelParentNode.dimNames.length) {
            var absKey = levelParentNode.absKey + keySep + key;
            childNode.absKey = absKey;
            childNode.key    = cdo.Complex.rightTrimKeySep(absKey, keySep);
        } else {
            childNode.absKey = key;
        }
    },

    _generateData: function(node, parentNode, parentData, rootData) {
        var data, isNew;
        if(node.isRoot) {
            // Root node
            if(rootData) {
                data = rootData;
                /*global cdo_addDatumsLocal:true*/
                cdo_addDatumsLocal.call(data, node.datums);
            } else {
                isNew = true;

                // Create a *linked* rootNode data
                data = new cdo.Data({
                    linkParent: parentData,
                    datums:     node.datums
                });
                data.treeHeight = node.treeHeight;
                data._groupOper = this;
            }
        } else {
            if(rootData) {
                data = parentData.child(node.key);
                // Add the datums to the data, and its atoms to its dimensions
                // Should also update linkedChildren (not children).
                /*global cdo_addDatumsSimple:true*/
                if(data) cdo_addDatumsSimple.call(data, node.datums);
            }

            if(!data) {
                isNew = true;
                var index, siblings;
                // Insert the new sibling in correct order
                // node.datums[0] is representative of the new Data's position
                if(rootData && (siblings = parentData.childNodes))
                    index = ~def.array.binarySearch(
                        siblings,
                        node.datums[0],
                        parentNode.groupLevelSpec.mainDatumComparer);

                data = new cdo.Data({
                    parent:   parentData,
                    atoms:    node.atoms,
                    atomsDimNames: node.dimNames,
                    datums:   node.datums,
                    index:    index
                });
            }
        }

        if(isNew) {
            if(node.isFlattenGroup) {
                data._isFlattenGroup = true;
                data._isDegenerateFlattenGroup = !!node.isDegenerateFlattenGroup;
            }

            var label = node.label;
            if(label) {
                data.label    += label;
                data.absLabel += label;
            }
        }

        var childNodes = node.children;
        var L = childNodes && childNodes.length;
        if(L) {
            if(isNew) {
                data._groupSpec      = node.groupSpec;
                data._groupLevelSpec = node.groupLevelSpec;
            }

            for(var i = 0 ; i < L ; i++) this._generateData(childNodes[i], node, data, rootData);
        } else if(isNew && !node.isRoot) {
            // A leaf node
            var leafs = data.root._leafs;
            data.leafIndex = leafs.length;
            leafs.push(data);
        }

        return data;
    }
});
