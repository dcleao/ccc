/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// TODO: I think the construction of Levels and Dimensions should be done from within the parent Grouping and Level.
// The way it is, it just looks awkward and some validations are not even being performed, like ensuring that the
// received levelSpecs/dimSpecs are consistent with the given complexType and extensionComplexTypesMap.
// The reason for this being like this might have to do it #ensure. Even so, there might be a way around it.

def
.space('cdo')
.FlatteningMode =
    def.set(
        def.makeEnum([
            'DfsPre', // Same grouping levels and dimensions, but all nodes are output at level 1
            'DfsPost' // Idem, but in Dfs-Post order
        ]),
        // Add None with value 0
        'None', 0);

/**
 * Initializes a grouping specification.
 *
 * <p>
 * A grouping specification contains information similar to that of an SQL 'order by' clause.
 * </p>
 *
 * <p>
 * A grouping specification supports the grouping operation.
 * </p>
 *
 * @see cdo.GroupingOper
 *
 * @name cdo.GroupingSpec
 *
 * @class
 *
 * @property {string}  key A <i>semantic</i> hash of this grouping specification.
 * @property {boolean} isNull Indicates that there are no levels, and dimensions.
 * @property {boolean} isSingleDimension Indicates that there is only one level and dimension.
 * @property {boolean} isSingleLevel Indicates that there is only one level.
 * @property {boolean} hasExtensionComplexTypes Indicates if there are any extension complex types.
 * @property {cdo.ComplexType} type The complex type against which dimension names were resolved.
 * @property {string[]} extensionComplexTypeNames The names of extension complex types, if any.
 * @property {cdo.GroupingLevelSpec} levels An array of level specifications.
 * @property {cdo.GroupingDimensionSpec} firstDimension The first dimension specification, if any.
 * @property {cdo.GroupingDimensionSpec} lastDimension The last dimension specification, if any.
 * @property {cdo.FlatteningMode} flatteningMode The flattening mode.
 * @property {string} rootLabel The label of the resulting root node.
 *
 * @constructor
 * @param {def.Query} levelSpecs An enumerable of {@link cdo.GroupingLevelSpec}.
 * @param {cdo.ComplexType} [type] A complex type.
 * @param {Object.<string, cdo.ComplexType>} [extensionComplexTypesMap] A map of extension complex types by name.
 * @param {object} [ka] Keyword arguments.
 * @param {cdo.FlatteningMode} [ka.flatteningMode=cdo.FlatteningMode.None] The flattening mode.
 * @param {string} [ka.rootLabel=''] The label of the root node.
 */
