/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * BarAbstract is the base class for generating charts of the bar family.
 */
def
.type('pvc.BarAbstract', pvc.CategoricalAbstract)
.add({
    // NOTE
    // Timeseries category with bar charts are supported differently in V2 than in V1
    // They worked in v1 if the data set brought all
    // categories, according to chosen timeseries scale date unit
    // Then, bars were drawn with a category scale, 
    // whose positions ended up coinciding with the ticks in a linear axis...
    // To mimic v1 behavior the category dimensions are "coerced" to isDiscrete
    // The axis will be categoric, the parsing will work, 
    // and the formatting will be the desired one

    /**
     * Initializes each chart's specific roles.
     * @override
     */
    _initVisualRoles: function() {
        
        this.base();
        
        this._addVisualRole('value', {
            isMeasure: true,
            isRequired: true,
            isPercent: this.options.stacked,
            requireSingleDimension: true,
            requireIsDiscrete: false,
            valueType: Number,
            defaultDimension: 'value'
        });
    },
    
    _getCategoryRoleSpec: function() {
        var catRoleSpec = this.base();
        
        // Force dimension to be discrete!
        catRoleSpec.requireIsDiscrete = true;
        
        return catRoleSpec;
    }
});
