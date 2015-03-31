'use strict';

var modal = (function () {
    // Public items that are exposed for end-users
    var publicScope = {};

    // Internal settings
    var coreSettings = {
        nodesContainerSelector: 'body',
        closeButton: '&times;',
        visibleDisplay: 'inline',
        'class': {
            root: 'modal',
            container: 'modal-container',
            content: 'modal-content',
            titleBar: 'modal-title-bar',
            title: 'modal-title',
            close: 'modal-close',
            closeText: 'modal-close-text',
            closeButton: 'modal-close-button'
        }
    };

    // ModalManager instance
    var manager;

    // Backdrop instance
    var backdrop;

    var types = {
        'default': {
            aliases: ['open', 'basic', 'plain', 'simple']
        },

        alert: {
            extraArguments: [
                ['content', '(blank)']
            ],

            render: function () {
                this.$content.html(this.options.content);

                return this;
            }
        }
    };

    var ModalManager = function () {
        this.instances = [];

        return this.init();
    };

    ModalManager.prototype.init = function () {
        // Allow end-user to open required modal type directly, eg.: modal.alert(arguments)
        Object.keys(types).map(function (type) {
            this.exposeType(type);
        }, this);

        return this;
    };

    ModalManager.prototype.exposeType = function (type) {
        var typeObject = types[type];
        var namesToExpose = [type];

        if ('aliases' in typeObject) {
            namesToExpose.extend(typeObject.aliases);
        }

        namesToExpose.map(function (exposedName) {
            publicScope[exposedName] = this.modalFactory.bind(publicScope, type);
        }, this);

        return this;
    };

    ModalManager.prototype.modalFactory = function (type) {
        var args = helpers.toArray(arguments).slice(1);
        var options = {};
        var typeArgs = [];
        var i, length, typeObject, instance;

        // Search for first object argument and treat it as options.
        for (i = 0, length = args.length; i < length; i += 1) {
            if (helpers.isObject(args[i])) {
                options = args[i];
                args.delete(i);
                break;
            }
        }

        options.type = options.type || type;

        if (!(options.type in types)) {
            throw 'Modal type "' + options.type + '" not is not defined.';
        }

        typeObject = types[type];

        typeArgs.extend([null, options]);
        typeArgs.extend(args);

        if ('extraArguments' in typeObject) {
            typeObject.extraArguments.map(function (typeArgument, index) {
                options[typeArgument[0]] = args.length >= index + 1 ? args[index] : typeArgument[1];
            });
        }

        instance = this.instances[
            this.instances.push(new (Modal.bind.apply(Modal, typeArgs))()) - 1
        ];

        backdrop.updateState();

        return instance;
    };

    ModalManager.prototype.closeModal = function (index) {
        var _this = this;

        this.instances[index].remove(function () {
            _this.instances.delete(index);
            backdrop.updateState();
        });
    };

    ModalManager.prototype.getCurrentModalIndex = function () {
        if (this.instances.length) {
            return this.instances.length - 1;
        }
    };

    ModalManager.prototype.getCurrentModal = function () {
        var currentModalIndex = this.getCurrentModalIndex();

        if (currentModalIndex !== undefined) {
            return this.instances[currentModalIndex];
        }
    };

    ModalManager.prototype.closeCurrentModal = function () {
        var index = this.getCurrentModalIndex();

        if (index !== undefined) {
            if (this.instances[index].options.escapeKeyCloses) {
                this.closeModal(this.instances.length - 1);
            }
        }
    };

    var Backdrop = function () {
        this.$node = undefined;

        return this.init();
    };

    Backdrop.prototype.init = function () {
        return this.createNode();
    };

    Backdrop.prototype.createNode = function () {
        this.$node = $('<div>', {'class': 'modal-backdrop'})
            .appendTo($(coreSettings.nodesContainerSelector));

        return this;
    };

    Backdrop.prototype.updateState = function () {
        var currentModal = manager.getCurrentModal();

        if (!manager.instances.length || (currentModal && !currentModal.options.backdrop)) {
            return this.toggle(false);
        }

        return this.toggle(true);
    };

    Backdrop.prototype.toggle = function (show) {
        if (show) {
            this.$node.show();
        } else {
            this.$node.fadeOut(200);
        }

        return this;
    };

    var Modal = function (options) {
        this.options = $.extend(true, {
            // string - Additional class name for modal's main DOM node.
            'class': '',

            // boolean - Should modal show immediately after creation?
            show: true,

            // boolean - Enable or disable animations.
            animate: true,

            // boolean - Should modal have backdrop (darker background).
            backdrop: true,

            // boolean - Should user be able to close modal using escape (esc) keyboard's key?
            escapeKeyCloses: true,

            // boolean - Should user be able to close modal by clicking outside modal?
            outsideClickCloses: true,

            // boolean - Should display close button (X symbol)?
            closeButton: true,

            // string - If not empty displays text, usually next to the close button if enabled.
            closeText: 'Close',

            // string - If not empty displays modal's title in top (usually) title bar.
            title: 'Message',

            /**
             * string or two-dimensional array - indicates modal's position.
             *
             * Allowed string values:
             *   - center
             *   - top
             *   - right
             *   - bottom
             *   - left
             *
             * Possible valid combinations/values:
             *     a b - horizontal & vertical position, order of axes is irrelevant,
             *           if both are from the same axis one of position will be changed to "center"
             *     a - single position, second will be "center"
             *     [left, top] - offset from (0, 0) using some units of length
             *
             * Examples:
             *     center - alias for "center center" - modal in the middle of page
             *     right - alias for "right center" - modal on the right side and vertically centered
             *     left right - modal on the right side and vertically centered (due to axes conflict)
             *     [10, 20] - 10 pixels offset from left and 20 pixels offset from top
             *     ['10%', '20%'] - as above but using percents
             */
            position: 'center',

            // string or number - Modal's dimensions. Can take any valid unit of length or "auto".
            width: 'auto',
            height: 'auto'
        }, options);

        // Contains reference to type-specific functions & properties.
        this.type = types[this.options.type];

        /**
         * Modal's DOM nodes that is following DOM Structure (if no closeButton, closeText or title):
         *
         * div.$root
         *     div.$container (plus class name from options if any)
         *         div.$content
         */
        this.$root = undefined;
        this.$container = undefined;
        this.$content = undefined;
        this.$close = undefined;

        return this.init();
    };

    Modal.prototype.init = function () {
        this.createBasicDOMStructure()
            .renderBasicElements()
            .renderContent()
            .attachEvents()
            .show()
            .resize()
            .reposition()
            .toggle(this.options.show);

        if (this.options.show) {
            this.animate(true);
        }

        return this;
    };

    Modal.prototype.createBasicDOMStructure = function () {
        this.$root = $('<div>', {'class': coreSettings.class.root})
            .data('modal', this)
            .appendTo(coreSettings.nodesContainerSelector)
            .append(
                this.$container = $('<div>', {'class': coreSettings.class.container + this.options.class}).append(
                    this.$content = $('<div>', {'class': coreSettings.class.content})
                )
            );

        return this;
    };

    Modal.prototype.renderBasicElements = function () {
        this.$container.prepend(
            this.options.closeText || this.options.closeButton || this.options.title ?
                $('<div>', {'class': coreSettings.class.titleBar}).append(
                    this.options.title ?
                        $('<p>', {
                            'class': coreSettings.class.title,
                            html: this.options.title
                        }) : undefined,

                    this.options.closeText || this.options.closeButton ?
                        this.$close = $('<div>', {'class': coreSettings.class.close}).append(
                            this.options.closeText ?
                                $('<div>', {
                                    'class': coreSettings.class.closeText,
                                    html: this.options.closeText
                                }) : undefined,

                            this.options.closeButton ?
                                $('<button>', {
                                    'class': coreSettings.class.closeButton,
                                    html: coreSettings.closeButton
                                }) : undefined
                        ) : undefined
                ) : undefined
        );

        return this;
    };

    Modal.prototype.renderContent = function () {
        return this.callTypeFunction('render');
    };

    Modal.prototype.attachEvents = function () {
        var _this = this;

        // Reposition on window resize.
        $(window).on('resize', this.reposition.bind(this));

        // Close.
        this.$close.on('click', function () {
            manager.closeModal(manager.instances.indexOf(_this));
        });

        return this;
    };

    Modal.prototype.resize = function () {
        this.$container.css({
            width: this.options.width,
            height: this.options.height
        });

        return this;
    };

    Modal.prototype.reposition = function () {
        var position = this.options.position;
        var xyOffset = helpers.isArray(position);

        if (xyOffset && position.length === 2) {
            this.$root.css({
                top: position[0],
                left: position[1]
            });
        } else if (helpers.isString(position)) {
            position = position.trim().split(' ');

            var x = position[0];
            var y = position.length > 1 && helpers.isString(position[1]) ? position[1] : 'center';
            var width = this.$container.outerWidth();
            var height = this.$container.outerHeight();
            var result = {};

            // If the same values or values are from the same axis centering horizontally.
            if ((x !== 'center' && x === y) ||
                (['left', 'right'].indexOf(x) > -1 && ['left', 'right'].indexOf(y) > -1) ||
                (['top', 'bottom'].indexOf(x) > -1 && ['top', 'bottom'].indexOf(y) > -1)) {
                x = 'center';
            }

            // Vertical position on horizontal axis - swapping.
            if (['top', 'bottom'].indexOf(x) > -1) {
                position = x;
                x = y, y = position;
            }

            result[(x === 'center') ? 'left' : x] =
                (x === 'center' ? ($(window).width() - width) / 2 : 0);

            result[(y === 'center') ? 'top' : y] =
                (y === 'center' ? ($(window).height() - height) / 2 : 0);

            this.$root.css(result);
        }

        return this;
    };

    Modal.prototype.animate = function (show, callback) {
        var _this = this;
        var executeCallback = function () {
            if (helpers.isFunction(callback)) {
                callback.call(_this);
            }

            return _this.toggle(show);
        };

        if (this.options.animate) {
            var height = this.$root.outerHeight();
            var top = this.$root.offset().top;

            this.$root.css('top', show ? -height : top).animate({
                top: show ? top : -height
            }, show ? 300 : 100, executeCallback);

            return this;
        }

        return executeCallback();
    };

    Modal.prototype.toggle = function (show) {
        this.$root.css('display', show ? coreSettings.visibleDisplay : 'none');

        return this;
    };

    Modal.prototype.show = function () {
        return this.toggle(true);
    };

    Modal.prototype.hide = function () {
        return this.toggle(false);
    };

    Modal.prototype.callTypeFunction = function (functionName) {
        if (functionName in this.type) {
            return this.type[functionName].apply(this, helpers.toArray(arguments).slice(1));
        }

        return this;
    };

    Modal.prototype.remove = function (callback) {
        var _this = this;

        return this.animate(false, function () {
            _this.$root.remove();
            callback.call(_this);
        });
    };

    $(function () {
        manager = new ModalManager();
        backdrop = new Backdrop();

        // Escape key close.
        $(document).on('keyup', function (e) {
            if (e.keyCode === 27) {
                var currentModal = manager.getCurrentModal();

                if (currentModal && currentModal.options.escapeKeyCloses) {
                    manager.closeCurrentModal();
                }
            }
        });

        // Outside click close.
        $(document).on('click', function (e) {
            var $clicked = $(e.target);

            if (!$clicked.hasClass('modal') && !$clicked.closest('.modal').length) {
                var currentModal = manager.getCurrentModal();

                if (currentModal && currentModal.options.outsideClickCloses) {
                    manager.closeCurrentModal();
                }
            }
        });

        publicScope.instances = manager.instances;
    });

    publicScope.test = function () {
        console.log('Modals test.');

        console.log('modal.open()');
        modal.open();

        console.log('modal.alert()');
        modal.alert();

        console.log('modal.alert(\'Hello!<br>This is just a modal.alert(\'message\')!\')');
        modal.alert('Hello!<br>This is just a modal.alert(\'message\')!', {backdrop: false});

        //console.log('modal.open({type: \'not_existing\'})');
        //modal.open({type: 'not_existing'});
    };

    return publicScope;
}());