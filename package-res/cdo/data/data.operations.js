
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

cdo.Data.add(/** @lends cdo.Data# */{

    select: null,

    /**
     * Loads or reloads the data with the specified enumerable of atoms.
     *
     * <p>
     * Can only be called on an owner data.
     * Child datas are instead "loaded" on construction,
     * with a subset of its parent's datums.
     * </p>
     *
     * <p>
     * This method was designed to be fed with the output
     * of {@link cdo.TranslationOper#execute}.
     * </p>
     *
     * @param {def.Query} atomz An enumerable of {@link map(string union(any || cdo.Atom))}.
     * @param {object} [keyArgs] Keyword arguments.
     * @param {function} [keyArgs.isNull] Predicate that indicates if a datum is considered null.
     * @param {function} [keyArgs.where] Filter function that approves or excludes each newly read datum.
     */
    load: function(atomz, keyArgs) {
        /*global cdo_assertIsOwner:true */
        cdo_assertIsOwner.call(this);

        var whereFun  = def.get(keyArgs, 'where'),
            isNullFun = def.get(keyArgs, 'isNull'),
            isAdditive     = def.get(keyArgs, 'isAdditive', false),
            datums = def.query(atomz)
                .select(function(atoms) {
                    var datum = new cdo.Datum(this, atoms);
                    if(isNullFun && isNullFun(datum)) datum.isNull = true;
                    if(whereFun  && !whereFun(datum)) return null;

                    return datum;
                }, this);

        data_setDatums.call(this, datums, {isAdditive: isAdditive, doAtomGC: true});
    },


    clearVirtuals: function() {
        // Recursively clears all virtual datums and atoms
        var datums = this._datums;
        if(datums) {
            this._sumAbsCache = null;

            var i = 0,
                L = datums.length,
                removed;
            while(i < L) {
                var datum = datums[i];
                if(datum.isVirtual) {

                    cdo_removeDatumLocal.call(this, datum);
                    L--;
                    removed = true;
                } else {
                    i++;
                }
            }

            if(removed) {
                // "Me is a group"
                if(!datums.length && this.parent) return void this.dispose();

                var children = this.childNodes;
                if(children) {
                    i = 0;
                    L = children.length;
                    while(i < L) {
                        var childData = children[i];
                        childData.clearVirtuals();
                        if(!childData.parent)
                            // Child group was empty and removed itself
                            L--;
                        else
                            i++;
                    }
                }

                if(this._linkChildren) this._linkChildren.forEach(function(linkChildData) {
                    linkChildData.clearVirtuals();
                });
            }
        }

        /*global dim_uninternVirtualAtoms:true*/
        def.eachOwn(this._dimensions, function(dim) { dim_uninternVirtualAtoms.call(dim); });
    },

    /**
     * Adds new datums to the owner data.
     * @param {cdo.Datum[]|def.Query} datums The datums to add.
     */
    add: function(datums) {
        /*global cdo_assertIsOwner:true, data_setDatums:true*/

        cdo_assertIsOwner.call(this);

        data_setDatums.call(this, datums, {isAdditive: true, doAtomGC: true});
    },

    /**
     * Groups the datums of this data, possibly filtered,
     * according to a grouping specification.
     *
     * <p>
     * The result of the grouping operation over a set of datums
     * is a new <i>linked child</i> data.
     *
     * It is a root data,
     * but shares the same {@link #owner} and {@link #atoms} with this,
     * and has the considered datums in {@link #datums}.
     *
     * The data will contain one child data per distinct atom,
     * of the first grouping level dimension,
     * found in the datums.
     * Each child data will contain the datums sharing that atom.
     *
     * This logic extends to all following grouping levels.
     * </p>
     *
     * <p>
     * Datums with null atoms on a grouping level dimension are excluded.
     * </p>
     *
     * @param {string|string[]|cdo.GroupingOperSpec} groupingSpecText A grouping specification string or object.
     * <pre>
     * "series1 asc, series2 desc, category"
     * </pre>
     *
     * @param {Object} [keyArgs] Keyword arguments object.
     * See additional keyword arguments in {@link cdo.GroupingOper}
     *
     * @see #where
     * @see cdo.GroupingLevelSpec
     *
     * @returns {cdo.Data} The resulting root data.
     */
    groupBy: function(groupingSpecText, keyArgs) {
        var groupOper = new cdo.GroupingOper(this, groupingSpecText, keyArgs),
            cacheKey  = groupOper.key,
            groupByCache,
            data;

        if(cacheKey) {
            groupByCache = this._groupByCache;

            // Check cache for a linked data with that key
            data = groupByCache && groupByCache[cacheKey];
        }

        if(!data) {
            if(def.debug >= 7) def.log("[GroupBy] " + (cacheKey ? ("Cache key not found: '" + cacheKey + "'") : "No Cache key"));

            data = groupOper.execute();

            if(cacheKey) (groupByCache || (this._groupByCache = {}))[cacheKey] = data;
        } else if(def.debug >= 7) {
            def.log("[GroupBy] Cache key hit '" + cacheKey + "'");
        }

        return data;
    },

    /**
     * Creates a linked data with the result of filtering
     * the datums of this data.
     *
     * <p>
     * This operation differs from {@link #datums} only in the type of output,
     * which is a new linked data, instead of an enumerable of the filtered datums.
     * See {@link #datums} for more information on the filtering operation.
     * </p>
     *
     * <p>
     * Any datums that are later added to `this` will be also added to
     * the returned data set, in case these match the specified filters.
     * </p>
     *
     * @param {object} [querySpec] A query specification.
     * @param {object} [keyArgs] Keyword arguments object.
     * See {@link #datums} for information on available keyword arguments.
     *
     * @returns {!cdo.Data} A linked data containing the filtered datums.
     */
    where: function(querySpec, keyArgs) {
        // This code is adapted from #datums to build a data set, in the end, including the where predicate.
        //
        // var datums = this.datums(querySpec, keyArgs);

        // Normalize the query spec.
        var normalizedQuerySpec = querySpec && data_normalizeQuerySpec.call(this, querySpec);

        var datums = this._datums;
        if(!datums) {
            datums = [];
        } else if(normalizedQuerySpec) {
            // Filter by the query spec, possibly using the specified keyArgs.orderBy.
            // Also filters by any state attributes (visible, selected, isNull, where).
            // Internal group by operation is cached.
            datums = data_where.call(this, normalizedQuerySpec, keyArgs);
        } else if(keyArgs) {
            // Filter datums by their "state" attributes.
            // Search not cached.
            datums = data_whereState(def.query(datums), keyArgs);
        }

        if(querySpec) {
            // Normalize the query spec.
            normalizedQuerySpec = data_normalizeQuerySpec.call(this, querySpec);
        }

        // `normalizedQuerySpec` and `keyArgs` arguments must be compiled into a single where predicate
        // so that, later, any added datums flow through to the returned data set.
        // null if nothing to filter on.
        var where = (normalizedQuerySpec || keyArgs) && data_wherePredicate(normalizedQuerySpec, keyArgs);

        return new cdo.Data({linkParent: this, datums: datums, where: where});
    },

    /**
     * Gets an enumerable for the datums of this data,
     * possibly filtered according to a given query specification and datum states.
     *
     * @param {object} [querySpec] A query specification.
     * A structure with the following form:
     * <pre>
     * // OR of datum filters
     * querySpec = [datumFilter1, datumFilter2, ...] | datumFilter;
     *
     * // AND of dimension filters
     * datumFilter = {
     *      // OR of dimension values
     *      dimName1: [value1, value2, ...],
     *      dimName2: value1,
     *      ...
     * }
     * </pre>
     * <p>Values of a datum filter can also directly be atoms.</p>
     * <p>
     *    An example of a query specification:
     * </p>
     * <pre>
     * querySpec = [
     *     // Datums whose series is 'Europe' or 'Australia',
     *     // and whose category is 2001 or 2002
     *     {series: ['Europe', 'Australia'], category: [2001, 2002]},
     *
     *     // Union'ed with
     *
     *     // Datums whose series is 'America'
     *     {series: 'America'},
     * ];
     * </pre>
     *
     * @param {object} [keyArgs] Keyword arguments object.
     *
     * @param {boolean} [keyArgs.isNull=null]
     *      Only considers datums with the specified isNull attribute.
     *
     * @param {boolean} [keyArgs.visible=null]
     *      Only considers datums that have the specified visible state.
     *
     * @param {boolean} [keyArgs.selected=null]
     *      Only considers datums that have the specified selected state.
     *
     * @param {function} [keyArgs.where] An arbitrary datum predicate.
     *
     * @param {string} [keyArgs.whereKey] A key for the specified datum predicate.
     * If <tt>keyArgs.where</tt> is specified and this argument is not, the results will not be cached.
     *
     * @param {string[]} [keyArgs.orderBy] An array of "order by" strings to be applied to each
     * datum filter of <i>querySpec</i>.
     * <p>
     * An "order by" string is the same as a grouping specification string,
     * although it is used here with a slightly different meaning.
     * Here's an example of an "order by" string:
     * <pre>
     * "series1 asc, series2 desc, category"
     * </pre
     * </p>
     *
     * <p>
     * When not specified, altogether or individually,
     * these are determined to match the corresponding datum filter of <i>querySpec</i>.
     * </p>
     *
     * <p>
     * If a string is specified it is treated as the "order by" string corresponding
     * to the first datum filter.
     * </p>
     *
     * @return {def.Query} A query object that enumerates the matching {@link cdo.Datum} objects.
     *
     * @see #where
     */
    datums: function(querySpec, keyArgs) {

        if(!this._datums) {
            return def.query();
        }

        if(!querySpec) {
            if(!keyArgs) {
                return def.query(this._datums);
            }

            // Filter datums by their "state" attributes (visible, selected, isNull, where).
            // Not cached.
            return data_whereState(def.query(this._datums), keyArgs);
        }

        // Normalize the query spec.
        var normalizedQuerySpec = data_normalizeQuerySpec.call(this, querySpec);

        // Filter by the query spec, possibly using the specified keyArgs.orderBy.
        // Also filters by any state attributes (visible, selected, isNull, where).
        // Internal group by operation is cached.
        return data_where.call(this, normalizedQuerySpec, keyArgs);
    },

    /**
     * Obtains the first datum that satisfies a given query specification.
     * <p>
     * If no datum satisfies the filter, null is returned.
     * </p>
     *
     * @param {object} [querySpec] A query specification.
     * See {@link #datums} for information on this structure.
     *
     * @param {object} [keyArgs] Keyword arguments object.
     * See {@link #datums} for additional available keyword arguments.
     *
     * @return {cdo.Datum} The first datum that satisfies the specified filter or <i>null</i>.
     *
     * @see cdo.Data#datums
     */
    datum: function(querySpec, keyArgs) {
        return this.datums(querySpec, keyArgs).first() || null;
    },

    /**
     * Sums the absolute value of a specified dimension on each child data.
     *
     * @param {string} dimName The name of the dimension.
     * @param {object} [keyArgs] Optional keyword arguments that are
     * passed to each dimension's {@link cdo.Dimension#valueAbs} method.
     *
     * @type number
     */
    dimensionsSumAbs: function(dimName, keyArgs) {

        /*global dim_buildDatumsFilterKey:true */

        var key = dimName + ":" + dim_buildDatumsFilterKey(keyArgs),
            sum = def.getOwn(this._sumAbsCache, key);

        if(sum == null) {
            sum = this.children()
                    /* non-degenerate flattened parent groups would account for the same values more than once */
                    .where(function(childData) { return !childData._isFlattenGroup || childData._isDegenerateFlattenGroup; })
                    .select(function(childData) {
                        return childData.dimensions(dimName).valueAbs(keyArgs) || 0;
                    }, this)
                    .reduce(def.add, 0);

            // assert sum != null

            (this._sumAbsCache || (this._sumAbsCache = {}))[key] = sum;
        }

        return sum;
    }
})
.type()
.add(/** @lends cdo.Data */{
    /**
     * Obtains the lowest common ancestor of the given datas.
     * The algorithm crosses linked parents.
     *
     * @param {cdo.Data[]} datas The data instances of which the lowest common ancestor is desired.
     * @return {cdo.Data} The lowest common ancestor, or <tt>null</tt>, if none.
     */
    lca: function(datas) {
        var L = datas.length,
            a = null,
            dataA, dataB, listA, listB;
        if(L) {
            if(L === 1) return datas[0];
            // L >= 2

            var i = 1;
            //dataA = datas[0];
            listA = data_ancestorsAndSelfList(datas[0]);
            do {
                dataB = datas[i];
                listB = data_ancestorsAndSelfList(dataB);

                if(!(a = data_lowestCommonAncestor(listA, listB))) return null;

                // next
                dataA = dataB;
                listA = listB;
            } while(++i < L);
        }
        return a;
    }
});