def.type('cdo.GroupingSpec')
.init(function(levelSpecs, complexType, extensionComplexTypesMap, ka) {

    // Bound at construction time?
    this.complexType = complexType || null;

    var referencedExtensionComplexTypeNamesMap = null;

    var levelKeys = [];

    // Accumulated main dimension names, from first level to last.
    var accMainDimNames = [];

    this.levels = def.query(levelSpecs || undefined) // -> null query
        // Filter out empty levels....
        .where(function(levelSpec) {
            return levelSpec.allDimensions.length > 0;
        })
        .select(function(levelSpec) {

            levelKeys.push(levelSpec.key);

            levelSpec.allDimensions.forEach(function(dimSpec) {

                // Register referenced complex type names.
                if(dimSpec.dataSetName) {
                    if(!referencedExtensionComplexTypeNamesMap) {
                        referencedExtensionComplexTypeNamesMap = Object.create(null);
                    }

                    referencedExtensionComplexTypeNamesMap[dimSpec.dataSetName] = true;
                } else {
                    // Accumulate main dimension names.
                    accMainDimNames.push(dimSpec.name);
                }
            });

            // Provide the level with the accumulated main dimensions names.
            levelSpec._setAccDimNames(accMainDimNames.slice(0));

            return levelSpec;
        })
        .array();

    this.extensionComplexTypesMap = null;
    this.extensionComplexTypeNames =
        referencedExtensionComplexTypeNamesMap && Object.keys(referencedExtensionComplexTypeNamesMap);

    if(referencedExtensionComplexTypeNamesMap) {
        this._setExtensionComplexTypesMap(extensionComplexTypesMap);
    }

    // TODO: should this contain only distinct dimension names?
    this._dimNames = accMainDimNames;

    this.depth = this.levels.length;

    this.firstDimension = this.depth > 0 ? this.levels[0].dimensions[0] : null;
    this.lastDimension  = this.depth > 0 ? this.levels[this.depth - 1].lastDimension() : null;

    this.rootLabel = def.get(ka, 'rootLabel') || "";
    this.flatteningMode = def.get(ka, 'flatteningMode') || cdo.FlatteningMode.None;

    // @see #ensure
    this._cacheKey = this._calcCacheKey();

    // NOTE: `levelKeys` already reflects `referencedExtensionComplexTypeNamesMap`.
    this.key = this._cacheKey + "##" + levelKeys.join('||');
})
.add(/** @lends cdo.GroupingSpec# */{

    _calcCacheKey: function(ka) {
        return [def.get(ka, 'flatteningMode') || this.flatteningMode,
                def.get(ka, 'reverse'       ) || 'false',
                def.get(ka, 'isSingleLevel' ) || this.isSingleLevel,
                def.get(ka, 'rootLabel'     ) || this.rootLabel]
               .join('#');
    },

    /**
     * Late binds a grouping specification to a complex type and, optionally, to a set of extension complex types.
     *
     * @param {!cdo.ComplexType} complexType A complex type.
     * @param {Object.<string, cdo.ComplexType>} [extensionComplexTypesMap] A map of extension complex types by name.
     */
    bind: function(complexType, extensionComplexTypesMap) {

        this.complexType = complexType || def.fail.argumentRequired('complexType');

        this._setExtensionComplexTypesMap(extensionComplexTypesMap);

        extensionComplexTypesMap = this.extensionComplexTypesMap;

        this.levels.forEach(function(levelSpec) {
            levelSpec.bind(complexType, extensionComplexTypesMap);
        });
    },

    get isBound() {
        return !!this.complexType;
    },

    _setExtensionComplexTypesMap: function(extensionComplexTypesMap) {

        if(this.hasExtensionComplexTypes) {
            if(!extensionComplexTypesMap) {
                throw def.error.operationInvalid("Expects a map of extension types.");
            }

            this.extensionComplexTypesMap = def.copyProps(extensionComplexTypesMap, this.extensionComplexTypeNames);
        } else {
            this.extensionComplexTypesMap = null;
        }
    },

    /**
     * Obtains an enumerable of the contained dimension specifications.
     *
     * @type def.Query
     */
    dimensions: function() {
        return def.query(this.levels).prop('dimensions').selectMany();
    },

    get allDimensions() {
        return def.query(this.levels).prop('allDimensions').selectMany();
    },

    /**
     * The names of the main dimensions of this grouping.
     *
     * @type {!string[]}
     */
    dimensionNames: function() {
        return this._dimNames;
    },

    get isNull() {
        return this.depth === 0;
    },

    get isSingleLevel() {
        return this.depth === 1;
    },

    get isSingleDimension() {
        return this._dimNames.length === 1;
    },

    get hasExtensionComplexTypes() {
        return !!this.extensionComplexTypeNames;
    },

    view: function(complex) {
        return complex.view(this.dimensionNames());
    },

    /**
     * Indicates if the data resulting from the grouping is discrete or continuous.
     * @type boolean
     */
    isDiscrete: function() {
        var d;
        return !this.isSingleDimension ||
               (!!(d = this.lastDimension) && d.dimensionType.isDiscrete);
    },

    /**
     * Obtains the dimension type of the first dimension spec., if any.
     * @type cdo.DimensionType
     */
    firstDimensionType: function() {
        var d = this.firstDimension;
        return d && d.dimensionType;
    },

    /**
     * Obtains the dimension name of the first dimension spec., if any.
     * @type string
     */
    firstDimensionName: function() {
        var dt = this.firstDimensionType();
        return dt && dt.name;
    },

    /**
     * Obtains the dimension value type of the first dimension spec., if any.
     * @type string
     */
    firstDimensionValueType: function() {
        var dt = this.firstDimensionType();
        return dt && dt.valueType;
    },

    /**
     * Obtains the dimension type of the last dimension spec., if any.
     * @type cdo.DimensionType
     */
    lastDimensionType: function() {
        var d = this.lastDimension;
        return d && d.dimensionType;
    },

    /**
     * Obtains the dimension name of the last dimension spec., if any.
     * @type string
     */
    lastDimensionName: function() {
        var dt = this.lastDimensionType();
        return dt && dt.name;
    },

    /**
     * Obtains the dimension value type of the last dimension spec., if any.
     * @type string
     */
    lastDimensionValueType: function() {
        var dt = this.lastDimensionType();
        return dt && dt.valueType;
    },

    // region Ensure
    /**
     * Obtains a version of this grouping specification
     * that conforms to the specified arguments.
     *
     * @param {string}  [ka.flatteningMode] The desired flattening mode.
     * @param {boolean} [ka.isSingleLevel=false] Indicates that the grouping should have only a single level.
     * If that is not the case, all grouping levels are collapsed into a single level containing all dimensions.
     *
     * @param {boolean} [ka.reverse=false] Indicates that each dimension's order should be reversed.
     * @param {string}  [ka.rootLabel] The label of the resulting root node.
     *
     * @type cdo.GroupingSpec
     */
    ensure: function(ka) {
        var result;
        if(ka) {
            var cacheKey = this._calcCacheKey(ka);
            if(cacheKey !== this._cacheKey) {
                var cache = def.lazy(this, '_groupingCache');
                result = def.getOwn(cache, cacheKey);
                if(!result) result = cache[cacheKey] = this._ensure(ka);
            }
        }

        return result || this;
    },

    _ensure: function(ka) {
        var me = this;

        if(def.get(ka, 'isSingleLevel') && !me.isSingleLevel) return me._singleLevelGrouping(ka);
        if(def.get(ka, 'reverse')) return me._reverse(ka);

        var flatteningMode = def.get(ka, 'flatteningMode') || me.flatteningMode,
            rootLabel      = def.get(ka, 'rootLabel') || me.rootLabel;

        if(flatteningMode !== me.flatteningMode || rootLabel !== me.rootLabel)
            return new cdo.GroupingSpec(
                me.levels, // Share Levels
                me.complexType,
                me.extensionComplexTypesMap,
                {
                    flatteningMode: flatteningMode,
                    rootLabel:      rootLabel
                });

        return me;
    },

    /**
     * Obtains a single-level version of this grouping specification.
     *
     * @param {object} [ka] Keyword arguments
     * @param {boolean} [ka.reverse=false] Indicates that each dimension's order should be reversed.
     * @param {string} [ka.rootLabel] The label of the resulting root node.
     * @type cdo.GroupingSpec
     */
    _singleLevelGrouping: function(ka) {
        var reverse = !!def.get(ka, 'reverse'),
            dimSpecs = this .dimensions()
                .select(function(dimSpec) {
                    return reverse
                        ? new cdo.GroupingDimensionSpec(dimSpec.name, !dimSpec.reverse, dimSpec.dimensionType)
                        : dimSpec;
                }),
            levelSpec = new cdo.GroupingLevelSpec(dimSpecs, this.complexType, this.extensionComplexTypesMap);

        return new cdo.GroupingSpec([levelSpec], this.complexType, this.extensionComplexTypesMap, {
            flatteningMode: null, // turns into singleLevel
            rootLabel:      def.get(ka, 'rootLabel') || this.rootLabel
        });
    },

    /**
     * Obtains a reversed version of this grouping specification.
     * @param {object} [ka] Keyword arguments
     * @param {string} [ka.rootLabel] The label of the resulting root node.
     * @type cdo.GroupingSpec
     */
    _reverse: function(ka) {
        var levelSpecs = def.query(this.levels)
            .select(function(levelSpec) {
                var dimSpecs = def.query(levelSpec.dimensions)
                        .select(function(dimSpec) {
                            return new cdo.GroupingDimensionSpec(dimSpec.name, !dimSpec.reverse, dimSpec.dimensionType);
                        });

                return new cdo.GroupingLevelSpec(dimSpecs, this.complexType, this.extensionComplexTypesMap);
            }, this);

        return new cdo.GroupingSpec(levelSpecs, this.complexType, this.extensionComplexTypesMap, {
            flatteningMode: def.get(ka, 'flatteningMode') || this.flatteningMode,
            rootLabel:      def.get(ka, 'rootLabel'     ) || this.rootLabel
        });
    },
    // endregion

    toString: function() {
        return this.levels.map(String).join(', ');
    }
});

