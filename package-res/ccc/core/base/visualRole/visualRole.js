/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

def
.space('pvc.visual')
.TraversalMode = def.makeEnum([
    'Tree',                 // No flattening.
    'FlattenedSingleLevel', // Flattened the dimensions to a single grouping level.
    'FlattenDfsPre',        // Flattened. Same grouping levels and dimensions,
                            //   but all nodes are output, in Dfs-pre order, at level 1.
    'FlattenDfsPost'        // Flattened. Idem, but in Dfs-Post order
]);

/**
 * Initializes a visual role.
 * 
 * @name pvc.visual.Role
 * 
 * @class Represents a role that is somehow played by a visualization.
 * 
 * @property {string} name The name of the role.
 * @property {pvc.visual.Plot} plot The owner plot of the visual role, when there is one.
 * @property {string} label
 * The label of this role.
 * The label <i>should</i> be unique on a visualization.
 *
 * @property {cdo.GroupingSpec} grouping The grouping specification currently bound to the visual role.
 * 
 * @property {boolean} isRequired Indicates that the role is required and must be satisfied.
 * 
 * @property {boolean} requireSingleDimension Indicates that the role can only be satisfied by a single dimension.
 * A {@link pvc.visual.Role} of this type must have an associated {@link cdo.GroupingSpec}
 * that has {@link cdo.GroupingSpec#isSingleDimension} equal to <tt>true</tt>.
 * 
 * @property {boolean} valueType When not nully, 
 * restricts the allowed value type of the single dimension of the 
 * associated {@link cdo.GroupingSpec} to this type.
 * 
 * @property {boolean|null} requireIsDiscrete
 * Indicates if 
 * only discrete, when <tt>true</tt>, 
 * continuous, when <tt>false</tt>, 
 * or any, when <tt>null</tt>,
 * groupings are accepted.
 * 
 * @property {string} defaultDimensionName The default dimension name.
 *
 * @property {boolean} autoCreateDimension Indicates if a dimension with the default name (the first level of, when a group name),
 * should be created when the role has not been read by a translator (required or not).
 *
 * @constructor
 * @param {string} name The local name of the role.
 * @param {object} [keyArgs] Keyword arguments.
 * @param {string} [keyArgs.plot] The owner plot of the visual role, when there is one.
 * @param {string} [keyArgs.label] The label of this role.
 *
 * @param {boolean} [keyArgs.isRequired=false] Indicates a required role.
 * 
 * @param {boolean} [keyArgs.requireSingleDimension=false] Indicates that the role 
 * can only be satisfied by a single dimension. 
 * 
 * @param {boolean} [keyArgs.isMeasure=false] Indicates that <b>datums</b> that do not 
 * contain a non-null atom in any of the dimensions bound to measure roles should be readily excluded.
 * 
 * @param {boolean} [keyArgs.valueType] Restricts the allowed value type of dimensions.
 * 
 * @param {boolean|null} [keyArgs.requireIsDiscrete=null] Indicates if the grouping should be discrete, continuous or any.
 * 
 * @param {string} [keyArgs.defaultDimensionName] The default dimension name.
 * @param {boolean} [keyArgs.autoCreateDimension=false]
 * Indicates if a dimension with the default name (the first level of, when a group name),
 * should be created when the role is required and it has not been read by a translator.
 *
 * @param {pvc.visual.TraversalMode} [keyArgs.traversalMode=pvc.visual.TraversalMode.FlattenedSingleLevel] 
 * Indicates the type of data nodes traversal that the role performs.
 */