function data_ancestorsAndSelfList(data) {
    var ancestors = [data], p;
    while((p = (data.parent || data.linkParent))) ancestors.unshift(data = p);
    return ancestors;
}

function data_lowestCommonAncestor(listA, listB) {
    var i = 0,
        L = Math.min(listA.length, listB.length),
        a = null,
        next;
    while(i < L && ((next = listA[i]) === listB[i])) {
        a = next;
        i++;
    }
    return a;
}

/**
 * Called to add or replace the contained {@link cdo.Datum} instances.
 *
 * When replacing, all child datas and linked child datas are disposed.
 *
 * When adding, the specified datums will be added, recursively,
 * to this data's parent or linked parent, and its parent, until the owner data is reached.
 * When crossing a linked parent,
 * the other linked children of that parent
 * are given a chance to receive a new datum,
 * and it will be added if it satisfies its inclusion criteria.
 *
 * The datums' atoms must be consistent with the base atoms of this data.
 * If this data inherits a non-null atom in a given dimension and:
 * <ul>
 * <li>a datum has another non-null atom, an error is thrown.</li>
 * <li>a datum has a null atom, an error is thrown.
 * </ul>
 *
 * @name cdo.Data#_setDatums
 * @function
 * @param {cdo.Datum[]|def.Query} addDatums An array or enumerable of datums. When an array, it is not mutated.
 *
 * @param {object} [keyArgs] Keyword arguments.
 * @param {boolean} [keyArgs.isAdditive=false] Indicates that the specified datums are to be added,
 * instead of replace existing datums.
 * @param {boolean} [keyArgs.doAtomGC=false] Indicates that atom garbage collection should be performed.
 *
 * @type undefined
 * @private
 */
