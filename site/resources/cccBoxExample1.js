new pvc.BoxplotChart({
    canvas: 'cccBoxExample1',
    width:  600,
    height: 400,

    // Panels
    title: "Minimal Boxplot Chart",

    // Chart/Interaction
    animate: false
})
.setData(boxplotData_01)
.render();