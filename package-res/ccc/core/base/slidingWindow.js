/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global axis_optionsDef:true*/

def('pvc.visual.SlidingWindow', pvc.visual.OptionsBase.extend({
  
   //NEW603 C - SLIDING WINDOW OPTIONS 

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

        _defaultSlidingWindowScore: function(datum) { 
            return datum.atoms[this.dimName].value; 
        },

        
        _defaultSlidingWindowSelect: function(allData, remove) {
                       
            var data  = this.chart.data;
                dName = this.dimName;
                dim   = data.owner.dimensions(dName),
                now   = data.dimensions(dName).max().value;

                if(now!=null) now=dim.read(now);
                if(now!=null) now=now.value;

            //debugger;
            allData.forEach(function(datum) {
                var datumScore = this.score(datum);
                if(datumScore!=null) datumScore=dim.read(datumScore);
                if(datumScore!=null) datumScore=datumScore.value;
                    result = now - datumScore; 
                if(!datumScore || result && result > this.interval) 
                    remove.push(datum);
            },this);

        },

        _setColorAxisDefaults: function() {

            this.chart.axesByType.color.forEach(function(axis) {

                var dim = axis.role.grouping.firstDimension;
                var dimName = dim.name;
                var dimOptions = this.chart.options.dimensions;
                if (dimOptions) var dimComp = dimOptions[dimName];
                if(!dimComp) dim.type.setComparer(def.ascending); 
                this._preserveAxisColorMap( axis );


            }, this);

        },

        _preserveAxisColorMap: function( axis ) { axis.setPreserveColorMap(); },

        setRatio: function(){
            // get axes with sliding window dimensions
            var axes = this.chart.axesList.filter(function(axis) {
                var dim = axis.role.grouping.firstDimension;
                return dim == this.dimName;
            },this);
            
            axes.forEach(function(axis) {
                axis.setInitialLength(this.interval);
            },this);

        }

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

