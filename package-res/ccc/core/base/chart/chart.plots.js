/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pvc.BaseChart
.add({
    _initPlots: function() {
        this.plotPanels = {};
        this.plotPanelList = [];
        
        var parent = this.parent;
        if(!parent) {
            this._needsTrendPlot = false;
            this.plots = {};
            this.plotList = [];
            this.plotsByType = {};
            
            this._createPlotsInternal();
            var trendPlotDefExt = this._defPlotsExternal();
            this._initPlotTrend(trendPlotDefExt);
        } else {
            this.plots = parent.plots;
            this.plotList = parent.plotList;
            this.plotsByType = parent.plotsByType;
        }
    },
    
    // Any plots enforced by the chart type.
    _createPlotsInternal: function() {
        // NOOP
    },

    _defPlotsExternal: function() {
        var plots = this.plots, 
            plotDefs = this.options.plots, 
            trendPlotDefExt;

        if(plotDefs) plotDefs.forEach(function(plotDef) {
            if(plotDef) {
                var name = plotDef.name;
                // Defer 'trend' till after it is defined internally
                if(name === 'trend')
                    trendPlotDefExt = plotDef;
                else if(name !== 'plot2' || plots.plot2)
                    this._defPlotExternal(name, plotDef);
            }
        }, this);

        return trendPlotDefExt;
    },

    _initPlotTrend: function(trendPlotDefExt) {
        if(this._needsTrendPlot) {
            this._createPlotTrend();
            if(trendPlotDefExt && this.plots.trend) this._defPlotExternal('trend', trendPlotDefExt);
        }
    },

    /*
        {
            * chart options are available here
            * main plot options are available here
            * main color axis is available here

            * base,ortho,ortho2,...AxisXyzw - cartesian axis
            * [color,]color2...AxisXyzw - color axis
            
            * sample EPs on root context
            base_
                content_

                    [main]plot_  (or barPlot_)
                    //chart_ (@deprecated)
            
                    plot2_
                    plot2Plot_

                    trend_
                    trendPlot_

                    [main]label_
                    [main]dotsVisible: true,
                    [main]dot_
                    [main]bar_

            plots: [
                {
                    name: 'plot2',
                    type: 'point', // defaults to main plot's type
                    valuesVisible: true
                }
            ]
        }
    */
    _defPlotExternal: function(name, plotDef) {
        var plot, type = plotDef.type;

        // Convert names to first lower case.
        // "main" is an alias name for referring to the main plot.
        if(name) {
            name = def.firstLowerCase(name);
            plot = this.plots && this.plots[name];

            // If existing plot, validate plot's type, if specified.
            if(plot && type && type !== plot.type)
                throw def.error.argumentInvalid(
                    "plots",
                    "Plot named '{0}' is already defined and is of a different type: '{1}'",
                    [name, plot.type]);
        }

        var isNew = !plot;
        if(isNew) plot = this._createPlotExternal(name, type, plotDef);

        // Process extension points and publish options with the plot's optionId prefix.
        // Must define options before _addPlot, because it reads option 'Trend'.
        var options = this.options;
        this._processExtensionPointsIn(plotDef, plot.optionId, function(optValue, optId, optName) {
            // Not an extension point => it's an option
            switch(optName) {
                // Already handled
                case 'name': case 'type': break;
                default: options[optId] = optValue; break;
            }
        });

        if(isNew) this._addPlot(plot);
    },

    _createPlotExternal: function(name, type, plotDef) {
        if(!type) throw def.error.argumentInvalid("plots", "Plot 'type' option is required.");
        
        var PlotClass = pvc.visual.Plot.getClass(type);
        if(!PlotClass)
            throw def.error.argumentInvalid("plots", "The plot type '{0}' is not defined.", [type]);

        var isFirst = !this.plotList.length;

        return new PlotClass(this, {
            name:       name,
            isInternal: false,
            defaults: {
                ColorAxis: isFirst ? 1 : 2
            }
        });
    },

    _createPlotTrend: function() {
        // Override with an appropriate Trend plot configuration
    },

    // Called by the pvc.visual.Plot class
    _addPlot: function(plot) {
        var plots = this.plots,
            index = plot.index, 
            name  = plot.name, 
            id    = plot.id;
        
        if(name && def.hasOwn(plots, name))
            throw def.error.operationInvalid("Plot name '{0}' already taken.", [name]);
        
        if(def.hasOwn(plots, id))
            throw def.error.operationInvalid("Plot id '{0}' already taken.", [id]);
        
        var typePlots = def.array.lazy(this.plotsByType, plot.type);
        if(def.hasOwn(typePlots, index))
            throw def.error.operationInvalid("Plot index '{0}' of type '{1}' already taken.", [index, plot.type]);
        
        plot.globalIndex = this.plotList.length;
        
        typePlots[index] = plot;
        
        this.plotList.push(plot);
        
        plots[id] = plot;
        if(name) plots[name] = plot;
        if(!plot.globalIndex) plots.main = plot;

        this._needsTrendPlot = this._needsTrendPlot ||
            (plot.option.isDefined('Trend') && !!plot.option('Trend'));

        plot.onAdded();
    },
    
    _collectPlotAxesDataCells: function(plot, dataCellsByAxisTypeThenIndex) {
        /* Configure Color Axis Data Cell */
        var dataCells = [];
        
        plot.collectDataCells(dataCells);
        
        if(dataCells.length) {
            def
            .query(dataCells)
            .where(function(dataCell) { return dataCell.role.isBound(); })
            .each (function(dataCell) {
                // Index DataCell in dataCellsByAxisTypeThenIndex
                var dataCellsByAxisIndex = 
                    def.array.lazy(dataCellsByAxisTypeThenIndex, dataCell.axisType);
                
                def.array.lazy(dataCellsByAxisIndex, dataCell.axisIndex)
                    .push(dataCell);
            });
        }
    }
});

