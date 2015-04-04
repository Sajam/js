'use strict';

var helpers = (function () {
    var nextIdCounter = 0;

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
        toArray: function toArray(value) {
            return [].slice.call(value);
        },

        nextId: function () {
            return nextIdCounter++;
        },

        runFunction: function (fn, thisContext, argumentsArray) {
            return helpers.isFunction(fn) && fn.apply(thisContext || null, argumentsArray);
        },

        isObject: typeTestFunctionFactory('object'),
        isFunction: typeTestFunctionFactory('function'),
        isArray: typeTestFunctionFactory('array'),
        isString: typeTestFunctionFactory('string')
    };
}());