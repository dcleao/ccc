/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pvc.BaseChart
.add({
    /**
     * A map of {@link pvc.visual.Role} by name.
     * Do NOT modify the returned object.
     * @type Object<string,pvc.visual.Role>
     */
    visualRoles: null,

    /**
     * The array of all {@link pvc.visual.Role} instances used by the chart.
     * Do NOT modify the returned array.
     * @type pvc.visual.Role[]
     */
    visualRoleList: null,

    /**
     * The array of all {@link pvc.visual.Role} instances used by the chart
     * that are considered measures.
     * @type pvc.visual.Role[]
     * @private
     */
    _measureVisualRoles: null,
    
    /**
     * Obtains an existing visual role given its name.
     * An error is thrown if a role with the specified name is not defined.
     *
     * The specified name may be:
     * <ul>
     *     <li>the name of a chart visual role, </li>
     *     <li>the local name of a visual role of the chart's main plot, or</li>
     *     <li>the fully qualified name of a plot's visual role: "<plot name or id>.<local role name>".</li>
     * </ul>
     * 
     * @param {string} roleName The visual role name.
     * @type pvc.visual.Role
     */
    visualRole: function(roleName) {
        var role = def.getOwn(this.visualRoles, roleName);
        if(!role) throw def.error.operationInvalid('roleName', "There is no visual role with name '{0}'.", [roleName]);
        return role;
    },

    /**
     * Obtains the array of all {@link pvc.visual.Role} instances used by the chart
     * that are considered measures.
     *
     * Do NOT modify the returned array.
     *
     * @return {pvc.visual.Role[]} The array of measure visual roles.
     */
    measureVisualRoles: function() { return this._measureVisualRoles; },

    measureDimensionsNames: function() {
        return def.query(this._measureVisualRoles)
           .select(function(role) { return role.lastDimensionName(); })
           .where(def.notNully)
           .array();
    },
    
    _constructVisualRoles: function(/*options*/) {
        var parent = this.parent;
        if(parent) {
            this.visualRoles = parent.visualRoles;
            this.visualRoleList = parent.visualRoleList;
            this._measureVisualRoles = parent._measureVisualRoles;
        } else {
            this.visualRoles = {};
            this.visualRoleList = [];
            this._measureVisualRoles = [];
        }
    },

    _addVisualRole: function(name, keyArgs) {
        keyArgs = def.set(keyArgs, 'index', this.visualRoleList.length);

        return this._addVisualRoleCore(new pvc.visual.Role(name, keyArgs), name);
    },

    _addVisualRoleCore: function(role, names) {
        if(!names) names = role.name;

        this.visualRoleList.push(role);
        if(def.array.is(names))
            names.forEach(function(name) { this.visualRoles[name] = role; }, this);
        else
            this.visualRoles[names] = role;

        if(role.isMeasure) this._measureVisualRoles.push(role);
        return role;
    },
    
    /**
     * Initializes the chart's visual roles.
     * @virtual
     */
    _initVisualRoles: function() {
        this._addVisualRole('multiChart', {
            defaultDimension: 'multiChart*',
            requireIsDiscrete: true
        });

        this._addVisualRole('dataPart', {
            defaultDimension: 'dataPart',
            requireSingleDimension: true,
            requireIsDiscrete: true,
            dimensionDefaults: {isHidden: true, comparer: def.compare}
        });
    },

    _assertUnboundRoleIsOptional: function(role) {
        if(role.isRequired) throw def.error.operationInvalid("Chart type requires unassigned role '{0}'.", [role.name]);
    },

    _findVisualRoleOptions: function(role, options, chartRolesOptions) {
        var plot = role.plot, name = role.name;

        return def.firstDefined([
            function() { if(!plot || plot.isMain) return options[name + 'Role']; },
            function() { return def.get(chartRolesOptions, name); },
            function() { if(plot) return def.get(plot._visualRolesOptions, name); }
        ]);
    },

    /**
     * Binds visual roles to grouping specifications
     * that have not yet been bound to and validated against a complex type.
     *
     * This allows inferring proper defaults to
     * dimensions bound to roles,
     * by taking them from the roles requirements.
     */
    _bindVisualRolesPreI: function() {
        // Clear reversed status of visual roles
        this.visualRoleList.forEach(function(role) { role.setIsReversed(false); });

        /**
         * List of visual roles that have another as source.
         * @type pvc.visual.Role[]
         */
        var sourcedRoles = this._sourcedRoles = [];

        /**
         * Map from dimension name to the single role that is explicitly bound to it,
         * or <tt>null</tt> when there are no dimensions having a single role bound to it.
         *
         * The importance of this relation is that the
         * properties of dimensions having a single role bound to it
         * can be defaulted from the properties of the visual role.
         *
         * @type Object.<string, pvc.visual.Role>
         */
        var dimsBoundToSingleRole = this._dimsBoundToSingleRole = {};

        // Marks if at least one role was previously found to be bound to a dimension.
        var dimsBoundRoleOne = {};

        function registerBoundDimensions(role, grouping) {
            grouping.dimensions().each(function(groupDimSpec) {
                var dimName = groupDimSpec.name;
                if(!dimsBoundRoleOne[dimName]) {
                    dimsBoundRoleOne[dimName] = true;
                    dimsBoundToSingleRole[dimName] = role;
                } else {
                    // Two or more roles.
                    // No real need to count...
                    delete dimsBoundToSingleRole[dimName];
                }
            });
        }

        // Process the visual roles with options
        // It is important to process them in visual role definition order
        // cause the processing that is done generally 
        // depends on the processing order;
        // A chart definition must behave the same 
        // in every environment, independently of the order in which
        // object properties are enumerated.

        // To force an optional visual role to not automatically bind to
        // its default dimension, or to not create it automatically and bind to it,
        // its groupingSpec can be set to null, or "".
        //
        // This results in a null grouping being pre-bound to the visual role.
        // A pre-bound null grouping is later discarded in the post bind,
        // but, in between, this prevents translators from
        // trying to satisfy the visual role.

        var options = this.options,
            chartRolesOptions = options.visualRoles;
        
        // Accept visual roles directly in the options as <roleName>Role,
        // for chart roles or for the main plot roles.
        this.visualRoleList.forEach(function(role) {
            var roleOptions = this._findVisualRoleOptions(role, options, chartRolesOptions),
                grouping;
            if(roleOptions) {
                var parsed = pvc.visual.Role.parse(this, role.name, roleOptions);
                if(parsed.isReversed) role.setIsReversed(true);
                if(parsed.source) {
                    role.setSourceRole(parsed.source);
                    sourcedRoles.push(role);
                } else if((grouping = parsed.grouping)) {
                    role.preBind(grouping);

                    if(grouping.isNull())
                        this._assertUnboundRoleIsOptional(role); // throws if required
                    else
                        registerBoundDimensions(role, grouping);
                }
            }
        }, this);
    },
    
    _bindVisualRolesPreII: function() {
        // Provide defaults to dimensions bound to a single role,
        // by using the role's requirements
        var dimsBoundToSingleRole = this._dimsBoundToSingleRole;
        delete this._dimsBoundToSingleRole; // free memory
        def.eachOwn(dimsBoundToSingleRole, this._setRoleBoundDimensionDefaults, this);

        var sourcedRoles = this._sourcedRoles;
        delete this._sourcedRoles; // free memory
        
        /* Apply defaultSourceRole to roles not pre-bound */
        def
        .query(this.visualRoleList)
        .where(function(role) { 
            return role.defaultSourceRoleName && !role.sourceRole && !role.isPreBound(); 
         })
        .each (function(role) {
            var sourceRole = this.visualRoles[role.defaultSourceRoleName];
            if(sourceRole) {
                role.setSourceRole(sourceRole, /*isDefault*/true);
                sourcedRoles.push(role);
            }
        }, this);
        
        /* Pre-bind sourced roles whose source role is itself pre-bound */
        // Only if the role has no default dimension, cause otherwise, 
        // it would prevent binding to it, if it comes to exist.
        // In those cases, sourcing only effectively happens in the post phase.
        sourcedRoles.forEach(function(role) {
            var sourceRole = role.sourceRole;
            if(sourceRole.isReversed) role.setIsReversed(!role.isReversed);
            
            if(!role.defaultDimensionName && sourceRole.isPreBound())
                role.preBind(sourceRole.preBoundGrouping());
        });
    },
    
    _setRoleBoundDimensionDefaults: function(role, dimName) {
        this._complexTypeProj.setDimDefaults(dimName, role.dimensionDefaults);
    },
    
    _bindVisualRolesPostI: function() {
        var me = this,
            complexTypeProj = me._complexTypeProj,
            // Dimension names to roles bound to it
            boundDimTypes = {},
            unboundSourcedRoles = [];
        
        def
        .query(me.visualRoleList)
        .where(function(role) { return role.isPreBound(); })
        .each (markPreBoundRoleDims);
        
        /* (Try to) Automatically bind **unbound** roles:
         * -> to their default dimensions, if they exist and are not yet bound to
         * -> if the default dimension does not exist and the 
         *    role allows auto dimension creation, 
         *    creates 1 *hidden* dimension (that will receive only null data)
         * 
         * Validates role required'ness.
         */
        def
        .query(me.visualRoleList)
        .where(function(role) { return !role.isPreBound(); })
        .each (autoBindUnboundRole);
        
        // Sourced roles that could not be normally bound are now finally sourced 
        unboundSourcedRoles.forEach(tryPreBindSourcedRole);
        
        // Apply defaults to single-bound-to dimensions
        // TODO: this is being repeated for !pre-bound! dimensions
        def
        .query(def.ownKeys(boundDimTypes))
        .where(function(dimName) { return boundDimTypes[dimName].length === 1; })
        .each (function(dimName) {
            var singleRole = boundDimTypes[dimName][0];
            me._setRoleBoundDimensionDefaults(singleRole, dimName);
        });

        // ----------------
        
        function markDimBoundTo(dimName, role) { def.array.lazy(boundDimTypes, dimName).push(role); }
        
        function dimIsDefined(dimName) { return complexTypeProj.hasDim(dimName); }
        
        function preBindRoleTo(role, dimNames) {
            if(def.array.is(dimNames))
                dimNames.forEach(function(dimName) { markDimBoundTo(dimName, role); });
            else
                markDimBoundTo(dimNames, role);

            role.setSourceRole(null); // if any
            role.preBind(cdo.GroupingSpec.parse(dimNames));
        }
        
        function preBindRoleToGroupDims(role, groupDimNames) {
            if(groupDimNames.length) {
                if(role.requireSingleDimension) preBindRoleTo(role, groupDimNames[0]);
                else                            preBindRoleTo(role, groupDimNames);
            }
        }
        
        function preBindRoleToNewDim(role, dimName) {
            // Create a hidden dimension and bind the role and the dimension
            complexTypeProj.setDim(dimName, {isHidden: true});
            
            preBindRoleTo(role, dimName);
        }
        
        function roleIsUnbound(role) {
            me._assertUnboundRoleIsOptional(role); // throws if required
            
            // Unbind role from any previous binding
            role.bind(null);
            role.setSourceRole(null); // if any
        }
        
        function markPreBoundRoleDims(role) {
            role.preBoundGrouping().dimensionNames().forEach(markDimBoundTo);
        }
        
        function autoBindUnboundRole(role) {
            // !role.isPreBound()
            
            if(role.sourceRole && !role.isDefaultSourceRole) return unboundSourcedRoles.push(role);
            
            // Try to bind automatically, to defaultDimensionName
            var dimName = role.defaultDimensionName;
            if(!dimName) return role.sourceRole ? unboundSourcedRoles.push(role) : roleIsUnbound(role);

            /* An asterisk at the end of the name indicates
             * that any dimension of that group is allowed.
             * If the role allows multiple dimensions,
             * then the meaning is greedy - use them all.
             * Otherwise, use only one.
             * 
             *   "product*"
             */
            var match = dimName.match(/^(.*?)(\*)?$/) ||
                        def.fail.argumentInvalid('defaultDimensionName'),
                defaultName =  match[1],
                greedy = /*!!*/match[2];
            if(greedy) {
                // TODO: does not respect any index explicitly specified
                // before the *. Could mean >=...
                var groupDimNames = complexTypeProj.groupDimensionsNames(defaultName);
                if(groupDimNames) return preBindRoleToGroupDims(role, groupDimNames); // Default dimension(s) is defined
                
                // Follow to auto create dimension
                
            } else if(dimIsDefined(defaultName)) { // defaultName === dimName
                return preBindRoleTo(role, defaultName);
            }

            if(role.autoCreateDimension) return preBindRoleToNewDim(role, defaultName);

            role.sourceRole ? unboundSourcedRoles.push(role) : roleIsUnbound(role);
        }
    
        function tryPreBindSourcedRole(role) {
            var sourceRole = role.sourceRole;
            if(sourceRole.isPreBound()) { role.preBind(sourceRole.preBoundGrouping()); } 
            else                        { roleIsUnbound(role);                         }
        }
    },
    
    _bindVisualRolesPostII: function(complexType) {
        // Commits and validates the grouping specification.
        // Null groupings are discarded.
        // Sourced roles that were also pre-bound are here normally bound.
        def
        .query(this.visualRoleList)
        .where(function(role) { return role.isPreBound();   })
        .each (function(role) { role.postBind(complexType); });
    },

    _logVisualRoles: function() {
        var maxLen = Math.max(10, def.query(this.visualRoleList).select(function(r) { return r.prettyId().length; }).max()),
            header = def.string.padRight("VisualRole", maxLen) + " < Dimension(s)",
            out = [
                "VISUAL ROLES MAP SUMMARY",
                pvc.logSeparator,
                header,
                def.string.padRight('', maxLen + 1, '-') + '+--------------'
            ];
        
        def.eachOwn(this.visualRoleList, function(role) {
            out.push(def.string.padRight(role.prettyId(), maxLen) + ' | ' + (role.grouping || '-'));
        });
        out.push("");
        this._log(out.join("\n"));
    },
    
    _getDataPartDimName: function() {
        var role = this.visualRoles.dataPart, preGrouping;
        if(role)
            return role.isBound()                          ? role.lastDimensionName()        :
                   (preGrouping = role.preBoundGrouping()) ? preGrouping.lastDimensionName() :
                   role.defaultDimensionName;
    }
});