/**
 * A grouping level describes the structure of one level of a hierarchical grouping operation.
 *
 * A grouping level corresponds to one level of the data tree that results from a grouping operation.
 *
 * The dimensions of the grouping level determine the fixed atoms that each data of that level will have.
 *
 * Essentially, a grouping level contains an array of dimension specifications, in {@link #dimensions}.
 *
 * @name cdo.GroupingLevelSpec
 * @class
 */
def.type('cdo.GroupingLevelSpec')
.init(function(allDimSpecs) {

    // Collect keys and names.
    var allDimKeys = [];
    var dimNames = [];
    var dimensions = [];

    this.dimensions = dimensions;

    this.allDimensions = def.query(allDimSpecs)
       .select(function(dimSpec) {

           allDimKeys.push(dimSpec.key);

           if(!dimSpec.dataSetName) {
               dimNames.push(dimSpec.name);
               dimensions.push(dimSpec);
           }

           return dimSpec;
       })
       .array();

    this.depth = this.dimensions.length;

    // Can contain duplicate names.
    this._dimNames = dimNames;

    // Set by #_setAccDimNames.
    this._accDimNames = null;

    this.key = allDimKeys.join(',');

    this.mainDatumComparer = this.compareMainDatums.bind(this);

    this.hasExtensionDimensions = this.depth !== dimensions.length;
})
.add( /** @lends cdo.GroupingLevelSpec# */{

    _setAccDimNames: function(accDimNames) {
        this._accDimNames = accDimNames;
    },

    // Accumulated main dimensions names.
    accDimensionNames: function() {
        return this._accDimNames;
    },

    dimensionNames: function() {
        return this._dimNames;
    },

    lastDimension: function() {
        return this.allDimensions[this.depth - 1];
    },

    bind: function(complexType, extensionComplexTypesMap) {

        this.allDimensions.forEach(function(dimSpec) {
            dimSpec.bindComplexType(complexType, extensionComplexTypesMap);
        });
    },

    compareMainDatums: function(datumA, datumB) {
        var dims = this.dimensions;
        var D = dims.length;
        var result;

        for(var i = 0 ; i < D ; i++)
            if((result = dims[i].compareMainDatums(datumA, datumB)) !== 0)
                return result;
        return 0;
    },

    buildDatumKey: function(datum) {
        return cdo.Complex.compositeKey(datum, this._dimNames);
    },

    atomsInfo: function(datum) {
        var atoms    = {},
            dimNames = this._dimNames,
            D        = this.depth,
            datoms   = datum.atoms;

        // See also cdo.Complex.compositeKey
        for(var i = 0 ; i < D ; i++) {
            var dimName = dimNames[i];
            atoms[dimName] = datoms[dimName];
        }

        return {atoms: atoms, dimNames: dimNames};
    },

    toString: function() {
        return def.query(this.allDimensions).select(String).array().join('|');
    }
});