function data_setDatums(addDatums, keyArgs) {
    // But may be an empty list
    /*jshint expr:true */
    addDatums || def.fail.argumentRequired('addDatums');

    var i, L,
        doAtomGC   = def.get(keyArgs, 'doAtomGC',   false),
        isAdditive = def.get(keyArgs, 'isAdditive', false),
        // When creating a linked data, datums are set when dimensions aren't yet created.
        // Cannot intern without dimensions...
        internNewAtoms = !!this._dimensions,
        visDatums = this._visibleNotNullDatums,
        selDatums = this._selectedNotNullDatums,

        // When adding:
        //  * _datums, _datumsByKey and _datumsById can be maintained.
        //  * If an existing datum comes up in addDatums,
        //    the original datum is kept, as well as its order.
        //  * Caches still need to be cleared.
        // When replacing:
        //  * Different {new,old}DatumsBy{Key,Id} must be defined for the operation.
        //  * Same-key datums are maintained, anyway.
        //  * All child-data and link-child-data are disposed of.

        oldDatumsByKey, oldDatumsById,
        oldDatums = this._datums,
        newDatums, datums, datumsByKey, datumsById;

    if(!oldDatums) {
        // => !additive
        isAdditive = false;
    } else {
        oldDatumsByKey = this._datumsByKey;
        oldDatumsById  = this._datumsById ;
    }

    if(isAdditive) {
        newDatums   = [];

        datums      = oldDatums;
        datumsById  = oldDatumsById;
        datumsByKey = oldDatumsByKey;

        // Clear caches
        this._sumAbsCache = null;
    } else {
        this._datums      = datums      = [];
        this._datumsById  = datumsById  = {};
        this._datumsByKey = datumsByKey = {};

        if(oldDatums) {
            // Clear children (and caches)
            /*global cdo_disposeChildLists:true*/
            cdo_disposeChildLists.call(this);

            visDatums.clear();
            selDatums && selDatums.clear();
        }
    }

    if(def.array.is(addDatums)) {
        i = 0;
        L = addDatums.length;
        while(i < L) maybeAddDatum.call(this, addDatums[i++]);
    } else if(addDatums instanceof def.Query) {
        addDatums.each(maybeAddDatum, this);
    } else {
        throw def.error.argumentInvalid('addDatums', "Argument is of invalid type.");
    }

    // Datum evaluation according to a score/select criteria
    // Defaults don't remove anything
    if(this.select) this.select(datums).forEach(cdo_removeDatumLocal, this);

    // Mark and sweep Garbage Collection pushed to the end of function

    // TODO: change this to a visiting id method,
    //  that by keeping the atoms on the previous visit id,
    //  would allow not having to do this mark-visited phase.

    // Visit atoms of existing datums.
    if(oldDatums && isAdditive && doAtomGC) {
        // We cannot simply mark all atoms of every dimension
        //  cause, now, these may already contain new atoms
        //  used (or not) by the new datums.
        oldDatums.forEach(function(oldDatum) {
            data_processDatumAtoms.call(
                    this,
                    oldDatum,
                    /* intern */      false,
                    /* markVisited */ true);
        }, this);
    }

    if(/*isAdditive && */ newDatums || !isAdditive){

        if(!isAdditive) { newDatums = datums; }

        newDatums.forEach(function(newDatum) {
            data_processDatumAtoms.call(
                this,
                newDatum,
                /* intern      */ internNewAtoms,
                /* markVisited */ doAtomGC);

            // TODO: make this lazy?
            if(!newDatum.isNull) {
                var id = newDatum.id;
                if(selDatums && newDatum.isSelected) selDatums.set(id, newDatum);
                if(newDatum.isVisible) visDatums.set(id, newDatum);
            }

        }, this);
    }

    // Atom garbage collection. Un-intern unused atoms.
    if(doAtomGC) {
        /*global dim_uninternUnvisitedAtoms:true*/
        var dims = this._dimensionsList;
        i = 0;
        L = dims.length;
        while(i < L) dim_uninternUnvisitedAtoms.call(dims[i++]);
    }

    // TODO: not distributing to child lists of this data?
    // Is this assuming that `this` is the root data,
    // and thus was not created from grouping, and so having no children?

    if(isAdditive) {
        // `newDatums` contains really new datums (no duplicates).
        // These can be further filtered in the grouping operation.

        // Distribute added datums by linked children.
        var linkChildren = this._linkChildren;
        if(linkChildren) {
            i = 0;
            L = linkChildren.length;
            while(i < L) cdo_addDatumsSimple.call(linkChildren[i++], newDatums);
        }
    }

    function maybeAddDatum(newDatum) {
         // Ignore.
        if(!newDatum) return;

        // Use already existing same-key datum, if any.
        var key = newDatum.key;

        // Duplicate datum?

        // When isAdditive, datumsByKey = oldDatumsByKey,
        //  so the following also tests for duplicates with old datums,
        //  in which case we keep the old and discard the new one.
        if(def.hasOwnProp.call(datumsByKey, key)) return;

        if(!isAdditive && oldDatumsByKey && def.hasOwnProp.call(oldDatumsByKey, key))
            // Still preferable to keep/_re-add_ the old and discard the new one.
            newDatum = oldDatumsByKey[key];

        var id = newDatum.id;

        datums.push(newDatum);
        datumsByKey[key] = newDatum;
        datumsById [id ] = newDatum;

        if(/*isAdditive && */newDatums) newDatums.push(newDatum);

        // removed the marking part of Garbage collector
        // We can mark as selected/visible, because in the removal it's unmarked
        if(!newDatum.isNull) {
            if(selDatums && newDatum.isSelected) selDatums.set(id, newDatum);
            if(newDatum.isVisible) visDatums.set(id, newDatum);
        }
    }
}

