new pvc.PieChart({
    canvas: 'cccPieExample3',
    width:  600,
    height: 400,

    // Data source
    crosstabMode: false,

    // Main plot
    valuesVisible: true,
    explodedSliceRadius: '5%',
    slice_innerRadiusEx: '20%',

    // Panels
    legend: false,

    // Chart/Interaction
    selectable: true,
    hoverable:  true,
    tooltipClassName: 'light'
})
.setData(relational_03_b)
.render();