/**
 * @name cdo.GroupingDimensionSpec
 * @class
 */
def.type('cdo.GroupingDimensionSpec')
.init(function(fullName, reverse, dimensionType) {

    // e.g. "valueRole.dim"
    this.fullName = fullName;

    // Parse name into dataSetName and name.
    var m = /^(?:(.+?)\.)?(.+)$/.exec(fullName);

    // main dataSet has name null
    this.dataSetName = (m && m[1]) || null; // e.g. "valueRole"
    this.name = m ? m[2] : fullName;        // e.g. "dim"

    this.reverse = !!reverse;

    this.key = fullName + ":" + (reverse ? '0' : '1');

    this.dimensionType = null;
    this.mainAtomComparer = null;

    if(dimensionType) this.bind(dimensionType);
})
.add( /** @lends cdo.GroupingDimensionSpec */ {
    /**
     * Late binds a dimension specification to a complex type.
     *
     * @param {!cdo.ComplexType} complexType - A complex type.
     * @param {Object.<string, cdo.ComplexType>} [extensionComplexTypesMap] A map of extension complex types by name.
     *
     * @return {!cdo.GroupingDimensionSpec} `this` instance.
     */
    bindComplexType: function(complexType, extensionComplexTypesMap) {

        complexType || def.fail.argumentRequired('complexType');

        var dimComplexType;
        if(this.dataSetName) {
            var extensionComplexType = def.get(extensionComplexTypesMap, this.dataSetName);
            if(!extensionComplexType)
                throw def.error.operationInvalid("The data set name '{0}' of dimension '{1}' is not defined.", [
                    this.dataSetName,
                    this.fullName
                ]);

            dimComplexType = extensionComplexType;
        } else {
            dimComplexType = complexType;
        }

        this.bind(dimComplexType.dimensions(this.name));

        return this;
    },

    /**
     * Late binds a dimension specification to its dimension type.
     *
     * @param {!cdo.DimensionType} dimensionType - A dimension type.
     *
     * @return {!cdo.GroupingDimensionSpec} `this` instance.
     */
    bind: function(dimensionType) {
        this.dimensionType = dimensionType || def.fail.argumentRequired('dimensionType');
        this.mainAtomComparer = dimensionType.atomComparer(this.reverse);

        return this;
    },

    // TODO: Define this method to suite the specific case, which is known since bind...
    compareMainDatums: function(datumA, datumB) {
        if(this.dimensionType.isComparable) {
            var name = this.name;
            return this.mainAtomComparer(datumA.atoms[name], datumB.atoms[name]);
        }

        // Use datum source order
        return this.reverse ? (datumB.id - datumA.id) : (datumA.id - datumB.id);
    },

    toString: function() {
        return this.fullName +
            (this.dimensionType ? (' ("' + this.dimensionType.label + '")') : '') +
            (this.reverse       ? ' desc'                                   : '');
    }
});

