/**
 * Configures the chart-level and plots-level visual roles
 * with the user specified visual role options.
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

pvc.visual.rolesBinder = function() {
    // NOTE: this description is not complete or totally accurate...
    //
    // 1. explicit final binding of role to a source role (`from` attribute)
    //
    // 2. explicit final binding of role to one or more dimensions (`dimensions` attribute)
    //
    // 3. explicit final null binding of role to no dimensions (`dimensions` attribute to null or '')
    //
    // 4. implicit non-final binding of a role to its default source role, if any (role.defaultSourceRoleName)
    //
    // 5. implicit binding of a sourced role with no defaultDimensionName
    //        to the pre-bound source role's dimensions.
    //
    // 6. implicit binding of role to one or more dimension(s) from the same
    //        dimension group of the role (defaultDimensionName).

    var NOT_STARTED = 0;
    var INIT_DURING = 1;
    var INIT_AFTER  = 2;
    var DIMS_FINISHED_DURING = 3;
    var DIMS_FINISHED_AFTER = 4;
    var BIND_ROLES_DURING = 5;
    var BIND_ROLES_AFTER = 6;

    var state = NOT_STARTED;

    var context;
    var complexTypeProj;
    var logger;
    var doLog;

    /**
     * List of visual roles that have another as source.
     *
     * @type {!pvc.visual.Role[]}
     */
    var unboundSourcedRolesList = [];

    /**
     * Map from dimension name to the single role that is explicitly bound to it.
     *
     * When a visual role is the only one explicitly bound to a dimension,
     * part of that dimension's metadata can be defaulted from the visual role's metadata.
     *
     * @type {!Object.<string, pvc.visual.Role>}
     */
    var dimToSingleRoleMap = Object.create(null);

    /**
     * Marks if at least one role was previously found to be bound to a dimension.
     *
     * This map is only used to help build the `dimToSingleRoleMap` map.
     *
     * @type {!Object.<string, boolean>}
     */
    var dimHasRoleBoundToSet = Object.create(null);

    return {
        // region accessors
        /**
         * Gets or sets the logger to use.
         *
         * This logger is a function that receives one or more arguments and logs them unconditionally.
         * Used this way, the logged information is assumed to be of the "information" level.
         * It has a method `level` that returns the current log level
         * (0-off; 1-error; 2-warning; 3-info; 4-debug; ...).
         *
         * Can only be set before calling {@link pvc.visual.RolesBinder#init}.
         *
         * @param {def.Logger} [_] The logger object.
         * @return {pvc.visual.RolesBinder|def.Logger} <tt>this</tt> or the current logger object.
         */
        logger: function(_) {
            if(arguments.length) {
                visualRolesBinder_assertState(state, NOT_STARTED);
                logger = _;
                return this;
            }
            return logger;
        },

        /**
         * Gets or sets the visual roles context.
         *
         * Must be set before calling {@link pvc.visual.RolesBinder#init}.
         *
         * The visual roles context is  function that when given a visual role name or alias
         * returns a visual role instance, if one exists, or <tt>null</tt> if not.
         *
         * Additionally, the function contains a method named `query` that
         * returns a {@link def.Query} object of all visual roles in the context,
         * in definition order.
         *
         * Also, it contains a `getOptions` method that
         * returns a visual role's options object for a given visual role, if any,
         * or <tt>null</tt> if none.
         *
         * @param {function} [_] The visual roles context.
         * @return {pvc.visual.RolesBinder|function} <tt>this</tt> or the current visual roles context.
         */
        context: function(_) {
            if(arguments.length) {
                visualRolesBinder_assertState(state, NOT_STARTED);
                context = _;
                return this;
            }
            return context;
        },

        /**
         * Gets or sets the complex type project instance.
         *
         * Must be set before calling {@link pvc.visual.RolesBinder#init}.
         *
         * This instance can be provided already partially configured.
         *
         * The binder will use it to obtain information about existing dimensions
         * and also to apply default properties to dimensions that are bounds to visual roles.
         *
         * The binder may also create new dimensions, if needed,
         * to satisfy unbound visual roles configured with a default dimension name and
         * indication of automatic creation.
         *
         * @param {cdo.ComplexTypeProject} [_] The complex type project.
         * @return {pvc.visual.RolesBinder|cdo.ComplexTypeProject} <tt>this</tt> or
         * the current complex type project.
         */
        complexTypeProject: function(_) {
            if(arguments.length) {
                visualRolesBinder_assertState(state, NOT_STARTED);
                complexTypeProj = _;
                return this;
            }
            return complexTypeProj;
        },
        // endregion

        init: phase_init,
        dimensionsFinished: phase_dimensionsFinished,
        bind: phase_bindRoles
    };

    // region Phase - Init
    function phase_init() {

        visualRolesBinder_assertState(state, NOT_STARTED);
        if(!context) throw def.error.argumentRequired('context');
        if(!complexTypeProj) throw def.error.argumentRequired('complexTypeProject');

        state = INIT_DURING;
        doLog = !!logger && logger.level() >= 3;

        // Process the visual roles with options.
        // It is important to process them in visual role definition order
        // cause the binding process depends on the processing order.
        // A chart definition must behave the same in every environment,
        // independently of the order in which object properties are enumerated.
        context.query().each(function(role) {
            var opts = context.getOptions(role);

            // `opts === null` means "pre-bind to a null grouping"

            var isNotSourcedOrBound = opts === undefined || !configureRole(role, opts);
            if(isNotSourcedOrBound) {
                tryToSourceRoleFromMainRole(role);
            }
        });

        // -----------------------

        // Try to unwind sourced roles until bound roles are found.
        unboundSourcedRolesList.forEach(tryPreBindSourcedRole, this);

        // Some may now be bound, so reset. This is rebuilt on the `end` phase.
        unboundSourcedRolesList = [];

        // -----------------------

        // Enhance the metadata of dimensions which have a single role bound to them.
        applySingleRoleDefaultsToDimensions();

        state = INIT_AFTER;
        return this;
    }

    /**
     * Configures a visual role
     * on its `isReversed` property,
     * on being sourced by another visual role,
     * or on being bound to dimensions.
     *
     * @param {pvc.visual.Role} role The visual role.
     * @param {object} opts The visual role options.
     *
     * @return {number} `true`, if visual role is explicitly sourced or bound; `false`, otherwise.
     *
     * @see pvc.visual.Role.readConfig
     */
    function configureRole(role, opts) {
        var parsed = pvc.visual.Role.readConfig(opts, role.name, context);

        if(parsed.isReversed) role.setIsReversed(true);
        if(parsed.legend != null) role.legend(parsed.legend);

        if(parsed.source) {
            role.setSourceRole(parsed.source);
            addUnboundSourcedRole(role);
            return true;
        }

        // Note this is an unbound grouping.
        var grouping = parsed.grouping;
        if(grouping) {
            preBindRoleToGrouping(role, grouping);
            return true;
        }

        return false;
    }

    /**
     * Tries to source a secondary visual role to the same-named main visual role.
     *
     * Main visual roles are either chart-level visual roles or the visual roles of the main plot.
     *
     * @param {pvc.visual.Role} role - The visual role.
     */
    function tryToSourceRoleFromMainRole(role) {

        // Secondary roles have the same name as the main role, but are not returned by `context`.

        var mainRole = context(role.name);
        var isSecondaryRole = mainRole !== role;

        if(isSecondaryRole && role.canHaveSource(mainRole)) {
            role.setSourceRole(mainRole);
            addUnboundSourcedRole(role);
        }
    }
    // endregion

    // region Shared functions
    function addUnboundSourcedRole(role) {
        unboundSourcedRolesList.push(role);
    }

    function preBindRoleToGrouping(role, grouping) {
        // assert !end-phase || !grouping.isNull

        role.preBind(grouping);

        if(grouping.isNull) {
            visRoleBinder_assertUnboundRoleIsOptional(role); // throws if required
        } else {
            //role.setSourceRole(null); // if any
            grouping.dimensionNames().forEach(function(dimName) {
                registerRoleAndDimensionBinding(role, dimName);
            });
        }
    }

    function registerRoleAndDimensionBinding(role, dimName) {
        if(!dimHasRoleBoundToSet[dimName]) {
            dimHasRoleBoundToSet[dimName] = true;

            dimToSingleRoleMap[dimName] = role;

            // Defines the dimension in the complex type project.
            complexTypeProj.setDim(dimName);
        } else {
            // Two or more roles exist.
            delete dimToSingleRoleMap[dimName];
        }
    }

    /**
     * Tries to pre-bind sourced roles whose source role is pre-bound.
     *
     * This function follows sourced roles until a non-sourced role is found,
     * detecting loops along the way:
     *
     * >  A --source--> B --source--> C --dimensions--> [a, b, c]
     *
     * If a bound role is found, all sourced roles upstream are bound to the same grouping;
     * when a source role `isReversed`, the sourced role's `isReversed` is toggled.
     *
     * Otherwise, if the last role is unbound, all remain unbound.
     *
     * @param {!pvc.visual.Role} role - The sourced role to try to pre-bind.
     *
     * @return {cdo.GroupingSpec} The grouping spec of the downstream bound visual role found, if any; `null` if none.
     */
    function tryPreBindSourcedRole(role) {
        return tryPreBindSourcedRoleRecursive(role, Object.create(null));
    }

    /**
     * Recursive helper of `tryPreBindSourcedRole`.
     *
     * @param {!pvc.visual.Role} role - The sourced role to try to pre-bind.
     * @param {!Object.<string,boolean>} visited - Map of ids of visited roles. Created when unspecified.
     *
     * @return {cdo.GroupingSpec} The grouping spec of the downstream bound visual role found, if any; `null` if none.
     */
    function tryPreBindSourcedRoleRecursive(role, visited) {

        var id = role.uid;

        if(def.hasOwn(visited, id))
            throw def.error.argumentInvalid("visualRoles", "Cyclic source role definition.");

        visited[id] = true;

        // Role is bound?
        if(role.isPreBound()) {
            // Pre-Bind all sourced roles upstream.
            return role.preBoundGrouping();
        }

        // Role is sourced?
        var source = role.sourceRole;
        if(source) {
            var sourcePreGrouping = tryPreBindSourcedRoleRecursive(source, visited);
            if(sourcePreGrouping) {
                // toggle sourced role isReversed.
                if(source.isReversed) {
                    role.setIsReversed(!role.isReversed);
                }

                role.preBind(sourcePreGrouping);
            }

            return sourcePreGrouping;
        }

        // End of the string.
        // All remain unbound.
        return null;
    }

    // Provide default properties to dimensions that have a single role bound to it,
    // by using the role's properties.
    // The order of application is not relevant.
    function applySingleRoleDefaultsToDimensions() {

        def.eachOwn(dimToSingleRoleMap, function(role, dimName) {

            complexTypeProj.setDimDefaults(dimName, role.dimensionDefaults);
        });

        // Reset the map so that role dimension defaults are not applied twice.
        dimToSingleRoleMap = Object.create(null);
    }
    // endregion

    // region Phase - Dimensions Finished

    // We assume that, since the `init` phase,
    // the (pre-)binding of visual roles to dimensions or their source roles has not changed.
    //
    // However, the translation has now had a chance to configure the complex type project,
    // defining new dimensions or just configuring existing ones (with valueType, label, etc),
    // and, in any case, marking those as being read or calculated.
    //
    // For what the binding of visual roles to dimensions is concerned,
    // now is the time to check whether the default dimensions (Role#defaultDimensionName) of
    // still unbound visual roles actually exist.
    //
    // Also, because all other possible contributors (just the translation, really) to defining
    // new dimensions have already done so, default dimensions of roles having `autoCreateDimension` to true,
    // are now created as a last resort.
    //
    // Roles are bound before actually loading data.
    // One of the reasons is for being possible to filter datums
    // whose "every dimension in a measure role is null".
    function phase_dimensionsFinished() {

        visualRolesBinder_assertState(state, INIT_AFTER);
        state = DIMS_FINISHED_DURING;

        // For every unbound role:
        // 1. if sourced: add to `unboundSourcedRolesList`
        // 2. if defaultDimension specified
        //    2.1 if exists: pre-bind to dim(s)
        //    2.2 if autoCreate: create dim and pre-bind to it
        // 3. if defaultSourceRoleName specified and exists: source and add to `unboundSourcedRolesList`
        // 4. mark unbound, throwing if required.
        context.query()
            .where(function(role) { return !role.isPreBound(); })
            .each(autoPrebindUnboundRole);

        // -------

        // By now, any not sourced, unbound required role already caused throwing a required role error.

        // Try to pre-bind sourced roles that are still unbound.
        // Last call. Pre-bind or fail if required.
        unboundSourcedRolesList.forEach(function(role) {
            if(!tryPreBindSourcedRole(role)) {
                roleIsUnbound(role);
            }
        });

        // -------

        applySingleRoleDefaultsToDimensions();

        state = DIMS_FINISHED_AFTER;
    }

    function autoPrebindUnboundRole(role) {

        if(role.sourceRole) {
            return addUnboundSourcedRole(role);
        }

        // --------------

        // Try to bind automatically to defaultDimensionName.
        var defaultDimName = role.defaultDimensionGroup;
        if(defaultDimName) {
            if(role.defaultDimensionGreedy) {
                // e.g.: "category*"

                // TODO: does not respect any index explicitly specified before the *. It could mean >=...
                var groupDimNames = complexTypeProj.groupDimensionsNames(defaultDimName);
                if(groupDimNames) {
                    return preBindRoleToDimensions(role, groupDimNames);
                }

                // Continue to auto create dimension

            } else if(complexTypeProj.hasDim(defaultDimName)) {
                // e.g.: "category"

                return preBindRoleToDimensions(role, defaultDimName);
            }

            if(role.autoCreateDimension) {
                // Create a hidden dimension and bind the role to it.
                // Dimension will receive only null data.
                complexTypeProj.setDim(defaultDimName, {isHidden: true});

                return preBindRoleToDimensions(role, defaultDimName);
            }

            // default dimension(s) is not defined and not autoCreateDimension.
        }

        // --------------

        // Source from defaultSourceRoleName, if it is specified and exists.
        if(role.defaultSourceRoleName) {
            var source = context(role.defaultSourceRoleName);
            if(source) {
                role.setSourceRole(source);
                return addUnboundSourcedRole(role);
            }
        }

        // --------------

        roleIsUnbound(role);
    }

    function preBindRoleToDimensions(role, dimNames) {

        var grouping = cdo.GroupingSpec.parse(dimNames);

        preBindRoleToGrouping(role, grouping);
    }

    function roleIsUnbound(role) {
        // Throws if role is required
        visRoleBinder_assertUnboundRoleIsOptional(role); // throws if required

        // Unbind role from any previous binding
        role.bind(null);
        role.setSourceRole(null); // if any
    }
    // endregion

    // region Phase - Bind Roles
    function phase_bindRoles(complexType) {

        visualRolesBinder_assertState(state, DIMS_FINISHED_AFTER);
        state = BIND_ROLES_DURING;

        // Commits existing pre-bindings for the given complex type.
        // Validates existence of dimensions referenced in the grouping specifications.
        // Roles that are pre-bound to null groupings discard these (they are not required).
        context.query()
            .where(function(role) { return role.isPreBound();   })
            .each (function(role) { role.postBind(complexType); });

        // -------

        if(doLog) logVisualRoles();

        state = BIND_ROLES_AFTER;
    }

    function logVisualRoles() {
        var table = def.textTable(3)
            .rowSep()
            .row("Visual Role", "Source Role", "Bound to Dimension(s)")
            .rowSep();

        context.query().each(function(role) {
            table.row(
                role.prettyId(),
                role.sourceRole ? role.sourceRole.prettyId() : "-",
                String(role.grouping || "-"));
        });

        table.rowSep(true);

        logger("VISUAL ROLES MAP SUMMARY\n" + table() + "\n");
    }
    // endregion
};

function visRoleBinder_assertUnboundRoleIsOptional(role) {
    if(role.isRequired)
        throw def.error.operationInvalid("The required visual role '{0}' is unbound.", [role.name]);
}

function visualRolesBinder_assertState(state, desiredState) {
    if(state !== desiredState)
        throw def.error.operationInvalid("Invalid state.");
}
