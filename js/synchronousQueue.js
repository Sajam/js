;(function (global) {
    'use strict';

    var SynchronousQueue = function () {
        var publicScope;

        var tasksQueue = [];
        var results = [];
        var whenFinishedCallback = function () { };

        var busy = false;
        var remaining = 0;
        var current = 0;

        function startExecution() {
            if (!busy) {
                busy = true;

                var taskNumber = current++;
                var task = tasksQueue[taskNumber];
                var args = Array.prototype.slice.call(task, 1);

                args.push(callback(taskNumber));
                task[0].apply(task[0], args);
            }
        }

        function callback(taskNumber) {
            return function (result) {
                results[taskNumber] = result;
                busy = false;
                (--remaining && startExecution()) || whenFinished();
            }
        }

        function whenFinished() {
            whenFinishedCallback.call(whenFinishedCallback, results);
        }

        return publicScope = {
            task: function () {
                tasksQueue.push(arguments) && results.push(undefined) && ++remaining;
                startExecution();

                return publicScope;
            },

            whenFinished: function (fn) {
                whenFinishedCallback = fn;
                !remaining && whenFinished();

                return publicScope;
            }
        };
    };

    if (global.SynchronousQueue === undefined) {
        global.SynchronousQueue = SynchronousQueue;
    }
}(this));