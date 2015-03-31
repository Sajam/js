'use strict';

Array.prototype.delete = function (index) {
    delete this[index];
    this.splice(index, 1);

    return this;
};

Array.prototype.extend = function (newItems) {
    return this.push.apply(this, newItems);
};