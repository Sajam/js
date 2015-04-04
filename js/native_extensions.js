'use strict';

Array.prototype.delete = function (index) {
    delete this[index];
    this.splice(index, 1);

    return this;
};

Array.prototype.extend = function (newItems) {
    if (helpers.isArray(newItems)) {
        this.push.apply(this, newItems);
    }

    return this;
};

Array.prototype.lastItemThat = function (condition) {
    return this.filter(condition).last();
};

Array.prototype.last = function () {
    return (this.length && this[this.length - 1]) || false;
};