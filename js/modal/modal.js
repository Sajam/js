;(function (global) {
    'use strict';

    // Internal settings.
    var coreSettings = {
        zIndexStart: 100,

        // Query selector of DOM's node that will be used as parent for inserted nodes.
        nodesContainerSelector: 'body',

        // Available animations (name of show/hide functions).
        animations: {
            'fade': ['fadeIn', 'fadeOut'],
            'slide': ['slideDown', 'slideUp']
        },

        'class': {
            backdrop: 'modal-backdrop',
            root: 'modal',
            container: 'modal-container',
            content: 'modal-content',
            titleBar: 'modal-title-bar',
            title: 'modal-title',
            close: 'modal-close',
            closeText: 'modal-close-text',
            closeButton: 'modal-close-button',
            buttons: 'modal-buttons',
            button: 'modal-button',
            buttonDefault: 'modal-button-default',
            buttonCancel: 'modal-button-cancel',
            buttonNo: 'modal-button-no',
            buttonYes: 'modal-button-yes',
            buttonSubmit: 'modal-button-submit',
            buttonOk: 'modal-button-ok',
            field: 'modal-field'
        }
    };

    var CLOSE_INITIALIZER_CLOSE_BUTTON = 1,
        CLOSE_INITIALIZER_ESC = 2,
        CLOSE_INITIALIZER_OUTSIDE_CLICK = 3;

    var SKIP_REPOSITIONING = 1;

    // -----------------------------------------------------------------------------------------------------------------

    // Public API that will be available for the end-users.
    var publicScope = {};

    // ModalManager instance.
    var manager;

    // Backdrop instance.
    var backdrop;

    // ModalButtons instance.
    var modalButton;

    // -----------------------------------------------------------------------------------------------------------------

    var ModalTypes = {
        'default': {
            aliases: ['open', 'basic', 'plain', 'simple'],

            render: function () {
                this.$content.html(this.options.content);
            }
        },

        alert: {
            options: {
                backdrop: true,
                title: '',
                closeButton: false,
                closeText: ''
            },

            extraArguments: [
                ['content', '(blank)']
            ],

            render: function () {
                this.$content.html(this.options.content);
            }
        },

        confirm: {
            options: {
                title: 'Confirmation',
                buttons: ['cancel', 'no', 'yes']
            },

            extraArguments: [
                ['content', 'Are you sure want to proceed?']
            ],

            render: function () {
                this.$content.html(this.options.content);
            }
        },

        prompt: {
            options: {
                buttons: {
                    'cancel': {},
                    'submit': {
                        value: function () {
                            return this.modal.$content.find('input').first().val();
                        }
                    }
                }
            },

            extraArguments: [
                ['content', 'Please enter value'],
                ['value', '']
            ],

            render: function () {
                this.$content.append(
                    $('<div>', {'class': coreSettings.class.field}).append(
                        $('<label>', {html: this.options.content}),
                        $('<input>', {
                            type: 'text',
                            value: this.options.value
                        })
                    )
                );
            }
        }
    };

    // -----------------------------------------------------------------------------------------------------------------

    var ModalManager = function () {
        this.instances = [];

        return this.init();
    };

    ModalManager.prototype.init = function () {
        this.prepareModalTypes()
            .attachEvents();

        return this;
    };

    ModalManager.prototype.prepareModalTypes = function () {
        Object.keys(ModalTypes).map(function (type) {
            this.exposeType(type);
        }, this);

        return this;
    };

    // Event-listeners that are common for all modals instances.
    ModalManager.prototype.attachEvents = function () {
        var _this = this;
        var instance;

        // ESC key pressed - try to close current modal.
        $(document).on('keyup', function (e) {
            if (e.keyCode === 27) {
                if (instance = _this.currentModal()) {
                    instance.close(CLOSE_INITIALIZER_ESC);
                }
            }
        });

        // Clicked outside modal's area - try to close current modal.
        $(document).on('click', function (e) {
            var $clicked = $(e.target);

            if (!$clicked.hasClass(coreSettings.class.root) &&
                !$clicked.closest('.' + coreSettings.class.root).length) {
                if (instance = _this.currentModal()) {
                    instance.close(CLOSE_INITIALIZER_OUTSIDE_CLICK);
                }
            }
        });

        // Browser window resize - reposition modals.
        $(window).on('resize', function () {
            _this.instances.forEach(function (instance) {
                instance.visible && instance.reposition();
            });
        });

        // @TODO: Ugly, tricky way to deal with backdrop animations lag - need to do it in some other way.
        setTimeout(function () {
            backdrop.update();
        }, 2000);

        return this;
    };

    // Expose modal type to publicScope, by creating keys named with main type name and it's aliases.
    ModalManager.prototype.exposeType = function (type) {
        [type].extend(ModalTypes[type].aliases).map(function (exposedName) {
            publicScope[exposedName] = this.modalFactory.bind(publicScope, type);
        }, this);

        return this;
    };

    ModalManager.prototype.modalFactory = function (type) {
        var args = $.makeArray(arguments).slice(1);
        var modalTypeObject = ModalTypes[type];

        /**
         * Making deep copy of collected options. Options overrides in order:
         *     - default, basic options (not here - later in Modal() constructor)
         *     - type-default options
         *     - user-specified options
         *     - type's extraArguments (if any)
         */
        var options = $.extend.apply({}, [
                true, 'options' in modalTypeObject && modalTypeObject.options
            ].concat(args.filter(function (arg) {
                return $.isPlainObject(arg);
            }))
        );

        options.type = options.type || type;

        // Inserting type's extraArguments to options object.
        'extraArguments' in modalTypeObject && modalTypeObject.extraArguments.map(function (typeArgument, index) {
            options[typeArgument[0]] = args.length >= index + 1 && args[index] ? args[index] : typeArgument[1];
        });

        return new (Modal.bind.apply(Modal, [null, options].extend(args)))();
    };

    ModalManager.prototype.closeModal = function (modal) {
        return this.instances.delete(this.instances.indexOf(modal)) && this;
    };

    ModalManager.prototype.currentModal = function () {
        return this.instances.lastItemThat(function (x) { return x.visible; });
    };

    // -----------------------------------------------------------------------------------------------------------------

    var Backdrop = function () {
        this.$node = undefined;
        this.visible = undefined;

        return this.init();
    };

    Backdrop.prototype.init = function () {
        this.createNode()
            .update();

        return this;
    };

    Backdrop.prototype.createNode = function () {
        this.$node = $('<div>', {'class': coreSettings.class.backdrop})
            .appendTo(coreSettings.nodesContainerSelector);

        return this;
    };

    Backdrop.prototype.update = function (callback) {
        var currentModal = manager.currentModal();

        var after = function (show) {
            this.visible = show;

            if ($.isFunction(callback)) {
                callback.call(callback);
            }

            return this;
        };

        var toggle = function (show) {
            this.$node.css('z-index', currentModal ? currentModal.zIndex() - 1 : coreSettings.zIndexStart - 1);

            if (show === this.visible) {
                after.call(this, show);
            } else {
                if (currentModal) {
                    currentModal.toggleBackdrop(show, this.$node, after.bind(this, show));
                } else {
                    this.$node.toggle(show);
                    after.call(this, show);
                }
            }

            return this;
        };

        if (currentModal) {
            toggle.call(this, currentModal.options.backdrop);
        } else {
            toggle.call(this, false);
        }

        return this;
    };

    // -----------------------------------------------------------------------------------------------------------------

    var ModalButton = function () {
        this.buttons = {
            'default': {
                // will be populated with default data
            },
            cancel: {
                'class': coreSettings.class.buttonCancel,
                position: 0,
                text: 'Cancel',
                value: null
            },
            no: {
                'class': coreSettings.class.buttonNo,
                position: 1,
                text: 'No',
                value: false
            },
            yes: {
                'class': coreSettings.class.buttonYes,
                position: 2,
                text: 'Yes',
                value: true
            },
            submit: {
                aliases: ['send', 'post'],
                'class': coreSettings.class.buttonSubmit,
                position: 3,
                text: 'Submit',
                value: function () {
                    return this.modal.$content.find('form').first().elements;
                }
            },
            ok: {
                'class': coreSettings.class.buttonOk,
                position: 4,
                text: 'OK',
                value: true
            }
        };

        return this.init();
    };

    ModalButton.prototype.init = function () {
        this.makeButtonsObjects();

        return this;
    };

    ModalButton.prototype.makeButtonsObjects = function () {
        Object.keys(this.buttons).map(function (buttonType) {
            this.makeButtonType(buttonType, this.buttons[buttonType]);
        }, this);

        return this;
    };

    ModalButton.prototype.makeButtonType = function (type, options) {
        [type].extend('aliases' in options && options.aliases).map(function (type) {
            this.buttons[type] = this.buttonTypeFactory(options);
        }, this);

        return this;
    };

    ModalButton.prototype.buttonTypeFactory = function (typeOptions) {
        var constructor = function (typeOptions, options, modal) {
            this.options = $.extend(true, {}, {
                type: 'default',
                aliases: [],
                'class': coreSettings.class.buttonDefault,
                position: 0,
                text: 'Button',
                value: null,
                render: undefined
            }, typeOptions, options);
            this.modal = modal;
            this.$button = undefined;

            this.init = function () {
                this.render()
                    .attachEvents();

                return this;
            };

            this.render = function () {
                if (helpers.isFunction(this.options.render)) {
                    return this.options.render.call(this);
                }

                this.$button = $('<button>', {
                    'class': coreSettings.class.button,
                    html: this.options.text
                }).addClass(this.options.class);

                return this;
            };

            this.attachEvents = function () {
                var _this = this;

                this.$button && this.$button.on('click', function () {
                    _this.modal.callbackResult = helpers.isFunction(_this.options.value) ?
                        _this.options.value.call(_this) : _this.options.value;

                    return _this.modal.close();
                });
            };

            return this.init();
        };

        return constructor.bind(this, typeOptions);
    };

    ModalButton.prototype.create = function (type, options, modal) {
        return new this.buttons[type in this.buttons ? type : 'default'](options, modal);
    };

    // -----------------------------------------------------------------------------------------------------------------

    var Modal = function (options) {
        this.id = helpers.nextId();

        this.options = $.extend(true, {
            // string - Additional class name for main visible content modal's DOM node.
            'class': '',

            // bool - show (true) or hide (false) modal immediately after creation.
            show: true,

            // bool - enable (true) or disable (false) modal's in/out animations.
            animate: true,

            // bool - show (true) or not (false) backdrop (dark page overlay).
            backdrop: true,

            // bool/string - backdrop's show/hide animations, set false to disable or animation name.
            backdropAnimation: 'fade',

            // integer - backdrop's show/hide animation duration (ms).
            backdropAnimationDuration: 1000,

            // bool - allow (true) or prevent (false) to close modal using "ESC" key.
            escapeKeyCloses: true,

            // bool - allow (true) or prevent (false) to close modal by clicking anywhere outside modal.
            outsideClickCloses: true,

            // bool - show (true) or not (false) close button.
            closeButton: true,

            // string - HTML that will appear on close button (if it's enabled).
            closeButtonContent: '&times;',

            // string - if not empty ('') displays close text; next to the close button (usually).
            closeText: 'Close',

            // string - if not empty string displays modal's title in top (usually) title bar.
            title: '',

            /**
             * string/array of 2 items - set modal's position.
             *
             * Positions values:
             *   - center
             *   - top
             *   - right
             *   - bottom
             *   - left
             *
             * This option can accept one of following formats:
             *     a b - horizontal & vertical position, order of axes is irrelevant,
             *           if both are from the same axis - one of positions will be changed to "center"
             *     a - horizontal or vertical position, second axis value will be "center"
             *     [left, top] - offset from (x=0, y=0) using some valid units of length
             *
             * Examples:
             *     center - alias for "center center" - modal in the middle of page
             *     right - alias for "right center" - modal on the right side and vertically centered
             *     left right - modal on the right side and vertically centered (due to axes conflict)
             *     [10, 20] - 10 pixels offset from left and 20 pixels offset from top
             *     ['10%', '20%'] - as above but using percents
             */
            position: 'center',

            // string/length unit - modal's dimensions, can take any valid unit of length or "auto".
            width: 'auto',
            height: 'auto',

            /**
             * Array or object of buttons.
             *
             * Examples:
             *     ['cancel', 'ok'] - default buttons configuration options
             *
             *     {
             *         ok: {
             *             text: 'Ya, rly!'
             *         },                       - override default configuration options
             *         cancel: {
             *             text: 'No wai!'
             *         }
             *     }
             */
            buttons: ['ok'],

            // Function to execute after closing modal (returned value is passed as a first argument).
            callback: function (result) { }
        }, options);

        // Contains reference to type-specific modal's functions & properties.
        this.type = ModalTypes[this.options.type];

        /**
         * Modal's DOM nodes representing following DOM Structure
         * (classes variable names are in parentheses):
         *
         * div (root)
         *     div (container - takes class name from options if any)
         *         div (titleBar if one of: title, closeText, closeButton is enabled)
         *             p (title)
         *             div (close - if one of: closeText, closeButton is enabled)
         *                 div (closeText)
         *                 button (closeButton)
         *         div (content)
         *         div (buttons)
         */
        this.$root = undefined;
        this.$container = undefined;
        this.$content = undefined;
        this.$close = undefined;

        this.buttons = [];

        // Modal's visibility state. Is modal displayed or not (hidden)?
        this.visible = undefined;

        // Result to pass to callback function when closing modal.
        this.callbackResult = null;

        return this.init();
    };

    Modal.prototype.init = function () {
        manager.instances.push(this);

        this.createBasicDOMStructure()
            .createTopTitleBar()
            .createButtons()
            .createContent()
            .resize()
            .reposition()
            .toggle(this.options.show, null, SKIP_REPOSITIONING)
            .attachEvents();

        return this;
    };

    // $root, $container, $content
    Modal.prototype.createBasicDOMStructure = function () {
        this.$root = $('<div>', {'class': coreSettings.class.root})
            .append(
                this.$container = $('<div>', {'class': coreSettings.class.container + this.options.class}).append(
                    this.$content = $('<div>', {'class': coreSettings.class.content})
                )
            )
            .css('z-index', this.zIndex())
            .data('modal', this)
            .appendTo(coreSettings.nodesContainerSelector);

        return this;
    };

    Modal.prototype.createTopTitleBar = function () {
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
                                    html: this.options.closeButtonContent
                                }) : undefined
                        ) : undefined
                ) : undefined
        );

        return this;
    };

    Modal.prototype.createButtons = function () {
        var buttons = $.isArray(this.options.buttons) ?
            this.options.buttons.map(function (buttonType) {
                return modalButton.create(buttonType, null, this);
            }, this) :
            Object.keys(this.options.buttons).map(function (buttonType) {
                return modalButton.create(buttonType, this.options.buttons[buttonType], this);
            }, this);

        this.$container.append(
            $('<div>', {'class': coreSettings.class.buttons}).append(
                buttons.sort(function (a, b) {
                    return a.options.position - b.options.position;
                }).map(function (button) {
                    return button.$button;
                })
            )
        );

        return this;
    };

    Modal.prototype.createContent = function () {
        return this._callTypeSpecificFunction('render');
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

        if (helpers.isArray(position) && position.length === 2) {
            this.$root.css({
                top: position[0],
                left: position[1]
            });
        } else if (helpers.isString(position)) {
            position = position.trim().split(' ');

            var x = position[0];
            var y = position.length > 1 && helpers.isString(position[1]) ? position[1] : 'center';
            var width = this.$root.outerWidth();
            var height = this.$root.outerHeight();
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

    Modal.prototype.toggle = function (show, callback, skipRepositioning) {
        var finish = function () {
            this._display(show);
            this.visible = show;
            backdrop.update(callback);
        };

        // Before show dialogue reposition it (position may changed after eg. resizing browser's window).
        show && !skipRepositioning && this._withVisible(this.reposition);

        if (this.options.animate) {
            // Top offset can be only obtained if element is visible.
            show && this._display(true);

            var height = this.$root.outerHeight();
            var top = this.$root.offset().top;

            this.$root.css('top', show ? -height : top).animate({
                top: show ? top : -height
            }, show ? 400 : 200, finish.bind(this));
        } else {
            finish.call(this);
        }

        return this;
    };

    Modal.prototype.attachEvents = function () {
        this.$close && this.$close.on('click', this.close.bind(this, CLOSE_INITIALIZER_CLOSE_BUTTON));

        return this;
    };

    Modal.prototype.zIndex = function () {
        return coreSettings.zIndexStart + (this.id * 2);
    };

    Modal.prototype.toggleBackdrop = function (show, $backdrop, callback) {
        if (this.options.backdropAnimation) {
            $backdrop[coreSettings.animations[this.options.backdropAnimation][show ? 0 : 1]]
                (this.options.backdropAnimationDuration, callback);
        } else {
            $backdrop.toggle(show) && ($.isFunction(callback) && callback.call(callback));
        }

        return this;
    };

    Modal.prototype.close = function (initializer) {
        if (!initializer || (initializer && this._checkCanRemove(initializer))) {
            var afterToggle = function () {
                this.$root.remove();
                $.isFunction(this.options.callback) && this.options.callback.apply(this, [this.callbackResult]);
                manager.closeModal(this);
            };

            this.toggle(false, afterToggle.bind(this));
        }

        return this;
    };

    /**
     * Utilities/methods aliases.
     */

    Modal.prototype.show = function () {
        return this.toggle.apply(this, [true].concat($.makeArray(arguments)));
    };

    Modal.prototype.hide = function () {
        return this.toggle.apply(this, [false].concat($.makeArray(arguments)));
    };

    Modal.prototype._callTypeSpecificFunction = function (functionName) {
        if (functionName in this.type) {
            this.type[functionName].apply(this, $.makeArray(arguments).slice(1));
        }

        return this;
    };

    Modal.prototype._display = function (display) {
        return this.$root.css('display', display ? 'inline' : 'none') && this;
    };

    Modal.prototype._withVisible = function (fn) {
        var hidden = !this.$root.is(':visible');
        var result;

        this._display(true);
        result = fn.call(this);
        hidden && this._display(false);

        return result;
    };

    /**
     * Check if modal can be closed basing on initializer (close button, ESC key,
     * click outside modal...) and modal configuration options.
     */
    Modal.prototype._checkCanRemove = function (initializer) {
        return this.visible && (
            (initializer === CLOSE_INITIALIZER_CLOSE_BUTTON) ||
            (initializer === CLOSE_INITIALIZER_ESC && this.options.escapeKeyCloses) ||
            (initializer === CLOSE_INITIALIZER_OUTSIDE_CLICK && this.options.outsideClickCloses)
            );
    };

    // -----------------------------------------------------------------------------------------------------------------

    $(function () {
        manager = new ModalManager();
        backdrop = new Backdrop();
        modalButton = new ModalButton();

        publicScope.instances = manager.instances;
        publicScope.test = function () {
            modal.open({content: '1', backdrop: true});
            modal.open({content: '2', backdrop: true});
            modal.open({content: '3', backdrop: true});
            modal.alert('Lol', {backdrop: false});
            modal.open({
                backdrop: false,
                content: 'Hello!<br>How are you?<br>This is default dialog.<br><br>' +
                         '<strong>Code:</strong><br><span style="font-family: monospace;">' +
                         'modal.open({<br>&nbsp;&nbsp;&nbsp;&nbsp;content: \'Content...\'<br>});'
            });

            //modal.alert('Jeden', {backdrop: true});
            //modal.alert('Dwa', {backdrop: true});
            //modal.alert('Trzy', {backdrop: true});

            //modal.prompt('Enter your name:', 'Daniel', {
            //    callback: function (name) {
            //        if (!name) {
            //            modal.confirm('Ouh, you want to try again?', {
            //                callback: function (tryAgain) {
            //                    if (tryAgain) {
            //                        modal.prompt('Name again:', '(your name here)', {
            //                            callback: function (name) {
            //                                if (name) {
            //                                    modal.alert('Finally! Thanks, ' + name + '!');
            //                                } else {
            //                                    modal.alert('I\'m sad now :(');
            //                                }
            //                            }
            //                        })
            //                    } else {
            //                        modal.alert('Ok. Fuck off, then.');
            //                    }
            //                }
            //            })
            //        } else {
            //            modal.alert('Hello, ' + name + '!');
            //        }
            //    }
            //});
        };
    });

    if (typeof global.modal === 'undefined') {
        global.modal = publicScope;
    }
}(this));