/**
 * Parses a grouping specification string.
 *
 * @param {string|string[]} [specText] The grouping specification text,
 * or array of grouping specification level text.
 * When unspecified, a null grouping is returned.
 *
 * <p>
 * An example:
 * </p>
 * <pre>
 * "series1 asc, series2 desc, category"
 * </pre>
 * <p>
 * The following will group all the 'series' in one level and the 'category' in another:
 * </p>
 * <pre>
 * "series1 asc|series2 desc, category"
 * </pre>
 *
 * @param {cdo.ComplexType} [complexType] The main complex type against which to resolve dimension names.
 * @param {Object.<string, cdo.ComplexType>} [extensionComplexTypesMap] A map of extension complex types by name.
 *
 * @return {!cdo.GroupingSpec} The new grouping specification.
 */
cdo.GroupingSpec.parse = function(specText, complexType, extensionComplexTypesMap) {

    var levelSpecs = null;

    if(specText) {
        var levels = def.string.is(specText)
            ? specText.split(/\s*,\s*/)
            : def.array.as(specText);

        levelSpecs = def.query(levels)
            .select(function(levelText) {
                var dimSpecs = groupSpec_parseGroupingLevel(levelText, complexType, extensionComplexTypesMap);

                return new cdo.GroupingLevelSpec(dimSpecs, complexType, extensionComplexTypesMap);
            });
    }

    return new cdo.GroupingSpec(levelSpecs, complexType, extensionComplexTypesMap);
};

var groupSpec_matchDimSpec = /^\s*(.+?)(?:\s+(asc|desc))?\s*$/i;

/**
 * @private
 * @static
 */
function groupSpec_parseGroupingLevel(groupLevelText, complexType, extensionComplexTypesMap) {

    def.string.is(groupLevelText) || def.fail.argumentInvalid('groupLevelText', "Invalid grouping specification.");

    return def.query(groupLevelText.split(/\s*\|\s*/))
       .where(def.truthy)
       .select(function(dimSpecText) {
            var match = groupSpec_matchDimSpec.exec(dimSpecText) ||
                            def.fail.argumentInvalid(
                                'groupLevelText',
                                "Invalid grouping level syntax '{0}'.",
                                [dimSpecText]);
            var name = match[1];
            var order = (match[2] || '').toLowerCase();
            var reverse = order === 'desc';

            var dimSpec = new cdo.GroupingDimensionSpec(name, reverse);
            if(complexType) {
                dimSpec.bindComplexType(complexType, extensionComplexTypesMap);
            }
            return dimSpec;
        });
}
