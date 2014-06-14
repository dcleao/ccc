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
     * Initializes the chart-level visual roles.
     * @virtual
     */
    _initChartVisualRoles: function() {
        this._addVisualRole('multiChart', {
            defaultDimension: 'multiChart*',
            requireIsDiscrete: true
        });

        this._addVisualRole('dataPart', {
            defaultDimension: 'dataPart',
            requireIsDiscrete: true,
            requireSingleDimension: true,
            dimensionDefaults: {isHidden: true, comparer: def.compare}
        });
    },

    _assertUnboundRoleIsOptional: function(role) {
        if(role.isRequired) throw def.error.operationInvalid("Chart type requires unassigned role '{0}'.", [role.name]);
    },

    /**
     * Configures the chart and plots' visual roles
     * with the user specified options.
     *
     * This includes explicitly binding a visual role to
     * certain dimensions, given their names.
     * This is called "pre-binding" the visual role to groupings
     * having the specified dimension names.
     *
     * Note that in this phase, there is not complex type yet.
     * The created groupings refer only to dimension names
     * and lack a later binding to an actual complex type.
     *
     * In the course of configuration two additional tasks are performed:
     * <ul>
     *     <li>a list of all visual roles that have a source visual role is built</li>
     *     <li>
     *         a map of dimension names that have a single visual role bound to it is built;
     *         the importance of this relation is that the
     *         properties of dimensions having a single role bound to it
     *         can be defaulted from the properties of the visual role.
     *     </li>
     * </ul>
     *
     * To force an optional visual role to not automatically bind to
     * its default dimension, or to not create that dimension automatically and bind to it,
     * its groupingSpec can be set to null, or "".
     *
     * This results in a "null grouping" being pre-bound to the visual role.
     * A pre-bound null grouping is later discarded in the post phase,
     * but, in between, this prevents translators from
     * trying to satisfy the visual role.
     */
    _visualRolesBinder: function(dimsOptions) {
        // 1. explicit final binding of role to a source role (`from` attribute)
        //
        // 2. explicit final binding of role to one or more dimensions (`dimensions` attribute)
        //
        // 3. explicit final null binding of role to no dimensions (`dimensions` attribute to null or '')
        //
        // 4. implicit non-final binding of a role to its default source role, if it exists (role.defaultSourceRoleName)
        //
        // 5. implicit binding of a sourced role with no defaultDimensionName
        //        to the pre-bound source role's dimensions.
        //
        // 6. implicit binding of role to one or more dimension(s) from the same
        //        dimension group of the role (defaultDimensionName).
        //

        var me = this,
            visualRoleList = me.visualRoleList,
            visualRoles = me.visualRoles,
            complexTypeProj,
            options = me.options,
            dataPartDimName,
            chartRolesOptions = options.visualRoles;

        /**
         * List of visual roles that have another as source.
         * @type pvc.visual.Role[]
         */
        var unboundSourcedRoles = [];

        /**
         * Map from dimension name to the single role that is explicitly bound to it.
         * @type Object.<string, pvc.visual.Role>
         */
        var singleRoleByDimName = {};

        // Marks if at least one role was previously found to be bound to a dimension.
        var dimsBoundTo = {};

        begin();

        return {
            complexTypeProject: function() { return complexTypeProj; },
            dataPartDimName:    function() { return dataPartDimName; },

            end: end
        };

        // --------------

        function begin() {
            // Process the visual roles with options
            // It is important to process them in visual role definition order
            // cause the processing that is done generally
            // depends on the processing order, and
            // a chart definition must behave the same
            // in every environment, independently of the order in which
            // object properties are enumerated.
            visualRoleList.forEach(function(r) {
                // Clear reversed status of visual role
                // TODO: why is this needed. Isn't this done only once?
                r.setIsReversed(false);

                var opts = findOptions(r);
                if(opts) configure(r)
            });

            // 2nd round.
            unboundSourcedRoles.forEach(function(r) {
                tryPreBindSourcedRole(r);
            }, this);

            // Some may bow be bound, so reset. Rebuilt on `end` phase.
            unboundSourcedRoles = [];

            // -----------------------

            complexTypeProj = me._createComplexTypeProject();

            // -----------------------

            // The chart-level `dataPart` visual role can be explicitly bound
            // to a dimension whose name is not "dataPart".
            // By now, the actual name of the dimension playing the `dataPart` role is already known.
            // Add data part dimension and dataPart calculation from series values.
            dataPartDimName = me._getDataPartDimName(/*useDefault*/true);
            if(!me._maybeAddPlot2SeriesDataPartCalc(complexTypeProj, dataPartDimName)) {
                if(!visualRoles.dataPart.isPreBound() && me.plots.trend) {
                    // Check if dataPart dimension needed for trend plot
                    complexTypeProj.setDim(dataPartDimName);
                }
            }

            // -----------------------

            applySingleRoleDefaults();
        }

        // Accept visual roles directly in the options as <roleName>Role,
        // for chart roles or for the main plot roles.
        function findOptions(r) {
            var plot = r.plot, name = r.name;

            return def.firstDefined([
                function() { if(!plot || plot.isMain) return options[name + 'Role']; },
                function() { return def.get(chartRolesOptions, name); },
                function() { if(plot) return def.get(plot._visualRolesOptions, name); }
            ]);
        }

        function configure(r, opts) {
            var parsed = pvc.visual.Role.parse(me, r.name, opts),
                grouping;
            if(parsed.isReversed) r.setIsReversed(true);
            if(parsed.source) {
                r.setSourceRole(parsed.source);
                addUnboundSourced(r);
            } else if((grouping = parsed.grouping)) {
                preBindToGrouping(r, grouping);
            }
        }

        function addUnboundSourced(r) {
            unboundSourcedRoles.push(r);
        }

        function preBindToGrouping(r, grouping) {
            // assert !end-phase || !grouping.isNull()

            r.preBind(grouping);

            if(grouping.isNull()) {
                me._assertUnboundRoleIsOptional(r); // throws if required
            } else {
                //r.setSourceRole(null); // if any
                registerBindings(r, grouping.dimensionNames());
            }
        }

        function registerBindings(r, ns) {
            ns.forEach(function(n) { registerBinding(r, n); });
        }

        function registerBinding(r, n) {
            if(!dimsBoundTo[n]) {
                dimsBoundTo[n] = true;
                singleRoleByDimName[n] = r;
            } else {
                // Two or more roles.
                delete singleRoleByDimName[n];
            }
        }

        // Pre-bind sourced roles whose source role is pre-bound.
        //
        // This function follows sourced roles until a non-sourced role is found,
        // detecting loops along the way (A -source-> B -source-> C -dims-> abcd).
        function tryPreBindSourcedRole(r, visited) {
            var id = r.prettyId();
            if(!visited) visited = {};
            else if(def.hasOwn(visited, id)) throw def.error.argumentInvalid("visualRoles", "Cyclic source role definition.");
            visited[id] = true;

            if(r.isPreBound()) return r.preBoundGrouping();

            var source = r.sourceRole;
            if(!source)
                // Reached the end of the string.
                // If this r is preBound, then we can preBind all sourced roles on the stack.
                // Otherwise, all remain unbound.
                return source.isPreBound() ? source.preBoundGrouping() : null;

            var sourcePreGrouping = tryPreBindSourcedRole(source, visited);
            if(sourcePreGrouping) {
                // toggle sourced role isReversed.
                if(source.isReversed) r.setIsReversed(!r.isReversed);

                r.preBind(sourcePreGrouping);

            }
            return sourcePreGrouping;
        }

        // Provide default properties to dimensions that have a single role bound to it,
        // by using the role's properties.
        // The order of application is not relevant.
        // TODO: this is being repeated for !pre-bound! dimensions
        function applySingleRoleDefaults() {
            def.eachOwn(singleRoleByDimName, function(r, n) {
                complexTypeProj.setDimDefaults(n, r.dimensionDefaults);
            }, this);
        }

        // ---------------------

        // We assume that, since the `begin` phase,
        // the binding of visual roles to dimensions (or source roles) has not changed.
        //
        // However, the translation has now had a chance to configure the complex type project,
        // defining new dimensions or just configuring existing ones (with valueType, label, etc),
        // and, in any case, marking those as being read.
        //
        // For what the binding of visual roles to dimensions is concerned,
        // now is the time to check whether the default dimensions of still unbound visual roles exist.
        // Also, because all other possible contributors (just the translation, really) to defining
        // new dimensions have already done so, default dimensions of roles having autoCreateDimension to true,
        // are now created as a last resort.
        //
        // Roles are bound before actually loading data.
        // One of the reasons is for being possible to filter datums
        // whose "every dimension in a measure role is null".
        function end() {

            // If the the dataPart dimension is defined, but is not being read or calculated,
            // then default its value '0'.
            // If the dataPart role is not yet pre-bound to it, it will become so, in autoPreBindUnbound.
            if(complexTypeProj.hasDim(dataPartDimName) && !complexTypeProj.isReadOrCalc(dataPartDimName))
                me._addDefaultDataPartCalculation(complexTypeProj, dataPartDimName);

            visualRoleList.forEach(function(r) {
                if(!r.isPreBound()) autoPrebindUnbound(r);
            });

            // Try to pre-bind sourced roles that are still unbound.
            unboundSourcedRoles.forEach(function(r) {
                if(!tryPreBindSourcedRole(r)) roleIsUnbound(r);
            });

            applySingleRoleDefaults();

            // -------

            // Setup the complex type from complexTypeProj;
            var complexType = new cdo.ComplexType();

            complexTypeProj.configureComplexType(complexType, dimsOptions);

            if(pvc.debug >= 3) me._log(complexType.describe());

            // TODO: the complexTypeProj instance remains alive in the persisted translation object,
            // although probably it is not needed anymore, even for reloads...

            // Commits and validates the grouping specification.
            // Null groupings are discarded.
            // Sourced roles that were also pre-bound are here normally bound.
            visualRoleList.forEach(function(r) {
                if(r.isPreBound()) r.postBind(complexType);
            });

            if(pvc.debug >= 3) me._logVisualRoles();

            return complexType;
        }

        function autoPrebindUnbound(r) {
            if(r.sourceRole) return addUnboundSourced(r);

            // --------------

            // Try to bind automatically to defaultDimensionName.
            var dimName = r.defaultDimensionName;
            if(dimName) {
                /* An asterisk at the end of the name indicates
                 * that any dimension of that group is allowed.
                 * If the role allows multiple dimensions,
                 * then the meaning is greedy - use them all.
                 * Otherwise, use only one.
                 *
                 *   "product*"
                 */
                var match = dimName.match(/^(.*?)(\*)?$/) || def.fail.argumentInvalid('defaultDimensionName'),
                    defaultName =  match[1],
                    greedy = /*!!*/match[2];
                if(greedy) {
                    // TODO: does not respect any index explicitly specified before the *. It could mean >=...
                    var groupDimNames = complexTypeProj.groupDimensionsNames(defaultName);
                    if(groupDimNames) return preBindToDims(r, groupDimNames);

                    // Continue to auto create dimension

                } else if(complexTypeProj.hasDim(defaultName)) { // defaultName === dimName
                    return preBindToDims(r, defaultName);
                }

                if(r.autoCreateDimension) {
                    // Create a hidden dimension and bind the role and the dimension.
                    // Dimension will receive only null data.
                    complexTypeProj.setDim(defaultName, {isHidden: true});

                    return preBindToDims(r, defaultName);
                }
            }

            // --------------

            if(r.defaultSourceRoleName) {
                var source = def.getOwn(visualRoles, r.defaultSourceRoleName);
                if(source) {
                    r.setSourceRole(source);
                    return addUnboundSourced(r);
                }
            }

            // --------------

            roleIsUnbound(r);
        }

        function preBindToDims(r, ns) {
            var grouping = cdo.GroupingSpec.parse(ns);

            preBindToGrouping(r, grouping);
        }

        function roleIsUnbound(r) {
            // Throws if role is required
            me._assertUnboundRoleIsOptional(r);

            // Unbind role from any previous binding
            r.bind(null);
            r.setSourceRole(null); // if any
        }
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
    
    _getDataPartDimName: function(useDefault) {
        var role = this.visualRoles.dataPart, preGrouping;
        return role.isBound()                          ? role.lastDimensionName()        :
               (preGrouping = role.preBoundGrouping()) ? preGrouping.lastDimensionName() :
               useDefault                              ? role.defaultDimensionName       :
               null;
    }
});

