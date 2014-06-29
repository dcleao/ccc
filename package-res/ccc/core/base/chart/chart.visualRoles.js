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

    _getDataPartDimName: function(useDefault) {
        var role = this.visualRoles.dataPart, preGrouping;
        return role.isBound()                          ? role.lastDimensionName()        :
               (preGrouping = role.preBoundGrouping()) ? preGrouping.lastDimensionName() :
               useDefault                              ? role.defaultDimensionName       :
               null;
    }
});