/**
 * Processes the atoms of this datum.
 * If a virtual null atom is found then
 * the null atom of that dimension is interned.
 * If desired the processed atoms are marked as visited.
 *
 * @name cdo.Datum._processAtoms
 * @function
 * @param {cdo.Datum} datum The datum.
 * @param {boolean} [intern=false] If virtual nulls should be detected.
 * @param {boolean} [markVisited=false] If the atoms should be marked as visited.
 * @type undefined
 * @internal
 */
function data_processDatumAtoms(datum, intern, markVisited) {
    // Avoid using for(var dimName in datum.atoms),
    // cause it needs to traverse the whole, long scope chain

    var dims = this._dimensionsList;
    // data is still initializing and dimensions are not yet created ?
    if(!dims) intern = false;

    if(intern || markVisited) {
        var datoms = datum.atoms,
            i = 0,
            L, atom, dim;
        if(!dims) { // => markVisited
            var dimNames = this.type.dimensionsNames();
            L = dimNames.length;
            while(i < L) {
                atom = datoms[dimNames[i++]];
                if(atom) atom.visited = true;
            }
        } else {
            L = dims.length;
            while(i < L) {
                dim = dims[i++];
                atom = datoms[dim.name];
                if(atom) {
                    /*global dim_internAtom:true */
                    if(intern) dim_internAtom.call(dim, atom);

                    // Mark atom as visited
                    if(markVisited) atom.visited = true;
                }
            }
        }
    }
}

