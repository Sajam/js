var Chart = function (options) {
  this.passedOptions = options;
  this.options = $.extend(true, {}, Chart.defaultOptions, options);
  this.$container = $(this.options.container);
  this.renderer = new Renderer(this);

  this.render();

  return this;
};

Chart.prototype = {
  render: function () {
    this.renderer.render();

    return this;
  }
};

Chart.defaultOptions = {
  container: undefined,
  width: 300,
  height: 150,
  title: {
    enabled: false,
    text: ''
  },
  styles: {
    box: {
      fill: '#91A3A3',
      'stroke-width': 1,
      stroke: '#000'
    },
    plottingBox: {
      fill: '#fff',
      'stroke-width': 1,
      stroke: '#ddd'
    },
    title: {
      x: 0,
      y: 0,
      'font-size': 12
    }
  },
  renderingSteps: [
    'createSVGRoot',
    'createBox',
    'createTitle',
    'createPlottingBox'
  ]
};


var Renderer = function (chart) {
  this.chart = chart;
  this.plottingBoxContract = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  };
  this.svgRoot = undefined;

  return this;
};

Renderer.prototype = {
  render: function () {
    this.chart.options.renderingSteps.map(function (step) {
      this[step].call(this);
    }, this);

    return this;
  },

  createSVGRoot: function () {
    this.svgRoot = SVG('svg', {
      version: '1.1',
      baseProfile: 'full',
      xmlns: SVG.NS,
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      'xmlns:ev': 'http://www.w3.org/2001/xml-events',
      width: this.chart.options.width,
      height: this.chart.options.height,
      viewBox: [0, 0, this.chart.options.width, this.chart.options.height].join(' ')
    });

    this.chart.$container.append(this.svgRoot.element);

    return this;
  },

  createBox: function () {
    this.svgRoot.append(
      SVG('rect', $.extend({
          width: this.chart.options.width,
          height: this.chart.options.height
        },
        this.chart.options.styles.box
      ))
    );

    return this;
  },

  createTitle: function () {
    if (!this.chart.options.title.enabled) return this;

    var title = SVG('text', $.extend({
        text: this.chart.options.title.text
      },
      this.chart.options.styles.title
    ));

    this.svgRoot.append(title);

    var rect = title.rect();
    this.plottingBoxContract.top += rect.height + rect.y;

    return this;
  },

  createPlottingBox: function () {
    this.svgRoot.append(
      SVG('rect', $.extend({
          x: this.plottingBoxContract.left,
          y: this.plottingBoxContract.top,
          width: this.chart.options.width - (this.plottingBoxContract.left + this.plottingBoxContract.right),
          height: this.chart.options.height - (this.plottingBoxContract.top + this.plottingBoxContract.bottom)
        },
        this.chart.options.styles.plottingBox)
      )
    );

    return this;
  }
};


var SVGElement = function (tagName, attrs) {
  this.tagName = tagName;
  this.element = document.createElementNS(SVG.NS, tagName);
  this.data = {};

  this.attr(attrs);

  return this;
};

SVGElement.prototype = {
  attr: function (a, b) {
    var k;
    var v;

    if (arguments.length === 1) {
      if (Object.prototype.toString.call(a) === '[object Object]') {
        for (k in a) {
          this.attr(k, a[k]);
        }
      } else {
        v = this.element.getAttribute(a);

        if (SVGElement.floatAttributes.indexOf(a) > -1) {
          return parseFloat(v);
        }

        return v;
      }
    } else {
      if (a in SVGElement.customAttributesSetters) {
        SVGElement.customAttributesSetters[a].call(this, b);
      } else {
        this.element.setAttribute(a, b);
      }
    }

    return this;
  },

  getOrSetAttr: function (attributeName, valueIfNull) {
    var attributeValue = this.attr(attributeName);

    if (attributeValue === null && typeof attributeValue === 'object') {
      attributeValue = valueIfNull;
      this.attr(attributeName, attributeValue);
    }

    return attributeValue;
  },

  rect: function (propertyName) {
    var x = this.getOrSetAttr('x', 0);
    var y = this.getOrSetAttr('y', 0);
    var clientRect = this.element.getBoundingClientRect();

    clientRect.x = x;
    clientRect.y = y;

    return arguments.length > 0 ? clientRect[propertyName] : clientRect;
  },

  append: function () {
    var i, length;

    for (i = 0, length = arguments.length; i < length; i += 1) {
      this.element.appendChild(arguments[i].element);
      arguments[i]['afterElementRendered'].call(arguments[i]);
    }

    return this;
  },

  afterElementRendered: function () {
    if (this.tagName in SVGElement.afterElementRenderedCallbacks) {
      SVGElement.afterElementRenderedCallbacks[this.tagName].call(this);
    }

    return this;
  }
};

SVGElement.customAttributesSetters = {
  data: function (data) {
    this.data = data;
  },

  text: function (attributeValue) {
    if (this.tagName === 'tspan') {
      this.element.textContent = attributeValue;
    } else {
      var lines = Object.prototype.toString.call(attributeValue) === '[object String]' ?
        [attributeValue] : attributeValue;

      this.data.tspans = [];

      lines.map(function (line, i) {
        this.data.tspans.push(SVG('tspan', {
          text: line
        }));
      }, this);
    }
  }
};

SVGElement.afterElementRenderedCallbacks = {
  text: function () {
    this.data.tspans.map(function (tspan, i) {
      tspan.attr({
        x: this.attr('x'),
        y: this.attr('y') + (this.attr('font-size') * (i + 1))
      });

      this.append(tspan);
    }, this);
  }
};

SVGElement.floatAttributes = [
  'x',
  'y',
  'width',
  'height',
  'font-size'
];


var SVG = function (tagName, attrs) {
  return new SVGElement(tagName, attrs);
};

SVG.NS = 'http://www.w3.org/2000/svg';
