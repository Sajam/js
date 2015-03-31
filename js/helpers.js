'use strict';

var helpers = (function () {
    var testedTypesMapping = {
        'object': 'Object',
        'function': 'Function',
        'array': 'Array',
        'string': 'String'
    };

    var typeTestFunctionFactory = function (testedType) {
        return function (testedValue) {
            return Object.prototype.toString.call(testedValue) === '[object ' + testedTypesMapping[testedType] + ']';
        };
    };

    return {
        toArray: function (value) {
            return [].slice.call(value);
        },

        isObject: typeTestFunctionFactory('object'),
        isFunction: typeTestFunctionFactory('function'),
        isArray: typeTestFunctionFactory('array'),
        isString: typeTestFunctionFactory('string')
    };
}());