def
.type('pvc.visual.Role')
.init(function(name, keyArgs) {
    this.name  = name;
    this.label = def.get(keyArgs, 'label') || def.titleFromName(name);
    this.index = def.get(keyArgs, 'index') || 0;
    this.plot  = def.get(keyArgs, 'plot');

    this.dimensionDefaults = def.get(keyArgs, 'dimensionDefaults') || {};
    
    if(def.get(keyArgs, 'isRequired', false)) this.isRequired = true;
    if(def.get(keyArgs, 'autoCreateDimension', false)) this.autoCreateDimension = true;
    
    var defaultSourceRoleName = def.get(keyArgs, 'defaultSourceRole');
    if(defaultSourceRoleName) this.defaultSourceRoleName = defaultSourceRoleName;
    
    var defaultDimensionName = def.get(keyArgs, 'defaultDimension');
    if(defaultDimensionName) this.defaultDimensionName = defaultDimensionName;

    if(!defaultDimensionName && this.autoCreateDimension) 
        throw def.error.argumentRequired('defaultDimension');
    
    var requireSingleDimension,
        requireIsDiscrete = def.get(keyArgs, 'requireIsDiscrete'); // isSingleDiscrete
    if(requireIsDiscrete != null && !requireIsDiscrete) requireSingleDimension = true;
    
    if(requireSingleDimension != null) {
        requireSingleDimension = def.get(keyArgs, 'requireSingleDimension', false);
        if(requireSingleDimension) {
            if(def.get(keyArgs, 'isMeasure', false)) {
                this.isMeasure = true;
                
                if(def.get(keyArgs, 'isPercent', false)) this.isPercent = true;
            }
            
            var valueType = def.get(keyArgs, 'valueType', null);
            if(valueType !== this.valueType) {
                this.valueType = valueType;
                this.dimensionDefaults.valueType = valueType;
            }
        }
    }
    
    if(requireSingleDimension !== this.requireSingleDimension)
        this.requireSingleDimension = requireSingleDimension;
    
    if(requireIsDiscrete != this.requireIsDiscrete) {
        this.requireIsDiscrete = !!requireIsDiscrete;
        this.dimensionDefaults.isDiscrete = this.requireIsDiscrete;
    }

    var traversalMode = def.get(keyArgs, 'traversalMode');
    if(traversalMode != null && traversalMode !== this.traversalMode) this.traversalMode = traversalMode;
})
.add(/** @lends pvc.visual.Role# */{
    isRequired: false,
    requireSingleDimension: false,
    valueType: null,
    requireIsDiscrete: null,
    isMeasure: false,
    isPercent: false,
    defaultSourceRoleName: null,
    defaultDimensionName:  null,
    grouping: null,
    traversalMode: pvc.visual.TraversalMode.FlattenedSingleLevel,
    rootLabel: '',
    autoCreateDimension: false,
    isReversed: false,
    label: null,
    sourceRole: null,
    isDefaultSourceRole: false,

    prettyId: function() {
        return (this.plot ? (this.plot.prettyId + ".") : "") + this.name;
    },

    /** 
     * Obtains the first dimension type that is bound to the role.
     * @type cdo.DimensionType
     */
    firstDimensionType: function() {
        var g = this.grouping;
        return g && g.firstDimensionType();
    },
    
    /** 
     * Obtains the name of the first dimension type that is bound to the role.
     * @type string 
     */
    firstDimensionName: function() {
        var g = this.grouping;
        return g && g.firstDimensionName();
    },
    
    /** 
     * Obtains the value type of the first dimension type that is bound to the role.
     * @type function
     */
    firstDimensionValueType: function() {
        var g = this.grouping;
        return g && g.firstDimensionValueType();
    },

    /** 
     * Obtains the last dimension type that is bound to the role.
     * @type cdo.DimensionType
     */
    lastDimensionType: function() {
        var g = this.grouping;
        return g && g.lastDimensionType();
    },
    
    /** 
     * Obtains the name of the last dimension type that is bound to the role.
     * @type string 
     */
    lastDimensionName: function() {
        var g = this.grouping;
        return g && g.lastDimensionName();
    },
    
    /** 
     * Obtains the value type of the last dimension type that is bound to the role.
     * @type function
     */
    lastDimensionValueType: function() {
        var g = this.grouping;
        return g && g.lastDimensionValueType();
    },

    isDiscrete: function() {
        var g = this.grouping;
        return g && g.isDiscrete();
    },
    
    setSourceRole: function(sourceRole, isDefault) {
        this.sourceRole = sourceRole;
        this.isDefaultSourceRole = !!isDefault;
    },
    
    setIsReversed: function(isReversed) {
        if(!isReversed) delete this.isReversed;
        else            this.isReversed = true;
    },
    
    setTraversalMode: function(travMode) {
        var T = pvc.visual.TraversalMode;
        
        travMode = def.nullyTo(travMode, T.FlattenedSingleLevel);
        
        if(travMode !== this.traversalMode) {
            if(travMode === T.FlattenedSingleLevel) // default value
                delete this.traversalMode;
            else
                this.traversalMode = travMode;
        }
    },

    setRootLabel: function(rootLabel) {
        if(rootLabel !== this.rootLabel) {
            if(!rootLabel) delete this.rootLabel; // default value shows through
            else           this.rootLabel = rootLabel;
            
            if(this.grouping) this._updateBind(this.grouping);
        }
    },

    /**
     * Applies this role's grouping to the specified data
     * after ensuring the grouping is of a certain type.
     *
     * @param {cdo.Data} data The data on which to apply the operation.
     * @param {object} [keyArgs] Keyword arguments.
     * ...
     * 
     * @type cdo.Data
     */
    flatten: function(data, keyArgs) {
        var grouping = this.flattenedGrouping(keyArgs) || def.fail.operationInvalid("Role is unbound.");
            
        return data.groupBy(grouping, keyArgs);
    },

    flattenedGrouping: function(keyArgs) {
        var grouping = this.grouping;
        if(grouping) {
            keyArgs = keyArgs ? Object.create(keyArgs) : {};

            var flatMode = keyArgs.flatteningMode;
            if(flatMode == null) flatMode = keyArgs.flatteningMode = this._flatteningMode();
            
            if(keyArgs.isSingleLevel == null && !flatMode) keyArgs.isSingleLevel = true;
            
            return grouping.ensure(keyArgs);
        }
    },

    _flatteningMode: function() {
        var T = pvc.visual.TraversalMode,
            F = cdo.FlatteningMode;
        switch(this.traversalMode) {
            case T.FlattenDfsPre:  return F.DfsPre;
            case T.FlattenDfsPost: return F.DfsPost;
        }
        return T.None;
    },
    
    select: function(data, keyArgs) {
        var grouping = this.grouping;
        if(grouping) {
            def.setUDefaults(keyArgs, 'flatteningMode', cdo.FlatteningMode.None);
            return data.groupBy(grouping.ensure(keyArgs), keyArgs); 
        }
    },

    view: function(complex) {
        var grouping = this.grouping;
        if(grouping) return grouping.view(complex);
    },

    /**
     * Pre-binds a grouping specification to playing this role.
     * 
     * @param {cdo.GroupingSpec} groupingSpec The grouping specification of the visual role.
     */
    preBind: function(groupingSpec) {
        this.__grouping = groupingSpec;
        return this;
    },

    isPreBound: function() { return !!this.__grouping; },
    
    preBoundGrouping: function() { return this.__grouping; },
    
    isBound: function() { return !!this.grouping; },
    
    /**
     * Finalizes a binding initiated with {@link #preBind}.
     *
     * @param {cdo.ComplexType} type The complex type with which
     * to bind the pre-bound grouping and then validate the
     * grouping and role binding.
     */
    postBind: function(type) {
        var grouping = this.__grouping;
        if(grouping) {
            delete this.__grouping;

            grouping.bind(type);

            this.bind(grouping);
        }
        
        return this;
    },

    /**
     * Binds a grouping specification to playing this role.
     * 
     * @param {cdo.GroupingSpec} groupingSpec The grouping specification of the visual role.
     */
    bind: function(groupingSpec) {
        
        groupingSpec = this._validateBind(groupingSpec);
        
        this._updateBind(groupingSpec);

        return this;
    },
    
    _validateBind: function(groupingSpec) {
        if(groupingSpec) {
            if(groupingSpec.isNull()) {
                groupingSpec = null;
           } else {
                /* Validate grouping spec according to role */

                if(this.requireSingleDimension && !groupingSpec.isSingleDimension)
                    throw def.error.operationInvalid(
                            "Role '{0}' only accepts a single dimension.",
                            [this.name]);

                var valueType = this.valueType,
                    requireIsDiscrete = this.requireIsDiscrete;
                groupingSpec.dimensions().each(function(dimSpec) {
                    var dimType = dimSpec.type;
                    if(valueType && dimType.valueType !== valueType)
                        throw def.error.operationInvalid(
                                "Role '{0}' cannot be bound to dimension '{1}'. \nIt only accepts dimensions of type '{2}' and not of type '{3}'.",
                                [this.name, dimType.name, cdo.DimensionType.valueTypeName(valueType), dimType.valueTypeName]);

                    if(requireIsDiscrete != null && dimType.isDiscrete !== requireIsDiscrete) {
                        if(!requireIsDiscrete)
                            throw def.error.operationInvalid(
                                "Role '{0}' cannot be bound to dimension '{1}'. \nIt only accepts {2} dimensions.",
                                [this.name, dimType.name, requireIsDiscrete ? 'discrete' : 'continuous']);

                        // A continuous dimension can be "coerced" to behave as discrete
                        dimType._toDiscrete();
                    }
                }, this);
            }
        }
        
        return groupingSpec;
    },

    _updateBind: function(groupingSpec) {
        if(this.grouping) {
            // unregister from current dimension types
            this.grouping.dimensions().each(function(dimSpec) {
                if(dimSpec.type) {
                    /*global dimType_removeVisualRole:true */
                    dimType_removeVisualRole.call(dimSpec.type, this);
                }
            }, this);
        }
        
        this.grouping = groupingSpec;
        
        if(this.grouping) {
            this.grouping = this.grouping.ensure({
                reverse:   this.isReversed, 
                rootLabel: this.rootLabel
            });
            
            // register in current dimension types
            this.grouping.dimensions().each(function(dimSpec) {
                /*global dimType_addVisualRole:true */
                dimType_addVisualRole.call(dimSpec.type, this);  
            }, this);
        }
    }
})
.addStatic(/** @lends pvc.visual.Role */{
    parse: function(lookup, name, config) {
        // Process the visual role configuration.
        // * a string with the grouping dimensions, or
        // * {dimensions: "product", isReversed:true, from: "series"}
        var parsed = {isReversed: false, source: null, grouping: null},
            groupSpec;

        if(def.object.is(config)) {
            if(config.isReversed) parsed.isReversed = true;

            var sourceName = config.from;
            if(sourceName) {
                if(sourceName === name) throw def.error.operationInvalid("Invalid source role.");

                parsed.source = lookup(sourceName) ||
                    def.fail.operationInvalid("Source visual role '{0}' is not defined.", [sourceName]);
            } else {
                groupSpec = config.dimensions;
            }
        } else if(config === null || def.string.is(config)) {
            groupSpec = config;
        }

        if(groupSpec !== undefined) parsed.grouping = cdo.GroupingSpec.parse(groupSpec);

        return parsed;
    }
});