function cdo_addDatumsSimple(newDatums) {
    // But may be an empty list
    /*jshint expr:true */
    newDatums || def.fail.argumentRequired('newDatums');

    var groupOper = this._groupOper;
    if(groupOper) {
        // This data gets its datums,
        //  possibly filtered (groupOper calls cdo_addDatumsLocal).
        // Children get their new datums.
        // Linked children of children get their new datums.
        newDatums = groupOper.executeAdd(this, newDatums);
    } else {
        var wherePred = this._wherePred;
        if(wherePred) newDatums = newDatums.filter(wherePred);

        cdo_addDatumsLocal.call(this, newDatums);
    }

    // Distribute added datums by linked children
    var linkChildren = this._linkChildren,
        L = linkChildren && linkChildren.length;
    if(L) for(var i = 0 ; i < L ; i++) cdo_addDatumsSimple.call(linkChildren[i], newDatums);
}

function cdo_addDatumsLocal(newDatums) {
    var me = this,
        ds  = me._datums,
        vds = me._visibleNotNullDatums,
        sds = me._selectedNotNullDatums,
        dsById = me._datumsById;

    // Clear caches
    me._sumAbsCache = null;

    for(var i = 0, L = newDatums.length ; i < L ; i++) {
        var newDatum = newDatums[i],
            id = newDatum.id;

        dsById[id] = newDatum;

        data_processDatumAtoms.call(
                me,
                newDatum,
                /* intern      */ true,
                /* markVisited */ false);

        // TODO: make this lazy?
        if(!newDatum.isNull) {
            if(sds && newDatum.isSelected) sds.set(id, newDatum);
            if(       newDatum.isVisible ) vds.set(id, newDatum);
        }

        ds.push(newDatum);
    }
}


