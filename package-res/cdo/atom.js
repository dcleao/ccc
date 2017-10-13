/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initializes an atom instance.
 *
 * @name cdo.Atom
 *
 * @class An atom represents a unit of information.
 *
 * <p>
 * To create an atom,
 * call the corresponding dimension's
 * {@link cdo.Dimension#intern} method.
 *
 * Usually this is done by a {@link cdo.TranslationOper}.
 * </p>
 *
 * @property {cdo.Dimension} dimension The owner dimension.
 *
 * @property {number} id
 *           A unique object identifier.
 *
 * @property {any} rawValue The raw value from which {@link #value} is derived.
 *           <p>
 *           It is not always defined.
 *           Values may be the result of
 *           combining multiple source values.
 *
 *           Values may even be constant
 *           and, as such,
 *           not be derived from
 *           any of the source values.
 *           </p>
 *
 * @property {any} value The typed value of the atom.
 *           It must be consistent with the corresponding {@link cdo.DimensionType#valueType}.
 *
 * @property {string} label The formatted value.
 *           <p>
 *           Only the null atom can have a empty label.
 *           </p>
 *
 * @property {string} key The value of the atom expressed as a
 *           string in a way that is unique amongst all atoms of its dimension.
 *           <p>
 *           Only the null atom has a key equal to "".
 *           </p>
 * @property {string} globalKey A semantic key that is unique across atoms of every dimensions.
 *
 * @constructor
 * @private
 * @param {cdo.Dimension} dimension The dimension that the atom belongs to.
 * @param {any} value The typed value.
 * @param {string} label The formatted value.
 * @param {any} rawValue The source value.
 * @param {string} key The key.
 */

def.type('cdo.AbstractAtom')
.add( /** @lends cdo.AbstractAtom# */{

    isVirtual: false,
    rawValue: undefined,

    /**
     * Obtains the label of the atom.
     */
    toString: function() {
        var label = this.label;
        if(label != null) return label;

        label = this.value;
        return label != null ? ("" + label) : "";
    }
});

def.type('cdo.Atom', cdo.AbstractAtom)
.init(function(dimension, value, label, rawValue, key) {
    this.dimension = dimension;
    this.id = (value == null ? -def.nextId() : def.nextId()); // Ensure null sorts first, when sorted by id
    this.value = value;
    this.label = label;
    if(rawValue !== undefined) this.rawValue = rawValue;
    this.key = key;
});

// Aggregated Atoms are used ONLY within Data#atoms,
// for dimensions which are not part of the overall group by key.
//
// data.atoms.sales          .{value,label} (default aggregation can be read directly)
// data.atoms.sales.sum      .{value,label}
// data.atoms.sales.percent  .{value,label} (requires a parent data)
// data.atoms.sales.minimum  .{value,label}

var cdo_AggAtom_keyArgs = {zeroIfNone: false};

def.type('cdo.AggregatedAtom', cdo.AbstractAtom)
.init(function(dimension) {
    this.dimension = dimension;
}).add( /** @lends cdo.AggregatedAtom# */{
    __read: function(value) {
        var dim = this.dimension;
        var pseudoAtom = dim.read(value);
        return pseudoAtom || dim.owner._virtualNullAtom;
    },

    __agg: function() {
        // eq to this.sum...
        return this.__read(this.dimension.value(cdo_AggAtom_keyArgs));
    }
});

Object.defineProperties(cdo.AggregatedAtom.prototype, {
    // Direct atom properties, expose the atom corresponding to the dimension's "default aggregation":
    "id": {
        get: function() { return this.__agg().id; } // NOT DEFINED!!!
    },
    "key": {
        get: function() { return this.__agg().key; }
    },
    "value": {
        get: function() { return this.__agg().value; }
    },
    "rawValue": {
        get: function() { return this.__agg().rawValue; }
    },
    "label": {
        get: function() { return this.__agg().label; }
    },

    // Atoms of derived sub-dimensions (statistical, metadata).

    // For numeric dimensions
    "sum": {
        get: function() { return this.__read(this.dimension.sum(cdo_AggAtom_keyArgs)); }
    },
    "sumAbs": {
        get: function() { return this.__read(this.dimension.sumAbs(cdo_AggAtom_keyArgs)); }
    },
    "percent": {
        get: function() { return this.__read(this.dimension.valuePercent(cdo_AggAtom_keyArgs)); }
    },
    // TODO: average, ...

    // For ordinal dimensions
    "minimum": {
        get: function() { return this.__read(this.dimension.min(cdo_AggAtom_keyArgs)); }
    },
    "maximum": {
        get: function() { return this.__read(this.dimension.max(cdo_AggAtom_keyArgs)); }
    }


    // TODO: dimensions
});

/**
 * Comparer for atom according to their id.
 */
function atom_idComparer(a, b) {
    return a.id - b.id; // works for numbers...
}

/**
 * Reverse comparer for atom according to their id.
 */
function atom_idComparerReverse(a, b) {
    return b.id - a.id; // works for numbers...
}
