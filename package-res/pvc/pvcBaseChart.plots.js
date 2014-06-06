/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

pvc.BaseChart
.add({
    _initPlots: function() {
        this.plotPanels = null;
        this.plotPanelList = null;
        
        // reset plots
        if(!this.parent) {
            this.plots = {};
            this.plotList = [];
            this.plotsByType = {};
            
            this._createPlotsInternal();
            this._defPlotsExternal();
            if(this._trendable) this._initPlotTrend();
        } else {
            var root = this.root;
            
            this.plots = root.plots;
            this.plotList = root.plotList;
            this.plotsByType = root.plotsByType;
        }
    },
    
    // Any plots enforced by the chart type.
    _createPlotsInternal: function() {
        // NOOP
    },

    _defPlotsExternal: function() {
        var plots = this.options.plots;
        if(plots) plots.forEach(this._defPlotExternal, this);
    },

    _initPlotTrend: function() {
        // Check if at least one plot has the Trend option activated.
        // There's a single plot showing trends for all series
        // of plots marked for trending.
        function plotWantsTrend(plot) {
            return plot.option.isDefined('Trend') && !!plot.option('Trend');
        }

        // NOTE: this only works the first time, which is OK because this should only run once for the root chart.
        if((this._trendable = def.query(this.plotList).any(plotWantsTrend)))
            this._createPlotTrend();
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
            //chart_
            plot_
            content_
            plot2_
            label_
            dotsVisible: true,
            dot_
            plots: [
                {
                    name: 'plot2',
                    type: 'point', // defaults to main plot type
                    
                    valuesVisible: true,
                    
                    // Or, extension points here (detected by indexOf('_') in name?)
                    // EPs of plot's panel marks
                    extensionPoints: {
                        
                    }
                }
            ]
        }
    */
    _defPlotExternal: function(plotDef) {
        var plot, name = plotDef.name, type = plotDef.type;

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

        if(!plot) plot = this._createPlot(name, type, plotDef);

        // Process extension points and publish options
        //  with the plot's most specific prefix (its id: type+index).
        var options = this.options;
        this._processExtensionPointsIn(plotDef, plot.extensionPrefixes[0], function(optValue, optId, optName) {
            // Not an extension point => it's an option
            switch(optName) {
                // Already handled
                case 'dataPart': case 'name': case 'type': break;
                default: options[optId] = optValue; break;
            }
        });
    },

    _createPlot: function(name, type, plotDef) {
        // Default the plot's type to that of the first plot.
        var isFirst = !this.plotList.length;
        if(!type) {
            if(isFirst) throw def.error.argumentInvalid("plots", "First plot requires 'type' option.");
            type = this.plotList[0].type;
        }

        var PlotClass = pvc.visual.Plot.getClass(type);
        if(!PlotClass)
            throw def.error.argumentInvalid("plots", "The plot type '{0}' is not defined.", [type]);

        var optName  = (isFirst || !name || name === 'plot2') ? name : (name + 'Plot'),
            dataPart = plotDef.dataPart != null ? plotDef.dataPart : isFirst ? '0' : '1';

        return new PlotClass(this, {
            name:       name,
            optionName: optName,
            fixed: {
                DataPart: dataPart
            },
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
        var plotsByType = this.plotsByType,
            plots = this.plots,
            type  = plot.type, 
            index = plot.index, 
            name  = plot.name, 
            id    = plot.id;
        
        if(name && def.hasOwn(plots, name))
            throw def.error.operationInvalid("Plot name '{0}' already taken.", [name]);
        
        if(def.hasOwn(plots, id))
            throw def.error.operationInvalid("Plot id '{0}' already taken.", [id]);
        
        var typePlots = def.array.lazy(plotsByType, type);
        if(def.hasOwn(typePlots, index))
            throw def.error.operationInvalid("Plot index '{0}' of type '{1}' already taken.", [index, type]);
        
        plot.globalIndex = this.plotList.length;
        typePlots[index] = plot;
        this.plotList.push(plot);
        plots[id] = plot;
        if(name) plots[name] = plot;

        // First plot has alias "main"
        if(!plot.globalIndex) plots.main = plot;
    },
    
    _collectPlotAxesDataCells: function(plot, dataCellsByAxisTypeThenIndex){
        /* Configure Color Axis Data Cell */
        var dataCells = [];
        
        plot.collectDataCells(dataCells);
        
        if(dataCells.length) {
            def
            .query(dataCells)
            .where(function(dataCell) { return dataCell.role.isBound(); })
            .each (function(dataCell) {
                /* Index DataCell in dataCellsByAxisTypeThenIndex */
                var dataCellsByAxisIndex = 
                    def.array.lazy(dataCellsByAxisTypeThenIndex, dataCell.axisType);
                
                def.array.lazy(dataCellsByAxisIndex, dataCell.axisIndex)
                    .push(dataCell);
            });
        }
    },
    
    // Called by the pvc.PlotPanel class
    _addPlotPanel: function(plotPanel) {
        var plot = plotPanel.plot;
        var plotPanels = def.lazy(this, 'plotPanels');
        
        plotPanels[plot.id] = plotPanel;
        
        var plotName = plot.name;
        if(plotName && !def.getOwn(plotPanels, plotName)) plotPanels[plotName] = plotPanel;
        if(!plot.globalIndex) plotPanels.main = plotPanel;

        def.array.lazy(this, 'plotPanelList').push(plotPanel);
    }
});