// Auxiliar function to remove datums (to avoid repeated code)
// removes datums instance from datums, datumById, datumByKey;
// remove from selected and visible if necessary
function cdo_removeDatumLocal(datum) {

    var datums = this._datums;
    var selDatums = this._selectedNotNullDatums;
    var id = datum.id;

    datums.splice(datums.indexOf(datum), 1);
    delete this._datumsById [id ];
    delete this._datumsByKey[datum.key];

    if(selDatums && datum.isSelected) selDatums.rem(id);
    if(datum.isVisible) this._visibleNotNullDatums.rem(id);
}

/**
 * Normalizes a given query specification.
 * <p>
 * Normalizes and validates the specification syntax,
 * validates dimension names,
 * readily excludes uninterned (unexistent) and duplicate values and
 * atoms based on their "visible state".
 * </p>
 *
 * <p>
 * The returned specification contains dimensions instead of their names
 * and atoms, instead of their values.
 * </p>
 *
 * @name cdo.Data#_normalizeQuerySpec
 * @function
 *
 * @param {object} querySpec A query specification to be normalized.
 * TODO: A structure with the following form: ...
 *
 * @return Array A <i>normalized</i> query of the specification.
 * A structure with the following form:
 * <pre>
 * // OR of processed datum filters
 * whereProcSpec = [datumProcFilter1, datumProcFilter2, ...] | datumFilter;
 *
 * // AND of processed dimension filters
 * datumProcFilter = {
 *      // OR of dimension atoms
 *      dimName1: [atom1, atom2, ...],
 *      dimName2: atom1,
 *      ...
 * }
 * </pre>
 *
 * @private
 */
function data_normalizeQuerySpec(querySpec) {
    var whereProcSpec = [];

    querySpec = def.array.as(querySpec);
    if(querySpec) querySpec.forEach(processDatumFilter, this);

    return whereProcSpec;

    function processDatumFilter(datumFilter) {
        if(datumFilter != null) {
            /*jshint expr:true */
            (typeof datumFilter === 'object') || def.fail.invalidArgument('datumFilter');

            /* Map: {dimName1: atoms1, dimName2: atoms2, ...} */
            var datumProcFilter = {},
                any = false;
            for(var dimName in datumFilter) {
                // throws if dimension doesn't exist
              var datumFilterValues = datumFilter[dimName];
              var atoms = this.dimensions(dimName)
                    .getDistinctAtoms(datumFilterValues !== null ? def.array.as(datumFilterValues) : [null]);
                if(atoms.length) {
                    any = true;
                    datumProcFilter[dimName] = atoms;
                }
            }

            if(any) whereProcSpec.push(datumProcFilter);
        }
    }
}

/**
 * Filters a datum query according to a specified predicate,
 * datum selected and visible state.
 *
 * @name cdo.Data#_whereState
 * @function
 *
 * @param {def.query} q A datum query.
 * @param {object} [keyArgs] Keyword arguments object.
 * See {@link #groupBy} for additional available keyword arguments.
 *
 * @returns {def.Query} A query object that enumerates the desired {@link cdo.Datum}.
 * @private
 * @static
 */
function data_whereState(q, keyArgs) {
    var visible  = def.get(keyArgs, 'visible'),
        isNull   = def.get(keyArgs, 'isNull'),
        selected = def.get(keyArgs, 'selected'),
        where    = def.get(keyArgs, 'where');

    if(visible  != null) q = q.where(visible  ? datum_isVisibleT  : datum_isVisibleF );
    if(isNull   != null) q = q.where(isNull   ? datum_isNullT     : datum_isNullF    );
    if(selected != null) q = q.where(selected ? datum_isSelectedT : datum_isSelectedF);
    if(where           ) q = q.where(where);

    return q;
}

function data_wherePredicate(querySpec, keyArgs) {
    var visible  = def.get(keyArgs, 'visible' ),
        isNull   = def.get(keyArgs, 'isNull'  ),
        selected = def.get(keyArgs, 'selected'),
        where    = def.get(keyArgs, 'where'   ),
        ps       = [];

    if(visible  != null) ps.unshift(visible  ? datum_isVisibleT  : datum_isVisibleF );
    if(isNull   != null) ps.unshift(isNull   ? datum_isNullT     : datum_isNullF    );
    if(selected != null) ps.unshift(selected ? datum_isSelectedT : datum_isSelectedF);
    if(where           ) ps.unshift(where);
    if(querySpec       ) ps.unshift(cdo_querySpecPredicate(querySpec));

    var P = ps.length;
    if(P) {
        if(P === 1) return ps[0];

        var wherePredicate = function(d) {
            // AND
            var i = P;
            while(i) if(!ps[--i](d)) return false;
            return true;
        };

        return wherePredicate;
    }
}

