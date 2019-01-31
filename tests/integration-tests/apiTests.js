let should = require('should');
let validHeaders = { 'x-zooz-request-id': 'value', 'Content-Type': 'application/json' };
let uuid = require('uuid');
let JSCK = require('jsck');
JSCK.Draft4 = JSCK.draft4;
let artilleryCheck = new JSCK.Draft4(require('artillery/core/lib/schemas/artillery_test_script'));
const testUtils = require('./utils');
const paymentsOsDsl = require('../testExamples/paymentsos-dsl');
describe('System tests for the api', function() {
    let simpleTest;
    let dslName;
    before(async function () {
        await testUtils.init();
        dslName = testUtils.generateUniqueDslName('paymentsos');
        simpleTest = require('../testExamples/Simple_test')(dslName);
        await testUtils.createDslRequests(dslName, paymentsOsDsl.dsl_list);
    });
    describe('Bad requests tests (create test)', function(){
        it('Should return error for non existing dsl name ', function(){
            let requestBody = require('../testExamples/Simple_test')('not exist').test;
            return testUtils.createTest(requestBody, validHeaders)
                .then(function(res){
                    res.statusCode.should.eql(400);
                    res.body.should.eql({ message: 'not exist.createToken: dsl name or dsl definition does not exist.' });
                });
        });
        it('Should return error for invalid action name', function(){
            let requestBody = require('../testExamples/Simple_test')('invalid.invalid').test;
            return testUtils.createTest(requestBody, validHeaders)
                .then(function(res){
                    res.statusCode.should.eql(400);
                    res.body.should.eql({ message: 'action must be this pattern: {dsl_name}.{definition_name}.' });
                });
        });

        let badBodyScenarios = ['Body_with_illegal_artillery', 'Body_with_no_artillery_schema', 'Body_with_no_test_type', 'Body_with_no_description', 'Body_with_no_name', 'Body_with_no_scenarios', 'Body_with_no_step_action',
            'Body_with_no_steps'];

        badBodyScenarios.forEach(function(scenario){
            it('Should return error because ' + scenario, function(){
                let requestBody = require('../testExamples/' + scenario + '.json');
                let expectedResult = require('../testResults/' + scenario + '.json');
                return testUtils.createTest(requestBody, validHeaders)
                    .then(function(res){
                        res.body.should.eql(expectedResult);
                        res.statusCode.should.eql(400);
                    });
            });
        });
    });

    describe('Good request tests', function() {
        it('Should get 404 for for not existing test', function(){
            return testUtils.getTest(uuid.v4(), validHeaders)
                .then(function(res){
                    res.statusCode.should.eql(404);
                    res.body.should.eql({ message: 'Not found' });
                });
        });
        describe('simple test with dsl', function () {
            it('Create test, update test, delete test, get test', async () => {
                let requestBody = simpleTest.test;
                let createTestResponse = await testUtils.createTest(requestBody, validHeaders);
                createTestResponse.statusCode.should.eql(201, JSON.stringify(createTestResponse.body));
                createTestResponse.body.should.have.only.keys('id', 'revision_id');

                let updatedRequestBody = require('../testExamples/Test_with_variables')(dslName);
                let updatedTestResponse = await testUtils.updateTest(updatedRequestBody, validHeaders, createTestResponse.body.id);
                updatedTestResponse.statusCode.should.eql(201, JSON.stringify(updatedTestResponse.body));
                updatedTestResponse.body.should.have.only.keys('id', 'revision_id');

                let getTestResponse = await testUtils.getTest(createTestResponse.body.id, validHeaders);
                let expectedResult = require('../testResults/Test_with_variables')(dslName);
                should(getTestResponse.statusCode).eql(200);
                getTestResponse.body.artillery_test.should.eql(expectedResult);
                getTestResponse.body.should.have.keys('id', 'artillery_test', 'description', 'name', 'revision_id', 'raw_data', 'type', 'updated_at');

                let validatedResponse = validate(getTestResponse.body.artillery_test);
                validatedResponse.errors.length.should.eql(0);
                validatedResponse.valid.should.eql(true);

                let deleteTestResponse = await testUtils.deleteTest(validHeaders, createTestResponse.body.id);
                deleteTestResponse.statusCode.should.eql(200);

                getTestResponse = await testUtils.getTest(createTestResponse.body.id, validHeaders);
                getTestResponse.statusCode.should.eql(404);
            });
        });

        it('Create custom test, update with illegal test, delete test', async () => {
            let requestBody = require('../testExamples/Custom_test.json');
            let createTestResponse = await testUtils.createTest(requestBody, validHeaders);
            createTestResponse.statusCode.should.eql(201);
            createTestResponse.body.should.have.only.keys('id', 'revision_id');

            let updatedRequestBody = require('../testExamples/Body_with_illegal_artillery.json');
            let updatedTestResponse = await testUtils.updateTest(updatedRequestBody, validHeaders, createTestResponse.body.id);
            updatedTestResponse.statusCode.should.eql(400);

            let getTestResponse = await testUtils.getTest(createTestResponse.body.id, validHeaders);
            let expectedResult = require('../testResults/Custom_test.json');
            should(getTestResponse.statusCode).eql(200, JSON.stringify(getTestResponse.body));
            getTestResponse.body.artillery_test.should.eql(expectedResult);

            let deleteTestResponse = await testUtils.deleteTest(validHeaders, createTestResponse.body.id);
            deleteTestResponse.statusCode.should.eql(200);

            getTestResponse = await testUtils.getTest(createTestResponse.body.id, validHeaders);
            getTestResponse.statusCode.should.eql(404);
        });

        it('creates two simple tests, get a specific test, and than get list of all tests', async function(){
            try {
                let requestBody = require('../testExamples/Simple_test')(dslName).test;
                let expectedResult = require('../testResults/Simple_test.json');
                let createTestResponse = await testUtils.createTest(requestBody, validHeaders);
                let createSecondTestResponse = await testUtils.createTest(requestBody, validHeaders);
                createTestResponse.statusCode.should.eql(201, JSON.stringify(createTestResponse.body));
                createSecondTestResponse.statusCode.should.eql(201);
                let getTestResponse = await testUtils.getTest(createTestResponse.body.id, validHeaders);
                let getTestsResponse = await testUtils.getTests(validHeaders);
                let testsIds = [];
                getTestsResponse.body.forEach(test => {
                    test.should.have.keys('id', 'artillery_test', 'description', 'name', 'revision_id', 'raw_data', 'type', 'updated_at');
                });
                testsIds = getTestsResponse.body.map(function(test){
                    return test.id;
                });
                let validatedResponse = validate(getTestResponse.body.artillery_test);

                validatedResponse.errors.length.should.eql(0);
                validatedResponse.valid.should.eql(true);
                getTestResponse.statusCode.should.eql(200);
                getTestsResponse.statusCode.should.eql(200);
                testsIds.should.containEql(createTestResponse.body.id);
                testsIds.should.containEql(createSecondTestResponse.body.id);
                getTestResponse.body.id.should.eql(createTestResponse.body.id);
                getTestResponse.body.revision_id.should.eql(createTestResponse.body.revision_id);
                getTestResponse.body.artillery_test.should.eql(expectedResult);
            } catch (error) {
                return Promise.reject(error);
            }
        });

        describe('Valid json request for creating tests with illegal body (logically)', function() {
            let invalidLogic = ['Test_with_illegal_too_high_weight',
                'Test_with_illegal_too_low_weight', 'Test_with_several_scenarios_and_weights_sum_up_to_less_than_100',
                'Test_with_several_scenarios_and_weights_sum_up_to_more_than_100'];

            invalidLogic.forEach(function(scenario) {
                it(scenario, function(){
                    let requestBody = require('../testExamples/' + scenario + '.js')(dslName);
                    let expectedResult = require('../testResults/' + scenario + '.json');
                    return testUtils.createTest(requestBody, validHeaders)
                        .then(function(res){
                            res.statusCode.should.eql(422, JSON.stringify(res.body));
                            res.body.should.eql(expectedResult);
                        });
                });
            });
        });
    });
});

function validate(script) {
    let validation = artilleryCheck.validate(script);
    return validation;
}
