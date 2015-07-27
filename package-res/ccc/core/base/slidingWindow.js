/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global axis_optionsDef:true*/

def('pvc.visual.SlidingWindow', pvc.visual.OptionsBase.extend({
   
//NEW603 - SLIDING WINDOW OPTIONS 
    init: function(chart) {
        this.base( chart, 'slidingWindow', 0, {byNaked: false} );
    },

    type: {
        methods: {
            props: ['interval','dimName','score', 'select']
        }
    },

    methods: /** @lends pvc.visual.slidingWindow# */{
        _initFromOptions: function() {
            var o = this.option;
            this.set({
                interval:  o('Interval' ),
                dimName:   o('DimName' ),
                score:  o('Score' ),
                select: o('Select' )
            });
        },

        set: function(keyArgs) {

            keyArgs = this._readArgs(keyArgs);

            if(!keyArgs) {
                if(this.interval != null && this.dimName != null && this.score != null  && this.select != null) return;
            } else {

                this.interval = pv.parseDatePrecision(keyArgs.interval, Number.MAX_VALUE);
                this.dimName = keyArgs.dimName ;
                this.score = keyArgs.score ;
                this.select = keyArgs.select ;
                //debugger;
            }

        },

        _readArgs: function(keyArgs) {
            if(keyArgs) {
                var out = {},
                    any = 0,
                    read = function(p) {
                        var v = keyArgs[p];
                        if(v != null)
                            any = true;
                        else
                            v = this[p];

                        out[p] = v;
                    };

                pvc.visual.SlidingWindow.props.forEach(read, this);

                if(any) return out;
            }
        },

        _defaultSlidingWindowScore: function( datum ) { 
            return datum.atoms[this.dimName].rawValue; 
        },

        
        _defaultSlidingWindowSelect: function( allData , remove ) {
                       
            var now = this.chart.data.dimensions(this.dimName).max().rawValue;
            // debugger;
            allData.forEach(function(datum){
                if (this.chart.options.timeSeries) result = Math.abs( new Date(now) - new Date(this.score(datum))); 
                else result=now-this.score(datum);
                if( !this.score(datum) || 
                    result && result > this.interval ) 
                    remove.push(datum);
            },this);

        },

        _setColorAxisDefaults: function(){

            this.chart.axesByType.color.forEach( function(axis){

                var dim = axis.role.grouping.firstDimension;
                this._setOrdering(dim);
                this._preserveAxisColorMap( axis );


            }, this );

        },

        // ?????
        _setOrdering: function( dim ) {
            var dimName = dim.name;
            var dimOptions = this.chart.options.dimensions;
            if (dimOptions) var dimComp = dimOptions[dimName];
            if(!dimComp) dim.type.setComparer(def.ascending); 
            debugger;
        },

        _preserveAxisColorMap: function( axis ) { axis.preserveColorMap(); }

    },


  options: {

        Interval: {
            resolve: '_resolveFull',
            value: Number.MAX_VALUE
        },

        DimName:   {
            resolve: '_resolveFull',
            data: {
                resolveDefault: function(optionInfo) {
                    // Default value of the sliding window dimension depends 
                    // on the dimension associated with the base axis
                    var dimBase = this.chart.axes.base.role.grouping.lastDimensionName();
                    optionInfo.defaultValue(dimBase);
                    return true;
                }
            },
            cast:    String
        },

        Score: {
            resolve: '_resolveFull',
            data: {
                resolveDefault: function(optionInfo) {
                    optionInfo.defaultValue(this._defaultSlidingWindowScore);
                    return true;
                }
            },
            cast: this._defaultSlidingWindowScore
        },

        Select: {
            resolve: '_resolveFull',
            data: {
                resolveDefault: function(optionInfo) {
                    optionInfo.defaultValue(this._defaultSlidingWindowSelect);
                    return true;
                }
            },
            cast: this._defaultSlidingWindowSelect
        }

    }


}));