cdo.querySpecPredicate = cdo_querySpecPredicate;

/**
 * Creates a datum predicate for a query specification.
 *
 * @name cdo.querySpecPredicate
 * @function
 *
 * @param {Array} querySpec A query specification object.
 *
 * @returns {function} A datum predicate function.
 * @static
 */
function cdo_querySpecPredicate(querySpec) {
    var L = querySpec.length;

    return datumQuerySpecPredicate;

    function datumQuerySpecPredicate(d) {
        // OR
        var datoms = d.atoms;
        for(var i = 0 ; i < L ; i++) if(datumFilterPredicate(datoms, querySpec[i])) return true;
        return false;
    }

    function datumFilterPredicate(datoms, datumFilter) {
        // AND
        for(var dimName in datumFilter) {
            // OR
            if(datumFilter[dimName].indexOf(datoms[dimName]) < 0) return false;
        }
        return true;
    }
}

// All the "Filter" and "Spec" words below should be read as if they were prepended by "Proc"
/**
 * Obtains the datums of this data filtered according to a given query specification,
 * and optionally, datum selected and visible state.
 *
 * @alias cdo.Data#_where
 *
 * @param {object} [normalizedQuerySpec] A <i>normalized</i> query specification.
 * @param {object} [keyArgs] Keyword arguments object.
 * See {@link #groupBy} for additional available keyword arguments.
 *
 * @param {string[]} [keyArgs.orderBy] An array of "order by" strings to be applied to each
 * datum filter of <i>normalizedQuerySpec</i>.
 *
 * @return {def.Query} A query object that enumerates the desired {@link cdo.Datum}.
 * @private
 */
function data_where(normalizedQuerySpec, keyArgs) {
    /*
     * e.g.
     *
     * normalizedQuerySpec = [
     *   {country: [atom1], product: [atom2,atom3]}, // <-- datumFilter
     *   {country: [atom4], product: [atom5,atom3]}
     * ]
     *
     * orderBy: [
     *   'country, product',
     *   'country, product'
     * ]
     *
     * Each datum filter can filter on a different set of dimensions.
     *
     * `orderBy` must be contain the same dimensions as those referenced in normalizedQuerySpec.
     */

    var orderBys = def.array.as(def.get(keyArgs, 'orderBy'));

    var datumKeyArgs = def.create(keyArgs || {}, {orderBy: null});

    // The result is the union of the results of filtering by individual datum filters.

    var datumResultsQuery = def.query(normalizedQuerySpec)
           .selectMany(function(normalizedDatumFilter, index) {

               if(orderBys) {
                  datumKeyArgs.orderBy = orderBys[index];
              }

              // Filter using one datum filter.
              return data_queryDatumFilter.call(this, normalizedDatumFilter, datumKeyArgs);
           }, this);

    return datumResultsQuery.distinct(def.propGet('id'));

    /*
    // NOTE: this is the brute force / unguided algorithm - no indexes are used
    function whereDatumFilter(normalizedDatumFilter, index) {
        // normalizedDatumFilter = {dimName1: [atom1, OR atom2, OR ...], AND ...}

        return def.query(this._datums).where(datumPredicate, this);

        function datumPredicate(datum) {
            if((selected === null || datum.isSelected === selected) &&
               (visible  === null || datum.isVisible  === visible)) {
                var atoms = datum.atoms;
                for(var dimName in normalizedDatumFilter) {
                    if(datumFilter[dimName].indexOf(atoms[dimName]) >= 0) {
                        return true;
                    }
                }
            }
        }
    }
    */
}

/**
 * Obtains an enumerable of the datums satisfying <i>normalizedDatumFilter</i>,
 * by constructing and traversing indexes.
 *
 * Uses groupBy, and its cache, to answer the query.
 *
 * @alias cdo.Data#_whereDatumFilter
 *
 * @param {string} normalizedDatumFilter A <i>normalized</i> datum filter.
 *
 * @param {Object} keyArgs Keyword arguments object.
 * See {@link #groupBy} for additional available keyword arguments.
 *
 * @param {string} [keyArgs.orderBy] An "order by" string.
 * When not specified, one is determined to match the specified datum filter.
 * The "order by" string cannot contain multi-dimension levels (dimension names separated with "|").
 *
 * @return {def.Query} A query object that enumerates the matching {@link cdo.Datum} objects.
 *
 * @private
 */
