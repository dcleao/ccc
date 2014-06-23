define([
    'ccc/pvc',
    'ccc/def',
    'test/utils',
    'test/data-1'
], function(pvc, def, utils, datas) {

    var cdo = pvc.data;

    var When   = utils.describeTerm("when"),
        Then   = utils.describeTerm("then"),
        After  = utils.describeTerm("after"),
        With   = utils.describeTerm("with"),
        And    = utils.describeTerm("and"),
        The    = utils.describeTerm("the"),
        A      = utils.describeTerm("a"),
        Should = utils.itTerm("should");

    function createVisualRolesContext(roles, roleList, rolesOptions) {
        function context(rn) {
            return def.getOwn(roles, rn);
        }

        context.query = function() {
            return def.query(roleList);
        };

        context.getOptions = function(r) {
            return def.get(rolesOptions, r.prettyId());
        };

        return context;
    }

    function buildVisualRolesContext(visualRolesSpecs, rolesOptions) {
        var roles = {};
        var roleList = visualRolesSpecs.map(function(spec, index) {
            spec = Object.create(spec);
            spec.index = index;

            var r = new pvc.visual.Role(spec.name, spec);
            var prettyId;
            (spec.testNames || [r.name]).forEach(function(testName, index) {
                roles[testName] = r;
                if(!index) prettyId = testName;
            });

            // mock prettyId method, so that it always returns prettyId.
            // In the real implementation, the pretty id depends
            // on the existence of a plot, to return a prefixed value.
            if(prettyId !== r.name) r.prettyId = def.fun.constant(prettyId);

            return r;
        });

        return createVisualRolesContext(roles, roleList, rolesOptions);
    }

    describe("visualRolesBinder -", function() {
        Should("Not throw when constructed", function() {
            var ignored = pvc.visual.rolesBinder();
        });

        describe("begin() -", function() {
            describe("configuration -", function() {
                When("the visual role option isReversed=true", function() {
                    After("calling begin()", function() {
                        The("visual role", function() {
                            Should("have property isReversed=true", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    {name: 'series'}
                                ];
                                var rolesOptions = {series: {isReversed: true}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('series').isReversed).toBe(true);
                            });
                        });
                    });
                });

                When("the visual role option isReversed=false", function() {
                    After("calling begin()", function() {
                        The("visual role", function() {
                            Should("have property isReversed=false", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    {name: 'series'}
                                ];
                                var rolesOptions = {series: {isReversed: false}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('series').isReversed).toBe(false);
                            });
                        });
                    });
                });

                When("the visual role option legendVisible=false", function() {
                    After("calling begin()", function() {
                        The("visual role", function() {
                            Should("have method legendVisible()=false", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [{name: 'series'}];
                                var rolesOptions = {series: {legendVisible: false}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('series').legendVisible()).toBe(false);
                            });
                        });
                    });
                });

                When("the visual role option legendVisible=true", function() {
                    After("calling begin()", function() {
                        The("visual role", function() {
                            Should("have method legendVisible()=true", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [{name: 'series'}];
                                var rolesOptions = {series: {legendVisible: true}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('series').legendVisible()).toBe(true);
                            });
                        });
                    });
                });

                When("the visual role option from=other", function() {
                    And("a visual role with name=other does NOT exist", function() {
                        After("calling begin()", function() {
                            Should("an error be thrown", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [{name: 'series'}];
                                var rolesOptions = {series: {from: 'other'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                expect(function() {
                                    binder.begin();
                                }).toThrow();
                            });
                        });
                    });

                    And("a visual role with name=other exists", function() {
                        After("calling begin()", function() {
                            The("visual role", function() {
                                Should("have property sourceRole=other", function() {
                                    var ctp = new cdo.ComplexTypeProject();

                                    var rolesSpecs = [{name: 'series'}, {name: 'other'}];
                                    var rolesOptions = {series: {from: 'other'}};

                                    var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                    var binder = pvc.visual.rolesBinder()
                                        .complexTypeProject(ctp)
                                        .context(context);

                                    binder.begin();

                                    expect(context('series').sourceRole).toBe(context('other'));
                                });
                            });
                        });
                    });

                    // Precedence of option "from" over "dimensions"
                    And("the visual role option dimensions=dimA", function() {
                        After("calling begin()", function() {
                            The("visual role", function() {

                                Should("have property sourceRole=other and not be pre-bound", function() {
                                    var ctp = new cdo.ComplexTypeProject();

                                    var rolesSpecs = [{name: 'series'}, {name: 'other'}];
                                    var rolesOptions = {series: {from: 'other', dimensions: 'dimA'}};

                                    var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                    var binder = pvc.visual.rolesBinder()
                                        .complexTypeProject(ctp)
                                        .context(context);

                                    binder.begin();

                                    expect(context('series').sourceRole).toBe(context('other'));
                                    expect(context('series').isPreBound()).toBe(false);
                                });
                            });
                        });
                    });
                });

                // Short-syntax for role options, as a string
                When("the visual role option is a string, the name of a dimension", function() {
                    And("a dimension with that name does NOT exist", function() {
                        After("calling begin()", function() {
                            The("visual role", function() {
                                Should("be pre-bound to a grouping containing that single dimension", function() {
                                    var ctp = new cdo.ComplexTypeProject();

                                    var rolesSpecs = [{name: 'series'}];
                                    var rolesOptions = {series: 'dimA'};

                                    var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                    var binder = pvc.visual.rolesBinder()
                                        .complexTypeProject(ctp)
                                        .context(context);

                                    binder.begin();

                                    var seriesRole = context('series');
                                    expect(seriesRole.isPreBound()).toBe(true);
                                    var g = seriesRole.preBoundGrouping();

                                    expect(g.isSingleDimension).toBe(true);
                                    expect(g.lastDimension.name).toBe('dimA');
                                });
                            });
                        });
                    });
                    And("a dimension with that name does exist", function() {
                        After("calling begin()", function() {
                            The("visual role", function() {
                                Should("be pre-bound to a grouping containing that single dimension", function() {
                                    var ctp = new cdo.ComplexTypeProject();
                                    ctp.setDim('dimA');

                                    var rolesSpecs = [{name: 'series'}];
                                    var rolesOptions = {series: 'dimA'};

                                    var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                    var binder = pvc.visual.rolesBinder()
                                        .complexTypeProject(ctp)
                                        .context(context);

                                    binder.begin();

                                    var seriesRole = context('series');
                                    expect(seriesRole.isPreBound()).toBe(true);
                                    var g = seriesRole.preBoundGrouping();

                                    expect(g.isSingleDimension).toBe(true);
                                    expect(g.lastDimension.name).toBe('dimA');
                                });
                            });
                        });
                    });
                });

                When("the visual role option dimensions=dimA", function() {
                    After("calling begin()", function() {
                        The("visual role", function() {
                            Should("be pre-bound to a grouping containing that single dimension", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [{name: 'series'}];
                                var rolesOptions = {series: {dimensions: 'dimA'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                var seriesRole = context('series');
                                expect(seriesRole.isPreBound()).toBe(true);
                                var g = seriesRole.preBoundGrouping();

                                expect(g.isSingleDimension).toBe(true);
                                expect(g.lastDimension.name).toBe('dimA');
                            });
                        });
                    });
                });
            });

            When("a primary role exists, with some name", function() {
                And("a secondary role is not pre-bound or sourced, by configuration", function() {
                    After("calling begin()", function() {
                        The("secondary role", function() {
                            Should("have sourceRole=primary-role", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    // Primary role
                                    {
                                        name: 'series'
                                    },

                                    // Secondary role
                                    {
                                        name: 'series',
                                        testNames: ['foo.series']
                                    }
                                ];

                                var rolesOptions = {};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('foo.series').sourceRole).toBe(context('series'));
                            });
                        });
                    });
                });

                And("a secondary role is pre-bound by configuration", function() {
                    After("calling begin()", function() {
                        The("secondary role", function() {
                            Should("be pre-bound and NOT have sourceRole=primary-role", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    // Primary role
                                    {
                                        name: 'series'
                                    },

                                    // Secondary role
                                    {
                                        name: 'series',
                                        testNames: ['foo.series']
                                    }
                                ];

                                var rolesOptions = {'foo.series': {dimensions: 'dimA'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('foo.series').isPreBound()).toBe(true);
                                expect(context('foo.series').sourceRole).toBe(null);
                            });
                        });
                    });
                });

                And("a secondary role is sourced by configuration", function() {
                    After("calling begin()", function() {
                        The("secondary role", function() {
                            Should("have sourceRole=original-source-role and NOT have sourceRole=primary-role", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    // Primary role
                                    {
                                        name: 'series'
                                    },

                                    // Secondary role
                                    {
                                        name: 'series',
                                        testNames: ['foo.series']
                                    },

                                    {
                                        name: 'bar'
                                    }
                                ];

                                var rolesOptions = {'foo.series': {from: 'bar'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('foo.series').isPreBound()).toBe(false);
                                expect(context('foo.series').sourceRole).toBe(context('bar'));
                            });
                        });
                    });
                });
            });

            When("a pre-bound role, A, is, explicitly or implicitly, the source of another role, B", function() {
                After("calling begin()", function() {
                    The("other role, B", function () {
                        Should("be pre-bound to the same grouping as that of role A", function () {
                            var ctp = new cdo.ComplexTypeProject();

                            var rolesSpecs = [
                                {name: 'A'},
                                {name: 'B'}
                            ];

                            var rolesOptions = {A: {dimensions: 'dimA'}, B: {from: 'A'}};

                            var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                            var binder = pvc.visual.rolesBinder()
                                .complexTypeProject(ctp)
                                .context(context);

                            binder.begin();

                            expect(context('A').isPreBound()).toBe(true);
                            expect(!!context('A').preBoundGrouping()).toBe(true);
                            expect(context('A').preBoundGrouping()).toBe(context('B').preBoundGrouping());
                        });
                    });
                });
            });

            // Multiple sourcing levels does not affect pre-binding propagation.
            When("a pre-bound role, A, is, explicitly or implicitly, the source of another role, B", function() {
                And("in turn, role B is the source role of another role C", function() {
                    After("calling begin()", function () {
                        The("role C", function () {
                            Should("be pre-bound to the same grouping as that of role A", function () {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    {name: 'A'},
                                    {name: 'B'},
                                    {name: 'C'}
                                ];

                                var rolesOptions = {A: {dimensions: 'dimA'}, B: {from: 'A'}, C: {from: 'B'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                expect(context('A').preBoundGrouping()).toBe(context('B').preBoundGrouping());
                                expect(context('B').preBoundGrouping()).toBe(context('C').preBoundGrouping());
                            });
                        });
                    });
                });
            });

            // Cyclic source role
            When("a role A is the source of role B", function() {
                And("role B is the source of role C", function() {
                    And("role C is the source of role A", function() {
                        After("calling begin()", function () {
                            A("error", function () {
                                Should("be thrown", function () {
                                    var ctp = new cdo.ComplexTypeProject();

                                    var rolesSpecs = [
                                        {name: 'A'},
                                        {name: 'B'},
                                        {name: 'C'}
                                    ];

                                    var rolesOptions = {A: {from: 'C'}, B: {from: 'A'}, C: {from: 'B'}};

                                    var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                    var binder = pvc.visual.rolesBinder()
                                        .complexTypeProject(ctp)
                                        .context(context);

                                    expect(function() {
                                        binder.begin();
                                    }).toThrow();
                                });
                            });
                        });
                    });
                });
            });

            // Dimensions receive defaults from the single role that is bound to them.
            When("a role has a non-empty dimensionDefaults property", function() {
                And("it is the only role that is explicitly or implicitly pre-bound to certain dimensions", function() {
                    After("calling begin()", function() {
                        The("bound to dimensions' properties", function() {
                            Should("have been defaulted with the visual role's dimensionDefaults", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    {name: 'A', dimensionDefaults: {valueType: Number}}
                                ];

                                var rolesOptions = {A: {dimensions: 'dimA'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                var dimInfo = ctp._dims['dimA'];
                                expect(!!dimInfo).toBe(true);
                                expect(dimInfo.spec.valueType).toBe(Number);
                            });
                        });
                    });
                });
                And("it is NOT the only role that is explicitly or implicitly pre-bound to certain dimensions", function() {
                    After("calling begin()", function() {
                        The("bound to dimensions' properties", function() {
                            Should("have NOT been defaulted with any of the visual roles' dimensionDefaults", function() {
                                var ctp = new cdo.ComplexTypeProject();

                                var rolesSpecs = [
                                    {name: 'A', dimensionDefaults: {valueType: Number }},
                                    {name: 'B', dimensionDefaults: {valueType: Boolean}}
                                ];

                                var rolesOptions = {A: {dimensions: 'dimA'}, B: {dimensions: 'dimA'}};

                                var context = buildVisualRolesContext(rolesSpecs, rolesOptions);

                                var binder = pvc.visual.rolesBinder()
                                    .complexTypeProject(ctp)
                                    .context(context);

                                binder.begin();

                                var dimInfo = ctp._dims['dimA'];
                                if(dimInfo) expect(dimInfo.spec.valueType).toBeUndefined();
                            });
                        });
                    });
                });
            });
        });
    });
});