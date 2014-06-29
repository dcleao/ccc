/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Namespace with data related classes.
 * @name pvc.data
 * @namespace
 */

/**
 * @name NoDataException
 * @class An error thrown when a chart has no data.
 */
def.global.NoDataException = function() {};

/**
 * @name InvalidDataException
 * @class An error thrown when data exists but the chart cannot be rendered from it.
 */
def.global.InvalidDataException = function(msg) {
    this.message = msg ? msg : "Invalid Data.";
};

pvc.data = {
    visibleKeyArgs: {visible: true}
};

/**
 * Disposes a list of child objects.
 * 
 * @name pvc.data._disposeChildList
 * 
 * @param {Array} list The list with children to dispose.
 * @param {string} [parentProp] The child's parent property to reset.
 * 
 * @static
 * @private
 */
function data_disposeChildList(list, parentProp) {
    var L = list && list.length;
    if(L) {
        for(var i = 0 ; i < L ; i++) {
            var child = list[i];

            // Avoid child removing itself from its parent.
            // removeAt is generally an expensive operation.
            if(parentProp) child[parentProp] = null;
            
            child.dispose(); 
        }
        list.length = 0;
    }
}

/**
 * Adds a child object.
 * 
 * @name pvc.data._addColChild
 * 
 * @param {object} parent The parent.
 * @param {string} childrenProp A parent's children array property.
 * @param {object} child The child to add.
 * @param {string} parentProp The child's parent property to set.
 * @param {number} [index=null] The index at which to insert the child.
 * 
 * @static
 * @private
 */
function data_addColChild(parent, childrenProp, child, parentProp, index) {
    // <Debug>
    /*jshint expr:true */
    //(child && !child[parentProp]) || def.assert("Must not have a '" + parentProp + "'.");
    // </Debug>
    
    child[parentProp] = parent;
    
    var col = (parent[childrenProp] || (parent[childrenProp] = []));
    if(index == null || index >= col.length)
        col.push(child);
    else
        col.splice(index, 0, child);
}

/**
 * Removes a child object.
 * 
 * @name pvc.data._removeColChild
 * 
 * @param {object} parent The parent.
 * @param {string} childrenProp A parent's children array property.
 * @param {object} child The child to remove.
 * @param {string} parentProp The child's parent property to reset.
 * 
 * @static
 * @private
 */
function data_removeColChild(parent, childrenProp, child, parentProp) {
    // <Debug>
    /*jshint expr:true */
    //(child && (!child[parentProp] || child[parentProp] === parent)) || def.assert("Not a child");
    // </Debug>
    
    var children = parent[childrenProp], index;
    if(children && (index = children.indexOf(child)) >= 0) def.array.removeAt(children, index);
    child[parentProp] = null;
}