function data_queryDatumFilter(normalizedDatumFilter, keyArgs) {

    /*
     * e.g.:
     *
     * normalizedDatumFilter = {
     *   country: [atom3, atom4],
     *   product: [atom1, atom2]
     * }
     *
     * orderBy = 'country,product'
     */

    var orderBySpecText = keyArgs.orderBy; // keyArgs is required
    if(!orderBySpecText) {
        // Choose the most convenient one orderBy.
        // The sort on dimension names can yield good cache reuse...

        orderBySpecText = Object.keys(normalizedDatumFilter).sort().join(',');
    } else {
        if(orderBySpecText.indexOf("|") >= 0)
            throw def.error.argumentInvalid('keyArgs.orderBy', "Multi-dimension order by is not supported.");

        // TODO: not validating that orderBySpecText actually contains the same dimensions referred in normalizedDatumFilter...
    }

    /*
     * rootData is a data set tree with one level per filtered by dimension 'country' and then 'product'.
     *
     * Each first level children will be one existing value of country, in this data.
     *
     * `normalizedDatumFilter` matches every path where it successively contains the atom of that level's data.
     */

    var rootData = this.groupBy(orderBySpecText, keyArgs);
    var H = rootData.treeHeight;

    /*
        // NOTE:
        // All of the code below is just a stack/state-based translation of
        // the following recursive code (so that it can be used lazily with a def.query),
        // where eachCallback would be called with each resulting datum:

        recursive(rootData, 0);

        function recursive(parentData, h) {
            if(h >= H) {
                // Leaf

                // Yay! Matched all of the dimensions of the normalizedDatumFilter.
                // Every datum in this data is a match.

                parentData._datums.forEach(eachCallback, ctx);
                return;
            }

            // Because only single-dimension per-level is allowed on orderBy,
            // it's always the first dimension that needs to be matched.

            var dimName = parentData._groupLevelSpec.dimensions[0].name;

            normalizedDatumFilter[dimName].forEach(function(orAtom) {
                var childData = parentData.child(orAtom.globalKey);
                if(childData) {
                    // Yay! There is a set of datums containing orAtom.
                    recursive(childData, h + 1);
                }
            }, this);
        }
     */

     var stateStack = [];

     // Ad-hoq query
     return def.query(function(/* nextIndex */) {
         // Advance to next datum
         var state;

         // No current data means starting
         if(!this._data) {
             this._data = rootData;
             this._dimAtomsOrQuery = def.query(normalizedDatumFilter[rootData._groupLevelSpec.dimensions[0].name]);

         // Are there still any datums of the current data to enumerate?
         } else if(this._datumsQuery) {

             // <Debug>
             /*jshint expr:true */
             this._data || def.assert("Must have a current data");
             stateStack.length || def.assert("Must have a parent data"); // cause the root node is "dummy"
             !this._dimAtomsOrQuery || def.assert();
             // </Debug>

             if(this._datumsQuery.next()) {
                 this.item = this._datumsQuery.item;
                 return 1; // has next
             }

             // No more datums here
             // Advance to next leaf data node
             this._datumsQuery = null;

             // Pop parent data
             state = stateStack.pop();
             this._data = state.data;
             this._dimAtomsOrQuery = state.dimAtomsOrQuery;
         }

         // <Debug>
         this._dimAtomsOrQuery || def.assert("Invalid programmer");
         this._data || def.assert("Must have a current data");
         // </Debug>

         // Are there still any OrAtom paths of the current data to traverse?
         var depth = stateStack.length;

         // Any more atom paths to traverse, from the current data?
         do {
             while(this._dimAtomsOrQuery.next()) {

                 var dimAtomOr = this._dimAtomsOrQuery.item,
                     childData = this._data.child(dimAtomOr.key);

                 // Also, advance the test of a leaf child data with no datums, to avoid backtracking
                 if(childData && (depth < H - 1 || childData._datums.length)) {

                     stateStack.push({data: this._data, dimAtomsOrQuery: this._dimAtomsOrQuery});

                     this._data = childData;

                     if(depth < H - 1) {
                         // Keep going up, until a leaf datum is found. Then we stop.
                         this._dimAtomsOrQuery =
                             def.query(normalizedDatumFilter[childData._groupLevelSpec.dimensions[0].name]);
                         depth++;
                     } else {
                         // Leaf data!
                         // Set first datum and leave
                         this._dimAtomsOrQuery = null;
                         this._datumsQuery = def.query(childData._datums);
                         this._datumsQuery.next();
                         this.item = this._datumsQuery.item;
                         return 1; // has next
                     }
                 }
             } // while(atomsOrQuery)

             // No more OR atoms in this _data
             if(!depth) return 0; // finished

             // Pop parent data
             state = stateStack.pop();
             this._data = state.data;
             this._dimAtomsOrQuery = state.dimAtomsOrQuery;
             depth--;
         } while(true);

         // Never executes
         //noinspection UnreachableCodeJS
         return 0; // finished
     });
}
