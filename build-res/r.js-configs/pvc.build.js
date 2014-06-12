/*
 * requirejs configuration file used to build the pvc.js file
 */

({
    appDir:   "../../package-res",
    baseUrl:  ".",
    optimize: "uglify2",
    dir:      "../module-scripts",
    paths: {
        'ccc': 'ccc',
        'cdo': 'cdo'
    },
    throwWhen: {
        //If there is an error calling the minifier for some JavaScript,
        //instead of just skipping that file throw an error.
        optimize: true
    },
    // default wrap files, this is externally configured
    wrap: {
        startFile: "..",
        endFile:   ".."
    },

    uglify2: {
        output: {
            beautify: true,
            max_line_len: 1000
        },
        compress: {
            sequences: false,
            global_defs: {
                DEBUG: false
            }
        },
        warnings: true,
        mangle: false
    },

    removeCombined: true,

    preserveLicenseComments: true,

    modules: [
        {
            name: "pvc",
            create: true,
            include: [
                'ccc/core/base/pvc',
                'ccc/core/base/abstract',
                'ccc/core/base/optionsMgr',
                'ccc/core/base/abstract-options',
                'ccc/core/base/abstract-interactive',
                'ccc/core/base/color',
                'ccc/core/base/context',
                'ccc/core/base/text',
                'ccc/core/base/trends',
                'ccc/core/base/scene/scene',
                'ccc/core/base/scene/var',
                'ccc/core/base/visualRole/visualRole',
                'ccc/core/base/visualRole/visualRoleVarHelper',
                'ccc/core/base/dataCell/dataCell',
                'ccc/core/base/dataCell/color-dataCell',
                'ccc/core/base/axis/abstract-axis',
                'ccc/core/base/axis/color-axis',
                'ccc/core/base/axis/size-axis',
                'ccc/core/base/axis/normalized-axis',
                'ccc/core/base/panel/panel/panel',
                'ccc/core/base/plot/plot',
                'ccc/core/base/plot/plot-panel',
                'ccc/core/base/plot/plotBg-panel',
                'ccc/core/base/panel/legend/legend-options',
                'ccc/core/base/panel/legend/legend-panel',
                'ccc/core/base/panel/legend/scene/root-legend-scene',
                'ccc/core/base/panel/legend/scene/group-legend-scene',
                'ccc/core/base/panel/legend/scene/item-legend-scene',
                'ccc/core/base/panel/legend/scene/item-legend-scene.selection',
                'ccc/core/base/panel/legend/scene/item-legend-scene.visibility',
                'ccc/core/base/panel/legend/scene/item-legend-renderer',
                'ccc/core/base/panel/legend/scene/default-item-legend-renderer',
                'ccc/core/base/panel/title/abstract-title-panel',
                'ccc/core/base/panel/title/title-panel',
                'ccc/core/base/panel/dockingGrid-panel',
                'ccc/core/base/chart/chart',
                'ccc/core/base/chart/chart.visualRoles',
                'ccc/core/base/chart/chart.data',
                'ccc/core/base/chart/chart.plots',
                'ccc/core/base/chart/chart.axes',
                'ccc/core/base/chart/chart.panels',
                'ccc/core/base/chart/chart.selection',
                'ccc/core/base/chart/chart.extension',
                'ccc/core/base/multi/multiChart-options',
                'ccc/core/base/multi/multiChart-panel',
                'ccc/core/base/multi/smallChart-options',
                'ccc/core/base/sign/base-sign',
                'ccc/core/base/sign/sign',
                'ccc/core/base/sign/panel-sign',
                'ccc/core/base/sign/label-sign',
                'ccc/core/base/sign/value-label-sign',
                'ccc/core/base/sign/dot-sign',
                'ccc/core/base/sign/dotSizeColor-sign',
                'ccc/core/base/sign/line-sign',
                'ccc/core/base/sign/area-sign',
                'ccc/core/base/sign/bar-sign',
                'ccc/core/base/sign/rule-sign',
                'ccc/core/cartesian/axis/cart-axis',
                'ccc/core/cartesian/axis/root-cart-axis-scene',
                'ccc/core/cartesian/axis/tick-cart-axis-scene',
                'ccc/core/cartesian/axis/abstract-cart-axis-panel',
                'ccc/core/cartesian/axis/cart-axis-title-panel',
                'ccc/core/cartesian/cart-focusWindow',
                'ccc/core/cartesian/ortho-cart-dataCell',
                'ccc/core/cartesian/cart-plot',
                'ccc/core/cartesian/cart-chart',
                'ccc/core/cartesian/cart-dockingGrid-panel',
                'ccc/core/cartesian/cart-panel',
                'ccc/core/categorical/categ-plot',
                'ccc/core/categorical/categ-chart',
                'ccc/core/categorical/categ-panel',
                'cdo/_data',
                'cdo/meta/dimensionType',
                'cdo/meta/complexType',
                'cdo/meta/complexTypeProject',
                'cdo/atom',
                'cdo/complex',
                'cdo/complexView',
                'cdo/datum',
                'cdo/dimension',
                'cdo/data/data',
                'cdo/data/data.selected',
                'cdo/data/data.operations',
                'cdo/data/data.compat',
                'cdo/oper/abstract-oper',
                'cdo/oper/grouping-oper',
                'cdo/oper/groupingSpec',
                'cdo/oper/linear-interp-oper',
                'cdo/oper/linear-interp-seriesState',
                'cdo/oper/zero-interp-oper',
                'cdo/oper/zero-interp-seriesState',
                'cdo/transl/transl',
                'cdo/transl/matrix-transl',
                'cdo/transl/crosstab-transl',
                'cdo/transl/relational-transl',
                'cdo/format/number-formatStyle',
                'cdo/format/number-format',
                'cdo/format/date-format',
                'cdo/format/custom-format',
                'cdo/format/formatProvider',
                'ccc/plugin/abstract-metricxy/plot',
                'ccc/plugin/abstract-metricxy/chart',
                'ccc/plugin/abstract-bar/chart',
                'ccc/plugin/abstract-bar/plot',
                'ccc/plugin/abstract-bar/panel',
                'ccc/plugin/pie/slice-sign',
                'ccc/plugin/pie/plot',
                'ccc/plugin/pie/panel',
                'ccc/plugin/pie/chart',
                'ccc/plugin/bar/plot',
                'ccc/plugin/bar/panel',
                'ccc/plugin/bar/chart',
                'ccc/plugin/nbar/plot',
                'ccc/plugin/nbar/panel',
                'ccc/plugin/nbar/chart',
                'ccc/plugin/water/plot',
                'ccc/plugin/water/group-legend-scene',
                'ccc/plugin/water/panel',
                'ccc/plugin/water/chart',
                'ccc/plugin/point/plot',
                'ccc/plugin/point/panel',
                'ccc/plugin/point/chart',
                'ccc/plugin/scatter/plot',
                'ccc/plugin/scatter/transl',
                'ccc/plugin/scatter/size-axis',
                'ccc/plugin/scatter/panel',
                'ccc/plugin/scatter/chart',
                'ccc/plugin/heatGrid/plot',
                'ccc/plugin/heatGrid/panel',
                'ccc/plugin/heatGrid/chart',
                'ccc/plugin/box/plot',
                'ccc/plugin/box/transl',
                'ccc/plugin/box/panel',
                'ccc/plugin/box/chart',
                'ccc/plugin/treemap/plot',
                'ccc/plugin/treemap/color-axis',
                'ccc/plugin/treemap/transl',
                'ccc/plugin/treemap/panel',
                'ccc/plugin/treemap/chart',
                'ccc/plugin/sunburst/plot',
                'ccc/plugin/sunburst/color-axis',
                'ccc/plugin/sunburst/transl',
                'ccc/plugin/sunburst/panel',
                'ccc/plugin/sunburst/chart',
                'ccc/plugin/sunburst/slice-sign',
                'ccc/plugin/bullet/plot',
                'ccc/plugin/bullet/chart',
                'ccc/plugin/parallel/chart',
                'ccc/plugin/dataTree/chart'
            ]
        }
    ],

    skipModuleInsertion: true
})